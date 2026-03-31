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
            Source: SourceName
        );
    }
}
