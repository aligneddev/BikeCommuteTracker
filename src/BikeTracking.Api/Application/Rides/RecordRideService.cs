using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp;
using Microsoft.EntityFrameworkCore;
using Microsoft.FSharp.Core;

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

        if (request.Note is not null && request.Note.Length > 500)
        {
            throw new ArgumentException("Note must be 500 characters or fewer", nameof(request));
        }

        if (
            request.Difficulty.HasValue
            && (request.Difficulty.Value < 1 || request.Difficulty.Value > 5)
        )
        {
            throw new ArgumentException("Difficulty must be between 1 and 5", nameof(request));
        }

        var userSettings = await dbContext
            .UserSettings.AsNoTracking()
            .SingleOrDefaultAsync(settings => settings.UserId == riderId, cancellationToken);

        WeatherData? weatherData = null;
        if (!request.WeatherUserOverridden)
        {
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

        // Compute WindResistanceRating if direction and wind data are available
        int? computedWindResistanceRating = null;
        string? canonicalDirection = null;

        if (request.PrimaryTravelDirection is not null)
        {
            var parsedDirection = WindResistance.tryParseCompassDirection(
                request.PrimaryTravelDirection
            );
            if (OptionModule.IsSome(parsedDirection))
            {
                canonicalDirection = request.PrimaryTravelDirection; // already canonical from tryParse

                var windSpeedOption = windSpeedMph.HasValue
                    ? FSharpOption<decimal>.Some(windSpeedMph.Value)
                    : FSharpOption<decimal>.None;
                var windDirOption = windDirectionDeg.HasValue
                    ? FSharpOption<int>.Some(windDirectionDeg.Value)
                    : FSharpOption<int>.None;

                var result = WindResistance.calculateDifficulty(
                    windSpeedOption,
                    parsedDirection.Value,
                    windDirOption
                );
                if (result.IsOk)
                {
                    computedWindResistanceRating = result.ResultValue.Item1;
                }
            }
            else
            {
                // Invalid direction string — return 400
                throw new ArgumentException(
                    $"Invalid primary travel direction '{request.PrimaryTravelDirection}'. Accepted values: {string.Join(", ", WindResistance.validDirectionNames)}",
                    nameof(request)
                );
            }
        }

        // Validate preset ownership before saving ride
        if (request.SelectedPresetId.HasValue)
        {
            var presetExists = await dbContext.RidePresets.AnyAsync(
                x => x.RidePresetId == request.SelectedPresetId.Value && x.RiderId == riderId,
                cancellationToken
            );

            if (!presetExists)
            {
                throw new ArgumentException(
                    "Selected preset does not belong to this rider.",
                    nameof(request)
                );
            }
        }

        var rideEntity = new RideEntity
        {
            RiderId = riderId,
            RideDateTimeLocal = request.RideDateTimeLocal,
            Miles = request.Miles,
            RideMinutes = request.RideMinutes,
            Temperature = temperature,
            GasPricePerGallon = request.GasPricePerGallon,
            SnapshotAverageCarMpg = userSettings?.AverageCarMpg,
            SnapshotMileageRateCents = userSettings?.MileageRateCents,
            SnapshotYearlyGoalMiles = userSettings?.YearlyGoalMiles,
            SnapshotOilChangePrice = userSettings?.OilChangePrice,
            WindSpeedMph = windSpeedMph,
            WindDirectionDeg = windDirectionDeg,
            RelativeHumidityPercent = relativeHumidityPercent,
            CloudCoverPercent = cloudCoverPercent,
            PrecipitationType = precipitationType,
            Notes = request.Note,
            WeatherUserOverridden = request.WeatherUserOverridden,
            Difficulty = request.Difficulty,
            PrimaryTravelDirection = canonicalDirection,
            WindResistanceRating = computedWindResistanceRating,
            CreatedAtUtc = DateTime.UtcNow,
        };

        dbContext.Rides.Add(rideEntity);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Update preset MRU after successful ride save
        if (request.SelectedPresetId.HasValue)
        {
            var preset = await dbContext.RidePresets.SingleOrDefaultAsync(
                x => x.RidePresetId == request.SelectedPresetId.Value,
                cancellationToken
            );

            if (preset is not null)
            {
                preset.LastUsedAtUtc = DateTime.UtcNow;
                await dbContext.SaveChangesAsync(cancellationToken);
            }
        }

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
            note: request.Note,
            weatherUserOverridden: request.WeatherUserOverridden,
            snapshotAverageCarMpg: rideEntity.SnapshotAverageCarMpg,
            snapshotMileageRateCents: rideEntity.SnapshotMileageRateCents,
            snapshotYearlyGoalMiles: rideEntity.SnapshotYearlyGoalMiles,
            snapshotOilChangePrice: rideEntity.SnapshotOilChangePrice,
            difficulty: request.Difficulty,
            primaryTravelDirection: canonicalDirection,
            windResistanceRating: computedWindResistanceRating
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
