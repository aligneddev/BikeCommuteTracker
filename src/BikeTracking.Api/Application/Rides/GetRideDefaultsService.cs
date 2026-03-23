using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

public class GetRideDefaultsService(BikeTrackingDbContext dbContext)
{
    private readonly BikeTrackingDbContext _dbContext = dbContext;

    /// <summary>
    /// Gets ride defaults for a rider by looking up the most recent ride.
    /// </summary>
    public async Task<RideDefaultsResponse> ExecuteAsync(
        long riderId,
        CancellationToken cancellationToken = default)
    {
        // Query latest ride for this rider
        var lastRide = await _dbContext.Rides
            .Where(r => r.RiderId == riderId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastRide == null)
        {
            // No prior rides - return defaults with current time
            return new RideDefaultsResponse(
                HasPreviousRide: false,
                DefaultRideDateTimeLocal: DateTime.Now
            );
        }

        // Has prior rides - return last ride values
        return new RideDefaultsResponse(
            HasPreviousRide: true,
            DefaultRideDateTimeLocal: DateTime.Now,
            DefaultMiles: lastRide.Miles,
            DefaultRideMinutes: lastRide.RideMinutes,
            DefaultTemperature: lastRide.Temperature
        );
    }
}
