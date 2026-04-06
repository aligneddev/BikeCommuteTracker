using System.Globalization;
using System.Text.Json;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

/// <summary>
/// Weather data snapshot for a specific location and time.
/// </summary>
public sealed record WeatherData(
    decimal? Temperature,
    decimal? WindSpeedMph,
    int? WindDirectionDeg,
    int? RelativeHumidityPercent,
    int? CloudCoverPercent,
    string? PrecipitationType
);

public interface IWeatherLookupService
{
    /// <summary>
    /// Get or fetch weather data for the specified location and UTC hour.
    /// Uses server-side caching keyed by hour-bucket and rounded coordinates.
    /// Returns null on error (graceful degradation).
    /// </summary>
    Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        CancellationToken cancellationToken = default
    );
}

public sealed class OpenMeteoWeatherLookupService(
    BikeTrackingDbContext dbContext,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<OpenMeteoWeatherLookupService> logger
) : IWeatherLookupService
{
    private const string DataSourceName = "OpenMeteo";

    public async Task<WeatherData?> GetOrFetchAsync(
        decimal latitude,
        decimal longitude,
        DateTime dateTimeUtc,
        CancellationToken cancellationToken = default
    )
    {
        // Compute cache key
        var lookupHourUtc = new DateTime(
            dateTimeUtc.Year,
            dateTimeUtc.Month,
            dateTimeUtc.Day,
            dateTimeUtc.Hour,
            0,
            0,
            DateTimeKind.Utc
        );
        var latRounded = Math.Round(latitude, 2);
        var lonRounded = Math.Round(longitude, 2);

        // Check cache first
        var cached = await dbContext
            .WeatherLookups.AsNoTracking()
            .SingleOrDefaultAsync(
                x =>
                    x.LookupHourUtc == lookupHourUtc
                    && x.LatitudeRounded == latRounded
                    && x.LongitudeRounded == lonRounded,
                cancellationToken
            );

        if (cached is not null && cached.Status == "success")
        {
            logger.LogInformation(
                "Weather cache hit for {LatitudeRounded},{LongitudeRounded} at {LookupHourUtc}",
                latRounded,
                lonRounded,
                lookupHourUtc
            );
            return new WeatherData(
                cached.Temperature,
                cached.WindSpeedMph,
                cached.WindDirectionDeg,
                cached.RelativeHumidityPercent,
                cached.CloudCoverPercent,
                cached.PrecipitationType
            );
        }

        logger.LogInformation(
            "Weather cache miss for {LatitudeRounded},{LongitudeRounded} at {LookupHourUtc}",
            latRounded,
            lonRounded,
            lookupHourUtc
        );

        // Determine which API to call (forecast vs. archive)
        var daysDiff = (int)(DateTime.UtcNow.Date - dateTimeUtc.Date).TotalDays;
        var isHistorical = daysDiff > 92;
        var clientName = isHistorical ? "OpenMeteoArchive" : "OpenMeteoForecast";
        var requestPath = isHistorical ? "/v1/archive" : "/v1/forecast";

        var apiKey = configuration["WeatherLookup:ApiKey"];
        var apiKeyParam = string.IsNullOrWhiteSpace(apiKey)
            ? string.Empty
            : $"&apikey={Uri.EscapeDataString(apiKey)}";

        // Build query parameters
        var pastDaysParam =
            isHistorical || daysDiff < 0 ? "" : $"&past_days={Math.Min(daysDiff + 1, 92)}";
        var queryParams =
            $"?latitude={Uri.EscapeDataString(latitude.ToString(CultureInfo.InvariantCulture))}"
            + $"&longitude={Uri.EscapeDataString(longitude.ToString(CultureInfo.InvariantCulture))}"
            + $"&start_date={dateTimeUtc.Date:yyyy-MM-dd}"
            + $"&end_date={dateTimeUtc.Date:yyyy-MM-dd}"
            + $"{pastDaysParam}"
            + "&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,cloud_cover,precipitation,weather_code"
            + "&temperature_unit=fahrenheit"
            + "&wind_speed_unit=mph"
            + "&timezone=auto"
            + apiKeyParam;

        try
        {
            var client = httpClientFactory.CreateClient(clientName);
            using var response = await client.GetAsync(
                $"{requestPath}{queryParams}",
                cancellationToken
            );

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Open-Meteo lookup failed for rounded {LatitudeRounded},{LongitudeRounded} at {UtcHour} with status {StatusCode}",
                    latRounded,
                    lonRounded,
                    dateTimeUtc,
                    response.StatusCode
                );

                // Cache failure for short period to avoid hammering API
                await TryCacheFailure(lookupHourUtc, latRounded, lonRounded, cancellationToken);
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var jsonDoc = await JsonDocument.ParseAsync(
                stream,
                cancellationToken: cancellationToken
            );

            if (
                !TryReadWeatherAtHour(
                    jsonDoc.RootElement,
                    dateTimeUtc.Hour,
                    out var temp,
                    out var windSpeed,
                    out var windDir,
                    out var humidity,
                    out var cloudCover,
                    out var precipType
                )
            )
            {
                logger.LogWarning(
                    "Open-Meteo response missing or malformed data for {Latitude},{Longitude} at {UtcHour}",
                    latitude,
                    longitude,
                    dateTimeUtc
                );
                await TryCacheFailure(lookupHourUtc, latRounded, lonRounded, cancellationToken);
                return null;
            }

            // Write successful result to cache
            var entry = new WeatherLookupEntity
            {
                LookupHourUtc = lookupHourUtc,
                LatitudeRounded = latRounded,
                LongitudeRounded = lonRounded,
                Temperature = temp,
                WindSpeedMph = windSpeed,
                WindDirectionDeg = windDir,
                RelativeHumidityPercent = humidity,
                CloudCoverPercent = cloudCover,
                PrecipitationType = precipType,
                DataSource = DataSourceName,
                RetrievedAtUtc = DateTime.UtcNow,
                Status = "success",
            };

            try
            {
                dbContext.WeatherLookups.Add(entry);
                await dbContext.SaveChangesAsync(cancellationToken);
                logger.LogInformation(
                    "Weather cache populated for {LatitudeRounded},{LongitudeRounded} at {LookupHourUtc}",
                    latRounded,
                    lonRounded,
                    lookupHourUtc
                );
            }
            catch (DbUpdateException ex)
            {
                // Race condition: another request already cached this entry. Query and return it.
                logger.LogDebug(
                    ex,
                    "Concurrent weather cache insert for {Latitude},{Longitude} at {UtcHour}; using cached entry",
                    latitude,
                    longitude,
                    dateTimeUtc
                );

                var raceWinnerCache = await dbContext
                    .WeatherLookups.AsNoTracking()
                    .SingleOrDefaultAsync(
                        x =>
                            x.LookupHourUtc == lookupHourUtc
                            && x.LatitudeRounded == latRounded
                            && x.LongitudeRounded == lonRounded,
                        cancellationToken
                    );

                if (raceWinnerCache is not null && raceWinnerCache.Status == "success")
                {
                    logger.LogInformation(
                        "Weather cache recovered after concurrent insert for {LatitudeRounded},{LongitudeRounded} at {LookupHourUtc}",
                        latRounded,
                        lonRounded,
                        lookupHourUtc
                    );
                    return new WeatherData(
                        raceWinnerCache.Temperature,
                        raceWinnerCache.WindSpeedMph,
                        raceWinnerCache.WindDirectionDeg,
                        raceWinnerCache.RelativeHumidityPercent,
                        raceWinnerCache.CloudCoverPercent,
                        raceWinnerCache.PrecipitationType
                    );
                }
            }

            return new WeatherData(temp, windSpeed, windDir, humidity, cloudCover, precipType);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Open-Meteo lookup threw for rounded {LatitudeRounded},{LongitudeRounded} at {UtcHour}",
                latRounded,
                lonRounded,
                dateTimeUtc
            );
            return null;
        }
    }

    private async Task TryCacheFailure(
        DateTime lookupHourUtc,
        decimal latRounded,
        decimal lonRounded,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var failureEntry = new WeatherLookupEntity
            {
                LookupHourUtc = lookupHourUtc,
                LatitudeRounded = latRounded,
                LongitudeRounded = lonRounded,
                DataSource = DataSourceName,
                RetrievedAtUtc = DateTime.UtcNow,
                Status = "error",
            };

            dbContext.WeatherLookups.Add(failureEntry);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to cache error entry for weather lookup");
        }
    }

    private static bool TryReadWeatherAtHour(
        JsonElement root,
        int hourOfDay,
        out decimal? temperature,
        out decimal? windSpeed,
        out int? windDirection,
        out int? relativeHumidity,
        out int? cloudCover,
        out string? precipitationType
    )
    {
        temperature = null;
        windSpeed = null;
        windDirection = null;
        relativeHumidity = null;
        cloudCover = null;
        precipitationType = null;

        if (!root.TryGetProperty("hourly", out var hourly))
        {
            return false;
        }

        // Parse hourly data arrays
        if (
            !hourly.TryGetProperty("time", out var times)
            || times.ValueKind != JsonValueKind.Array
            || hourly.TryGetProperty("temperature_2m", out var temps) == false
            || hourly.TryGetProperty("wind_speed_10m", out var windSpeeds) == false
            || hourly.TryGetProperty("wind_direction_10m", out var windDirs) == false
            || hourly.TryGetProperty("relative_humidity_2m", out var humidities) == false
            || hourly.TryGetProperty("cloud_cover", out var cloudCovers) == false
            || hourly.TryGetProperty("weather_code", out var weatherCodes) == false
        )
        {
            return false;
        }

        // Find the index for the requested hour
        int? targetIndex = null;
        for (int i = 0; i < times.GetArrayLength(); i++)
        {
            var timeStr = times[i].GetString();
            if (
                timeStr != null
                && timeStr.EndsWith($"T{hourOfDay:D2}:00", StringComparison.Ordinal)
            )
            {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex is null)
        {
            return false;
        }

        var idx = targetIndex.Value;

        // Extract values at the target hour
        if (idx < temps.GetArrayLength() && temps[idx].ValueKind == JsonValueKind.Number)
        {
            temperature = temps[idx].GetDecimal();
        }

        if (idx < windSpeeds.GetArrayLength() && windSpeeds[idx].ValueKind == JsonValueKind.Number)
        {
            windSpeed = windSpeeds[idx].GetDecimal();
        }

        if (idx < windDirs.GetArrayLength() && windDirs[idx].ValueKind == JsonValueKind.Number)
        {
            windDirection = windDirs[idx].GetInt32();
        }

        if (idx < humidities.GetArrayLength() && humidities[idx].ValueKind == JsonValueKind.Number)
        {
            relativeHumidity = humidities[idx].GetInt32();
        }

        if (
            idx < cloudCovers.GetArrayLength()
            && cloudCovers[idx].ValueKind == JsonValueKind.Number
        )
        {
            cloudCover = cloudCovers[idx].GetInt32();
        }

        // Determine precipitation type from WMO code
        if (
            hourly.TryGetProperty("precipitation", out var precipitationValues)
            && hourly.TryGetProperty("snowfall", out var snowfallValues)
            && idx < weatherCodes.GetArrayLength()
            && weatherCodes[idx].ValueKind == JsonValueKind.Number
        )
        {
            var code = weatherCodes[idx].GetInt32();
            var hasSnow =
                idx < snowfallValues.GetArrayLength()
                && snowfallValues[idx].ValueKind == JsonValueKind.Number
                && snowfallValues[idx].GetDecimal() > 0;
            var hasPrecip =
                idx < precipitationValues.GetArrayLength()
                && precipitationValues[idx].ValueKind == JsonValueKind.Number
                && precipitationValues[idx].GetDecimal() > 0;

            precipitationType = DeterminePrecipitationType(code, hasPrecip, hasSnow);
        }

        return true;
    }

    private static string? DeterminePrecipitationType(int code, bool hasPrecip, bool hasSnow)
    {
        // WMO interpretation
        return code switch
        {
            // Snow / snow showers
            >= 71 and <= 77 => "snow",
            85 or 86 => "snow",
            // Freezing rain
            56 or 57 => "freezing_rain",
            66 or 67 => "freezing_rain",
            // Rain / drizzle / rain showers
            >= 51 and <= 67 when code < 70 => "rain",
            >= 80 and <= 82 => "rain",
            // Clear or no precipitation
            0 => null,
            _ => hasPrecip ? (hasSnow ? "snow" : "rain") : null,
        };
    }
}
