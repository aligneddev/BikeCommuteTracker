using System.Text.Json;
using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Application.Rides;

public sealed class DeleteRideService(
    BikeTrackingDbContext dbContext,
    ILogger<DeleteRideService> logger
)
{
    public sealed record DeleteRideError(string Code, string Message);

    public sealed record DeleteRideResult(
        bool IsSuccess,
        DeleteRideResponse? Response,
        RideDeletedEventPayload? EventPayload,
        DeleteRideError? Error
    )
    {
        public static DeleteRideResult Success(
            DeleteRideResponse response,
            RideDeletedEventPayload eventPayload
        )
        {
            return new DeleteRideResult(true, response, eventPayload, null);
        }

        public static DeleteRideResult SuccessIdempotent(
            DeleteRideResponse response,
            RideDeletedEventPayload? eventPayload = null
        )
        {
            return new DeleteRideResult(true, response, eventPayload, null);
        }

        public static DeleteRideResult Failure(string code, string message)
        {
            return new DeleteRideResult(false, null, null, new DeleteRideError(code, message));
        }
    }

    public async Task<DeleteRideResult> ExecuteAsync(long riderId, long rideId)
    {
        // Check if ride was already deleted (idempotency) before querying live rides.
        // This allows repeat requests to succeed even after the row is removed.
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
            var idempotentResponse = new DeleteRideResponse(
                RideId: rideId,
                DeletedAtUtc: existingDeleteEvent.OccurredAtUtc,
                IsIdempotent: true
            );
            return DeleteRideResult.SuccessIdempotent(idempotentResponse);
        }

        var ride = await dbContext.Rides.Where(r => r.Id == rideId).SingleOrDefaultAsync();

        if (ride is null)
        {
            return DeleteRideResult.Failure("RIDE_NOT_FOUND", $"Ride {rideId} was not found.");
        }

        if (ride.RiderId != riderId)
        {
            return DeleteRideResult.Failure(
                "NOT_RIDE_OWNER",
                $"Ride {rideId} does not belong to the authenticated rider."
            );
        }

        var utcNow = DateTime.UtcNow;

        var eventPayload = RideDeletedEventPayload.Create(
            riderId: riderId,
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

        // Remove from current read model so history and totals update immediately.
        dbContext.Rides.Remove(ride);

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to save delete event for ride {RideId}", rideId);
            throw;
        }

        logger.LogInformation("Deleted ride {RideId} for rider {RiderId}", ride.Id, riderId);

        var response = new DeleteRideResponse(
            RideId: rideId,
            DeletedAtUtc: utcNow,
            IsIdempotent: false
        );
        return DeleteRideResult.Success(response, eventPayload);
    }
}
