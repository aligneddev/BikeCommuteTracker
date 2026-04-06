namespace BikeTracking.Api.Application.Events;

public sealed record RideRecordedEventPayload(
    string EventId,
    string EventType,
    DateTime OccurredAtUtc,
    long RiderId,
    DateTime RideDateTimeLocal,
    decimal Miles,
    int? RideMinutes,
    decimal? Temperature,
    decimal? GasPricePerGallon,
    decimal? WindSpeedMph,
    int? WindDirectionDeg,
    int? RelativeHumidityPercent,
    int? CloudCoverPercent,
    string? PrecipitationType,
    bool WeatherUserOverridden,
    decimal? SnapshotAverageCarMpg,
    decimal? SnapshotMileageRateCents,
    decimal? SnapshotYearlyGoalMiles,
    decimal? SnapshotOilChangePrice,
    string Source
)
{
    public const string EventTypeName = "RideRecorded";
    public const string SourceName = "BikeTracking.Api";

    public static RideRecordedEventPayload Create(
        long riderId,
        DateTime rideDateTimeLocal,
        decimal miles,
        int? rideMinutes = null,
        decimal? temperature = null,
        decimal? gasPricePerGallon = null,
        decimal? windSpeedMph = null,
        int? windDirectionDeg = null,
        int? relativeHumidityPercent = null,
        int? cloudCoverPercent = null,
        string? precipitationType = null,
        bool weatherUserOverridden = false,
        decimal? snapshotAverageCarMpg = null,
        decimal? snapshotMileageRateCents = null,
        decimal? snapshotYearlyGoalMiles = null,
        decimal? snapshotOilChangePrice = null,
        DateTime? occurredAtUtc = null
    )
    {
        return new RideRecordedEventPayload(
            EventId: Guid.NewGuid().ToString(),
            EventType: EventTypeName,
            OccurredAtUtc: occurredAtUtc ?? DateTime.UtcNow,
            RiderId: riderId,
            RideDateTimeLocal: rideDateTimeLocal,
            Miles: miles,
            RideMinutes: rideMinutes,
            Temperature: temperature,
            GasPricePerGallon: gasPricePerGallon,
            WindSpeedMph: windSpeedMph,
            WindDirectionDeg: windDirectionDeg,
            RelativeHumidityPercent: relativeHumidityPercent,
            CloudCoverPercent: cloudCoverPercent,
            PrecipitationType: precipitationType,
            WeatherUserOverridden: weatherUserOverridden,
            SnapshotAverageCarMpg: snapshotAverageCarMpg,
            SnapshotMileageRateCents: snapshotMileageRateCents,
            SnapshotYearlyGoalMiles: snapshotYearlyGoalMiles,
            SnapshotOilChangePrice: snapshotOilChangePrice,
            Source: SourceName
        );
    }
}
