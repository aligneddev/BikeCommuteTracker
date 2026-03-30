using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Rides;

public sealed class GetQuickRideOptionsService(BikeTrackingDbContext dbContext)
{
    /// <summary>
    /// Returns quick ride options for the authenticated rider.
    /// Full deduplication/ordering rules are implemented in user-story phases.
    /// </summary>
    public async Task<QuickRideOptionsResponse> ExecuteAsync(
        long riderId,
        CancellationToken cancellationToken = default
    )
    {
        var rides = await dbContext
            .Rides.Where(r => r.RiderId == riderId && r.RideMinutes.HasValue)
            .AsNoTracking()
            .Select(r => new
            {
                r.Miles,
                RideMinutes = r.RideMinutes!.Value,
                r.RideDateTimeLocal,
            })
            .ToListAsync(cancellationToken);

        var options = rides
            .GroupBy(ride => new { ride.Miles, ride.RideMinutes })
            .Select(group => new QuickRideOption(
                group.Key.Miles,
                group.Key.RideMinutes,
                group.Max(ride => ride.RideDateTimeLocal)
            ))
            .OrderByDescending(option => option.LastUsedAtLocal)
            .AsNoTracking()
            .Take(5)
            .ToList();

        return new QuickRideOptionsResponse(options, DateTime.UtcNow);
    }
}
