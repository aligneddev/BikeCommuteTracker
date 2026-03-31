using BikeTracking.Api.Application.Events;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Application.Rides;

public class RecordRideService(BikeTrackingDbContext dbContext, ILogger<RecordRideService> logger)
{
    private readonly BikeTrackingDbContext _dbContext = dbContext;
    private readonly ILogger<RecordRideService> _logger = logger;

    /// <summary>
    /// Records a ride and creates an event payload for outbox publishing.
    /// </summary>
    public async Task<(int rideId, RideRecordedEventPayload eventPayload)> ExecuteAsync(
        long riderId,
        RecordRideRequest request,
        CancellationToken cancellationToken = default
    )
    {
        // Validation
        if (request.Miles <= 0)
            throw new ArgumentException("Miles must be greater than 0");

        if (request.Miles > 200)
            throw new ArgumentException("Miles must be less than or equal to 200");

        if (request.RideMinutes.HasValue && request.RideMinutes <= 0)
            throw new ArgumentException("Ride minutes must be greater than 0");

        // Create ride entity
        var rideEntity = new RideEntity
        {
            RiderId = riderId,
            RideDateTimeLocal = request.RideDateTimeLocal,
            Miles = request.Miles,
            RideMinutes = request.RideMinutes,
            Temperature = request.Temperature,
            GasPricePerGallon = request.GasPricePerGallon,
            CreatedAtUtc = DateTime.UtcNow,
        };

        _dbContext.Rides.Add(rideEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Create event payload
        var eventPayload = RideRecordedEventPayload.Create(
            riderId: riderId,
            rideDateTimeLocal: request.RideDateTimeLocal,
            miles: request.Miles,
            rideMinutes: request.RideMinutes,
            temperature: request.Temperature,
            gasPricePerGallon: request.GasPricePerGallon
        );

        _logger.LogInformation(
            "Recorded ride {RideId} for rider {RiderId}",
            rideEntity.Id,
            riderId
        );

        return (rideEntity.Id, eventPayload);
    }
}
