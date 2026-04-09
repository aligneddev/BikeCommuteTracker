using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class DuplicateResolutionServiceTests
{
    [Fact]
    public async Task GetDuplicateMatchesAsync_MatchesByDateAndMiles()
    {
        await using var db = CreateDbContext();
        db.Rides.Add(
            new RideEntity
            {
                RiderId = 42,
                RideDateTimeLocal = new DateTime(2026, 4, 1, 8, 0, 0),
                Miles = 12.5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await db.SaveChangesAsync();

        var service = new DuplicateResolutionService(db);
        var result = await service.GetDuplicateMatchesAsync(
            42,
            [new ImportDuplicateCandidate(1, new DateOnly(2026, 4, 1), 12.5m)],
            CancellationToken.None
        );

        Assert.True(result.ContainsKey(1));
        Assert.Single(result[1]);
        Assert.Equal(12.5m, result[1][0].ExistingMiles);
    }

    [Fact]
    public async Task GetDuplicateMatchesAsync_DoesNotMatchWhenMilesDiffer()
    {
        await using var db = CreateDbContext();
        db.Rides.Add(
            new RideEntity
            {
                RiderId = 42,
                RideDateTimeLocal = new DateTime(2026, 4, 1, 8, 0, 0),
                Miles = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await db.SaveChangesAsync();

        var service = new DuplicateResolutionService(db);
        var result = await service.GetDuplicateMatchesAsync(
            42,
            [new ImportDuplicateCandidate(1, new DateOnly(2026, 4, 1), 12.5m)],
            CancellationToken.None
        );

        Assert.False(result.ContainsKey(1));
    }

    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}
