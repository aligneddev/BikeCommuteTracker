using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Infrastructure;

public sealed class RidesPersistenceTests
{
    [Fact]
    public async Task DbContext_CanSaveRideEntity_WithAllFields()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Alice",
            NormalizedName = "alice",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var ride = new RideEntity
        {
            RiderId = (int)user.UserId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 10.5m,
            RideMinutes = 45,
            Temperature = 72m,
            CreatedAtUtc = DateTime.UtcNow,
        };

        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        var retrieved = await context.Rides.FirstAsync();
        Assert.NotNull(retrieved);
        Assert.Equal(ride.RiderId, retrieved.RiderId);
        Assert.Equal(ride.Miles, retrieved.Miles);
        Assert.Equal(45, retrieved.RideMinutes);
        Assert.Equal(72m, retrieved.Temperature);
    }

    [Fact]
    public async Task DbContext_CanRoundTripRideSnapshotFields()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Snapshot Persist Rider",
            NormalizedName = "snapshot persist rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        context.Rides.Add(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 14m,
                RideMinutes = 42,
                GasPricePerGallon = 3.55m,
                SnapshotAverageCarMpg = 34.2m,
                SnapshotMileageRateCents = 67m,
                SnapshotYearlyGoalMiles = 2500m,
                SnapshotOilChangePrice = 95m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var retrieved = await context.Rides.SingleAsync();
        Assert.Equal(34.2m, retrieved.SnapshotAverageCarMpg);
        Assert.Equal(67m, retrieved.SnapshotMileageRateCents);
        Assert.Equal(2500m, retrieved.SnapshotYearlyGoalMiles);
        Assert.Equal(95m, retrieved.SnapshotOilChangePrice);
    }

    [Fact]
    public async Task DbContext_AllowsNullOptionalFields()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Bob",
            NormalizedName = "bob",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var ride = new RideEntity
        {
            RiderId = (int)user.UserId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 5m,
            RideMinutes = null,
            Temperature = null,
            CreatedAtUtc = DateTime.UtcNow,
        };

        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        var retrieved = await context.Rides.FirstAsync();
        Assert.NotNull(retrieved);
        Assert.Null(retrieved.RideMinutes);
        Assert.Null(retrieved.Temperature);
    }

    [Fact(
        Skip = "In-memory database does not enforce check constraints; tests pass against SQL Server"
    )]
    public async Task DbContext_EnforcesCheckConstraint_MilesGreaterThanZero()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Charlie",
            NormalizedName = "charlie",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var ride = new RideEntity
        {
            RiderId = (int)user.UserId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 0m,
            CreatedAtUtc = DateTime.UtcNow,
        };

        context.Rides.Add(ride);

        // Should throw when SaveChangesAsync is called (in-memory DB may not enforce, but EF validation should)
        // This test may pass in-memory but fail against real DB
        var exception = await Assert.ThrowsAnyAsync<Exception>(() => context.SaveChangesAsync());
        Assert.NotNull(exception);
    }

    [Fact]
    public async Task DbContext_CanRoundTrip_NewDifficultyColumns()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Difficulty Test Rider",
            NormalizedName = "difficulty test rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var ride = new RideEntity
        {
            RiderId = (int)user.UserId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 8.0m,
            CreatedAtUtc = DateTime.UtcNow,
            Difficulty = 3,
            PrimaryTravelDirection = "NE",
            WindResistanceRating = 2,
        };

        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();
        var retrieved = await context.Rides.FirstAsync(r => r.Difficulty == 3);
        Assert.Equal(3, retrieved.Difficulty);
        Assert.Equal("NE", retrieved.PrimaryTravelDirection);
        Assert.Equal(2, retrieved.WindResistanceRating);
    }

    [Fact]
    public async Task DbContext_AllowsNull_ForAllThreeNewColumns()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Null Fields Rider",
            NormalizedName = "null fields rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var ride = new RideEntity
        {
            RiderId = (int)user.UserId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 5.0m,
            CreatedAtUtc = DateTime.UtcNow,
            Difficulty = null,
            PrimaryTravelDirection = null,
            WindResistanceRating = null,
        };

        context.Rides.Add(ride);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();
        var retrieved = await context.Rides.FirstAsync(r => r.Miles == 5.0m);
        Assert.Null(retrieved.Difficulty);
        Assert.Null(retrieved.PrimaryTravelDirection);
        Assert.Null(retrieved.WindResistanceRating);
    }

    [Fact(
        Skip = "In-memory SQLite does not enforce MaxLength; enforced by EF model metadata and API-layer DataAnnotations"
    )]
    public async Task DbContext_Enforces_MaxLength5_ForPrimaryTravelDirection()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "MaxLength Rider",
            NormalizedName = "maxlength rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // "Southwest" is 9 chars — exceeds the 5-char limit for PrimaryTravelDirection
        var ride = new RideEntity
        {
            RiderId = (int)user.UserId,
            RideDateTimeLocal = DateTime.Now,
            Miles = 3.0m,
            CreatedAtUtc = DateTime.UtcNow,
            PrimaryTravelDirection = "Southwest", // too long
        };

        context.Rides.Add(ride);
        await Assert.ThrowsAnyAsync<Exception>(async () => await context.SaveChangesAsync());
    }

    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}
