using System.Globalization;
using System.Text.Json;
using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

public interface IGasPriceLookupService
{
    Task<decimal?> GetOrFetchAsync(
        DateOnly date,
        string grade,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Get or fetch gas price using the ISO week start date + grade as the cache key.
    /// Multiple dates within the same week share the same grade-specific cached entry.
    /// </summary>
    Task<decimal?> GetOrFetchAsync(
        DateOnly priceDate,
        DateOnly weekStartDate,
        string grade,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    );
}

public sealed class EiaGasPriceLookupService(
    BikeTrackingDbContext dbContext,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<EiaGasPriceLookupService> logger,
    GasPriceRefreshCoordinator refreshCoordinator,
    TimeProvider timeProvider
) : IGasPriceLookupService
{
    private const string RegularGrade = "Regular";
    private const string PremiumGrade = "Premium";
    private static readonly TimeSpan CacheFreshnessWindow = TimeSpan.FromDays(3);

    public async Task<decimal?> GetOrFetchAsync(
        DateOnly date,
        string grade,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    )
    {
        var weekStartDate = GasPriceWeekKeyHelper.GetWeekStartDate(date);
        return await GetOrFetchAsync(date, weekStartDate, grade, apiKey, cancellationToken);
    }

    public async Task<decimal?> GetOrFetchAsync(
        DateOnly priceDate,
        DateOnly weekStartDate,
        string grade,
        string? apiKey = null,
        CancellationToken cancellationToken = default
    )
    {
        if (!TryNormalizeGrade(grade, out var normalizedGrade))
        {
            throw new ArgumentException(
                "grade must be either 'Regular' or 'Premium'.",
                nameof(grade)
            );
        }

        var cached = await dbContext
            .GasPriceLookups.AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.WeekStartDate == weekStartDate && x.Grade == normalizedGrade,
                cancellationToken
            );

        if (cached is not null && IsFresh(cached.RetrievedAtUtc))
        {
            return cached.PricePerGallon;
        }

        return await refreshCoordinator.RunExclusiveAsync(
            (weekStartDate, normalizedGrade),
            async () =>
            {
                var current = await dbContext.GasPriceLookups.SingleOrDefaultAsync(
                    x => x.WeekStartDate == weekStartDate && x.Grade == normalizedGrade,
                    cancellationToken
                );

                if (current is not null && IsFresh(current.RetrievedAtUtc))
                {
                    return current.PricePerGallon;
                }

                var staleValue = current?.PricePerGallon;
                var resolvedApiKey = ResolveApiKey(apiKey);

                if (string.IsNullOrWhiteSpace(resolvedApiKey))
                {
                    logger.LogWarning(
                        "EIA API key missing; skipping gas price lookup for {Date} ({Grade})",
                        priceDate,
                        normalizedGrade
                    );
                    return staleValue;
                }

                var fetched = await TryFetchLatestPriceAsync(
                    priceDate,
                    normalizedGrade,
                    resolvedApiKey,
                    cancellationToken
                );

                if (fetched is null || fetched.PricePerGallon <= 0)
                {
                    return staleValue;
                }

                var retrievedAtUtc = timeProvider.GetUtcNow().UtcDateTime;
                if (current is null)
                {
                    var entry = new GasPriceLookupEntity
                    {
                        PriceDate = priceDate,
                        WeekStartDate = weekStartDate,
                        Grade = normalizedGrade,
                        PricePerGallon = fetched.PricePerGallon,
                        DataSource = fetched.DataSource,
                        EiaPeriodDate = fetched.EiaPeriodDate,
                        RetrievedAtUtc = retrievedAtUtc,
                    };

                    dbContext.GasPriceLookups.Add(entry);
                    try
                    {
                        await dbContext.SaveChangesAsync(cancellationToken);
                    }
                    catch (DbUpdateException)
                    {
                        var existing = await dbContext
                            .GasPriceLookups.AsNoTracking()
                            .SingleOrDefaultAsync(
                                x => x.WeekStartDate == weekStartDate && x.Grade == normalizedGrade,
                                cancellationToken
                            );

                        if (existing is not null)
                        {
                            return existing.PricePerGallon;
                        }

                        throw;
                    }
                }
                else
                {
                    current.PriceDate = priceDate;
                    current.PricePerGallon = fetched.PricePerGallon;
                    current.DataSource = fetched.DataSource;
                    current.EiaPeriodDate = fetched.EiaPeriodDate;
                    current.RetrievedAtUtc = retrievedAtUtc;
                    await dbContext.SaveChangesAsync(cancellationToken);
                }

                return fetched.PricePerGallon;
            }
        );
    }

    private bool IsFresh(DateTime retrievedAtUtc)
    {
        var age = timeProvider.GetUtcNow().UtcDateTime - retrievedAtUtc;
        return age < CacheFreshnessWindow;
    }

    private string? ResolveApiKey(string? apiKey)
    {
        return string.IsNullOrWhiteSpace(apiKey) ? configuration["GasPriceLookup:EiaApiKey"] : apiKey;
    }

    private async Task<FetchedGasPrice?> TryFetchLatestPriceAsync(
        DateOnly priceDate,
        string normalizedGrade,
        string apiKey,
        CancellationToken cancellationToken
    )
    {
        var (productFacet, dataSource) = normalizedGrade switch
        {
            PremiumGrade => ("EPMP", "EIA_EPMP_NUS_Weekly"),
            _ => ("EPMR", "EIA_EPMR_NUS_Weekly"),
        };

        var requestUri =
            $"/v2/petroleum/pri/gnd/data?api_key={Uri.EscapeDataString(apiKey)}&data[]=value"
            + "&facets[duoarea][]=NUS"
            + $"&facets[product][]={productFacet}"
            + "&frequency=weekly"
            + $"&end={priceDate:yyyy-MM-dd}"
            + "&sort[0][column]=period"
            + "&sort[0][direction]=desc"
            + "&length=1";

        try
        {
            var client = httpClientFactory.CreateClient("EiaGasPrice");
            using var response = await client.GetAsync(requestUri, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "EIA lookup failed for {Date} ({Grade}) with status {StatusCode}",
                    priceDate,
                    normalizedGrade,
                    response.StatusCode
                );
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var jsonDoc = await JsonDocument.ParseAsync(
                stream,
                cancellationToken: cancellationToken
            );

            if (
                !TryReadPrice(jsonDoc.RootElement, out var eiaPeriodDate, out var pricePerGallon)
                || pricePerGallon <= 0
            )
            {
                return null;
            }

            return new FetchedGasPrice(eiaPeriodDate, pricePerGallon, dataSource);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "EIA lookup threw for {Date} ({Grade})", priceDate, normalizedGrade);
            return null;
        }
    }

    private static bool TryNormalizeGrade(string? grade, out string normalizedGrade)
    {
        if (string.Equals(grade, RegularGrade, StringComparison.OrdinalIgnoreCase))
        {
            normalizedGrade = RegularGrade;
            return true;
        }

        if (string.Equals(grade, PremiumGrade, StringComparison.OrdinalIgnoreCase))
        {
            normalizedGrade = PremiumGrade;
            return true;
        }

        normalizedGrade = string.Empty;
        return false;
    }

    private static bool TryReadPrice(
        JsonElement root,
        out DateOnly eiaPeriodDate,
        out decimal pricePerGallon
    )
    {
        eiaPeriodDate = default;
        pricePerGallon = default;

        if (
            !root.TryGetProperty("response", out var response)
            || !response.TryGetProperty("data", out var data)
            || data.ValueKind != JsonValueKind.Array
            || data.GetArrayLength() == 0
        )
        {
            return false;
        }

        var first = data[0];
        if (
            !first.TryGetProperty("period", out var period)
            || period.ValueKind != JsonValueKind.String
            || !DateOnly.TryParse(period.GetString(), out eiaPeriodDate)
        )
        {
            return false;
        }

        if (
            !first.TryGetProperty("value", out var value)
            || value.ValueKind != JsonValueKind.String
            || !decimal.TryParse(
                value.GetString(),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out pricePerGallon
            )
        )
        {
            return false;
        }

        return true;
    }

    private sealed record FetchedGasPrice(
        DateOnly EiaPeriodDate,
        decimal PricePerGallon,
        string DataSource
    );
}
