using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Imports;

public sealed class DuplicateResolutionService(BikeTrackingDbContext dbContext)
    : IDuplicateResolutionService
{
    public async Task<
        IReadOnlyDictionary<int, IReadOnlyList<ImportDuplicateMatch>>
    > GetDuplicateMatchesAsync(
        long riderId,
        IReadOnlyList<ImportDuplicateCandidate> candidates,
        CancellationToken cancellationToken
    )
    {
        if (candidates.Count == 0)
        {
            return new Dictionary<int, IReadOnlyList<ImportDuplicateMatch>>();
        }

        var riderRides = await dbContext
            .Rides.AsNoTracking()
            .Where(ride => ride.RiderId == riderId)
            .ToListAsync(cancellationToken);

        var lookup = new Dictionary<int, IReadOnlyList<ImportDuplicateMatch>>();

        foreach (var candidate in candidates)
        {
            var matches = riderRides
                .Where(ride => DateOnly.FromDateTime(ride.RideDateTimeLocal) == candidate.Date)
                .Where(ride => ride.Miles == candidate.Miles)
                .Select(ride => new ImportDuplicateMatch(
                    ExistingRideId: ride.Id,
                    ExistingRideDate: ride.RideDateTimeLocal.ToString("yyyy-MM-dd"),
                    ExistingMiles: ride.Miles
                ))
                .ToArray();

            if (matches.Length > 0)
            {
                lookup[candidate.RowNumber] = matches;
            }
        }

        return lookup;
    }
}
