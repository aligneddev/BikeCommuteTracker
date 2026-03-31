using System.Text.Json;
using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Application.Rides;

public sealed class EditRideService(
    BikeTrackingDbContext dbContext,
    ILogger<EditRideService> logger
)
{
    public sealed record EditRideError(string Code, string Message, int? CurrentVersion = null);

    public sealed record EditRideResult(
        bool IsSuccess,
        EditRideResponse? Response,
        RideEditedEventPayload? EventPayload,
        EditRideError? Error
    )
    {
        public static EditRideResult Success(
            EditRideResponse response,
            RideEditedEventPayload eventPayload
        )
        {
            return new EditRideResult(true, response, eventPayload, null);
        }

        public static EditRideResult Failure(
            string code,
            string message,
            int? currentVersion = null
        )
        {
            return new EditRideResult(
                false,
                null,
                null,
                new EditRideError(code, message, currentVersion)
            );
        }
    }

    public async Task<EditRideResult> ExecuteAsync(
        long riderId,
        long rideId,
        EditRideRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var validationFailure = ValidateRequest(request);
        if (validationFailure is not null)
        {
            return validationFailure;
        }

        var ride = await dbContext
            .Rides.Where(r => r.Id == rideId)
            .SingleOrDefaultAsync(cancellationToken);

        if (ride is null)
        {
            return EditRideResult.Failure("RIDE_NOT_FOUND", $"Ride {rideId} was not found.");
        }

        if (ride.RiderId != riderId)
        {
            return EditRideResult.Failure(
                "FORBIDDEN",
                $"Ride {rideId} does not belong to the authenticated rider."
            );
        }

        var currentVersion = ride.Version <= 0 ? 1 : ride.Version;
        if (request.ExpectedVersion != currentVersion)
        {
            return EditRideResult.Failure(
                "RIDE_VERSION_CONFLICT",
                "Ride edit conflict. The ride was updated by another request.",
                currentVersion
            );
        }

        ride.RideDateTimeLocal = request.RideDateTimeLocal;
        ride.Miles = request.Miles;
        ride.RideMinutes = request.RideMinutes;
        ride.Temperature = request.Temperature;
        ride.GasPricePerGallon = request.GasPricePerGallon;
        ride.Version = currentVersion + 1;

        var utcNow = DateTime.UtcNow;

        var eventPayload = RideEditedEventPayload.Create(
            riderId: riderId,
            rideId: ride.Id,
            previousVersion: currentVersion,
            newVersion: ride.Version,
            rideDateTimeLocal: ride.RideDateTimeLocal,
            miles: ride.Miles,
            rideMinutes: ride.RideMinutes,
            temperature: ride.Temperature,
            gasPricePerGallon: ride.GasPricePerGallon,
            occurredAtUtc: utcNow
        );

        dbContext.OutboxEvents.Add(
            new OutboxEventEntity
            {
                AggregateType = "Ride",
                AggregateId = ride.Id,
                EventType = RideEditedEventPayload.EventTypeName,
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
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return EditRideResult.Failure(
                "RIDE_VERSION_CONFLICT",
                "Ride edit conflict. The ride was updated by another request.",
                currentVersion
            );
        }

        logger.LogInformation(
            "Edited ride {RideId} for rider {RiderId} from version {PreviousVersion} to {NewVersion}",
            ride.Id,
            riderId,
            currentVersion,
            ride.Version
        );

        return EditRideResult.Success(
            new EditRideResponse(
                RideId: ride.Id,
                NewVersion: ride.Version,
                Message: "Ride updated successfully."
            ),
            eventPayload
        );
    }

    private static EditRideResult? ValidateRequest(EditRideRequest request)
    {
        if (request.Miles <= 0)
        {
            return EditRideResult.Failure("VALIDATION_FAILED", "Miles must be greater than 0.");
        }

        if (request.Miles > 200)
        {
            return EditRideResult.Failure(
                "VALIDATION_FAILED",
                "Miles must be less than or equal to 200."
            );
        }

        if (request.RideMinutes.HasValue && request.RideMinutes <= 0)
        {
            return EditRideResult.Failure(
                "VALIDATION_FAILED",
                "Ride minutes must be greater than 0."
            );
        }

        if (request.ExpectedVersion <= 0)
        {
            return EditRideResult.Failure(
                "VALIDATION_FAILED",
                "Expected version must be at least 1."
            );
        }

        return null;
    }
}
