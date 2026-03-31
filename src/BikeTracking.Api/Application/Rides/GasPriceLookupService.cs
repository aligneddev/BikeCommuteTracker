using System.Globalization;
using System.Text.Json;

namespace BikeTracking.Api.Application.Rides;

public interface IGasPriceLookupService
{
    Task<decimal?> GetOrFetchAsync(DateOnly date, CancellationToken cancellationToken = default);
}

public sealed class EiaGasPriceLookupService(
    BikeTrackingDbContext dbContext,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<EiaGasPriceLookupService> logger
) : IGasPriceLookupService
{
    private const string DataSourceName = "EIA_EPM0_NUS_Weekly";

    public async Task<decimal?> GetOrFetchAsync(
        DateOnly date,
        CancellationToken cancellationToken = default
    )
    {
        var cached = await dbContext
            .GasPriceLookups.AsNoTracking()
            .SingleOrDefaultAsync(x => x.PriceDate == date, cancellationToken);

        if (cached is not null)
        {
            return cached.PricePerGallon;
        }

        var apiKey = configuration["GasPriceLookup:EiaApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("EIA API key missing; skipping gas price lookup for {Date}", date);
            return null;
        }

        var client = httpClientFactory.CreateClient("EiaGasPrice");
        var requestUri =
            $"/v2/petroleum/pri/gnd/data?api_key={Uri.EscapeDataString(apiKey)}&data[]=value"
            + "&facets[duoarea][]=NUS"
            + "&facets[product][]=EPM0"
            + "&frequency=weekly"
            + $"&end={date:yyyy-MM-dd}"
            + "&sort[0][column]=period"
            + "&sort[0][direction]=desc"
            + "&length=1";

        try
        {
            using var response = await client.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "EIA lookup failed for {Date} with status {StatusCode}",
                    date,
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

            var entry = new GasPriceLookupEntity
            {
                PriceDate = date,
                PricePerGallon = pricePerGallon,
                DataSource = DataSourceName,
                EiaPeriodDate = eiaPeriodDate,
                RetrievedAtUtc = DateTime.UtcNow,
            };

            dbContext.GasPriceLookups.Add(entry);
            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Another request may have inserted the same date concurrently.
                var existing = await dbContext
                    .GasPriceLookups.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.PriceDate == date, cancellationToken);

                if (existing is not null)
                {
                    return existing.PricePerGallon;
                }

                throw;
            }

            return pricePerGallon;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "EIA lookup threw for {Date}", date);
            return null;
        }
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
}
