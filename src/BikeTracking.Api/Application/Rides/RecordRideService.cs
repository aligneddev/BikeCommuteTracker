using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

public sealed class RecordRideService(
    BikeTrackingDbContext dbContext,
    IWeatherLookupService weatherLookupService,
    ILogger<RecordRideService> logger
)
{
    public async Task<(int rideId, RideRecordedEventPayload eventPayload)> ExecuteAsync(
        long riderId,
        RecordRideRequest request,
        CancellationToken cancellationToken = default
    )
    {
        if (request.Miles <= 0)
        {
            throw new ArgumentException("Miles must be greater than 0", nameof(request));
        }

        if (request.Miles > 200)
        {
            throw new ArgumentException("Miles must be less than or equal to 200", nameof(request));
        }

        if (request.RideMinutes.HasValue && request.RideMinutes.Value <= 0)
        {
            throw new ArgumentException(
                "Ride minutes must be greater than 0 when provided",
                nameof(request)
            );
        }

        WeatherData? weatherData = null;
        if (!request.WeatherUserOverridden)
        {
            var userSettings = await dbContext
                .UserSettings.AsNoTracking()
                .SingleOrDefaultAsync(settings => settings.UserId == riderId, cancellationToken);

            if (
                userSettings?.Latitude is decimal latitude
                && userSettings.Longitude is decimal longitude
            )
            {
                weatherData = await weatherLookupService.GetOrFetchAsync(
                    latitude,
                    longitude,
                    request.RideDateTimeLocal.ToUniversalTime(),
                    cancellationToken
                );
            }
        }

        var temperature = request.Temperature ?? weatherData?.Temperature;
        var (
            windSpeedMph,
            windDirectionDeg,
            relativeHumidityPercent,
            cloudCoverPercent,
            precipitationType
        ) = MergeWeatherFields(
            weatherData,
            request.WindSpeedMph,
            request.WindDirectionDeg,
            request.RelativeHumidityPercent,
            request.CloudCoverPercent,
            request.PrecipitationType
        );

        var rideEntity = new RideEntity
        {
            RiderId = riderId,
            RideDateTimeLocal = request.RideDateTimeLocal,
            Miles = request.Miles,
            RideMinutes = request.RideMinutes,
            Temperature = temperature,
            GasPricePerGallon = request.GasPricePerGallon,
            WindSpeedMph = windSpeedMph,
            WindDirectionDeg = windDirectionDeg,
            RelativeHumidityPercent = relativeHumidityPercent,
            CloudCoverPercent = cloudCoverPercent,
            PrecipitationType = precipitationType,
            WeatherUserOverridden = request.WeatherUserOverridden,
            CreatedAtUtc = DateTime.UtcNow,
        };

        dbContext.Rides.Add(rideEntity);
        await dbContext.SaveChangesAsync(cancellationToken);

        var eventPayload = RideRecordedEventPayload.Create(
            riderId: riderId,
            rideDateTimeLocal: request.RideDateTimeLocal,
            miles: request.Miles,
            rideMinutes: request.RideMinutes,
            temperature: temperature,
            gasPricePerGallon: request.GasPricePerGallon,
            windSpeedMph: windSpeedMph,
            windDirectionDeg: windDirectionDeg,
            relativeHumidityPercent: relativeHumidityPercent,
            cloudCoverPercent: cloudCoverPercent,
            precipitationType: precipitationType,
            weatherUserOverridden: request.WeatherUserOverridden
        );

        logger.LogInformation(
            "Recorded ride {RideId} for rider {RiderId} at {RideDateTimeLocal}",
            rideEntity.Id,
            riderId,
            request.RideDateTimeLocal
        );

        return (rideEntity.Id, eventPayload);
    }

    private static (
        decimal? windSpeedMph,
        int? windDirectionDeg,
        int? relativeHumidityPercent,
        int? cloudCoverPercent,
        string? precipitationType
    ) MergeWeatherFields(
        WeatherData? weatherData,
        decimal? userWindSpeed,
        int? userWindDir,
        int? userHumidity,
        int? userCloudCover,
        string? userPrecipType
    )
    {
        return (
            windSpeedMph: userWindSpeed ?? weatherData?.WindSpeedMph,
            windDirectionDeg: userWindDir ?? weatherData?.WindDirectionDeg,
            relativeHumidityPercent: userHumidity ?? weatherData?.RelativeHumidityPercent,
            cloudCoverPercent: userCloudCover ?? weatherData?.CloudCoverPercent,
            precipitationType: userPrecipType ?? weatherData?.PrecipitationType
        );
    }
}
