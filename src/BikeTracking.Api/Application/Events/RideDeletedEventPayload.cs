namespace BikeTracking.Api.Application.Events;

public sealed record RideDeletedEventPayload(
    string EventId,
    string EventType,
    DateTime OccurredAtUtc,
    long RiderId,
    long RideId,
    string Source
)
{
    public const string EventTypeName = "RideDeleted";
    public const string SourceName = "BikeTracking.Api";

    public static RideDeletedEventPayload Create(
        long riderId,
        long rideId,
        DateTime? deletedAtUtc = null
    )
    {
        return new RideDeletedEventPayload(
            EventId: Guid.NewGuid().ToString(),
            EventType: EventTypeName,
            OccurredAtUtc: deletedAtUtc ?? DateTime.UtcNow,
            RiderId: riderId,
            RideId: rideId,
            Source: SourceName
        );
    }
}
