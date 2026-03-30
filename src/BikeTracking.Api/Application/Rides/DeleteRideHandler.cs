using System.Text.Json;
using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Application.Rides;

public sealed class DeleteRideHandler(
    BikeTrackingDbContext dbContext,
    ILogger<DeleteRideHandler> logger
)
{
    public sealed record DeleteRideError(string Code, string Message);

    public sealed record DeleteRideResult(
        bool IsSuccess,
        long RideId,
        long UserId,
        DateTime DeletedAt,
        bool IsIdempotent = false,
        string? ErrorCode = null,
        DeleteRideError? Error = null
    )
    {
        public static DeleteRideResult Success(long rideId, long userId, DateTime deletedAt)
        {
            return new DeleteRideResult(
                true,
                rideId,
                userId,
                deletedAt,
                false,
                null,
                null
            );
        }

        public static DeleteRideResult SuccessIdempotent(
            long rideId,
            long userId,
            DateTime deletedAt
        )
        {
            return new DeleteRideResult(
                true,
                rideId,
                userId,
                deletedAt,
                true,
                null,
                null
            );
        }

        public static DeleteRideResult Failure(string code, string message)
        {
            return new DeleteRideResult(
                false,
                0,
                0,
                default,
                false,
                code,
                new DeleteRideError(code, message)
            );
        }
    }

    public async Task<DeleteRideResult> DeleteRideAsync(long userId, long rideId)
    {
        var ride = await dbContext
            .Rides.Where(r => r.Id == rideId)
            .SingleOrDefaultAsync();

        if (ride is null)
        {
            return DeleteRideResult.Failure("RIDE_NOT_FOUND", $"Ride {rideId} was not found.");
        }

        if (ride.RiderId != userId)
        {
            return DeleteRideResult.Failure(
                "NOT_RIDE_OWNER",
                $"Ride {rideId} does not belong to the authenticated rider."
            );
        }

        var utcNow = DateTime.UtcNow;

        // Check if ride was already deleted (idempotency)
        var existingDeleteEvent = await dbContext
            .OutboxEvents.Where(e =>
                e.AggregateType == "Ride"
                && e.AggregateId == rideId
                && e.EventType == RideDeletedEventPayload.EventTypeName
            )
            .FirstOrDefaultAsync();

        if (existingDeleteEvent is not null)
        {
            logger.LogInformation(
                "Delete event already exists for ride {RideId}. Returning idempotent success.",
                rideId
            );
            return DeleteRideResult.SuccessIdempotent(rideId, userId, existingDeleteEvent.OccurredAtUtc);
        }

        var eventPayload = RideDeletedEventPayload.Create(
            riderId: userId,
            rideId: ride.Id,
            deletedAtUtc: utcNow
        );

        dbContext.OutboxEvents.Add(
            new OutboxEventEntity
            {
                AggregateType = "Ride",
                AggregateId = ride.Id,
                EventType = RideDeletedEventPayload.EventTypeName,
                EventPayloadJson = JsonSerializer.Serialize(eventPayload),
                OccurredAtUtc = utcNow,
                RetryCount = 0,
                NextAttemptUtc = utcNow,
                PublishedAtUtc = null,
                LastError = null,
            }
        );

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Failed to save delete event for ride {RideId}",
                rideId
            );
            throw;
        }

        logger.LogInformation(
            "Deleted ride {RideId} for rider {RiderId}",
            ride.Id,
            userId
        );

        return DeleteRideResult.Success(rideId, userId, utcNow);
    }
}
