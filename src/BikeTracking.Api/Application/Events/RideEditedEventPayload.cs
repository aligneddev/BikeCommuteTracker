namespace BikeTracking.Api.Application.Events;

public sealed record RideEditedEventPayload(
    string EventId,
    string EventType,
    DateTime OccurredAtUtc,
    long RiderId,
    long RideId,
    int PreviousVersion,
    int NewVersion,
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
    string Source
)
{
    public const string EventTypeName = "RideEdited";
    public const string SourceName = "BikeTracking.Api";

    public static RideEditedEventPayload Create(
        long riderId,
        long rideId,
        int previousVersion,
        int newVersion,
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
        DateTime? occurredAtUtc = null
    )
    {
        return new RideEditedEventPayload(
            EventId: Guid.NewGuid().ToString(),
            EventType: EventTypeName,
            OccurredAtUtc: occurredAtUtc ?? DateTime.UtcNow,
            RiderId: riderId,
            RideId: rideId,
            PreviousVersion: previousVersion,
            NewVersion: newVersion,
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
            Source: SourceName
        );
    }
}
