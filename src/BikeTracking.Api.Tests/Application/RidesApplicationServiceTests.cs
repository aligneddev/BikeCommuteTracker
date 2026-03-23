using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BikeTracking.Api.Tests.Application;

public sealed class RidesApplicationServiceTests
{
    [Fact]
    public async Task RecordRideService_WithValidRequest_PersistsRideAndCreatesEvent()
    {
        using var context = CreateDbContext();
        // Seed user
        var user = new UserEntity { DisplayName = "Alice", NormalizedName = "alice", CreatedAtUtc = DateTime.UtcNow };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        var logger = loggerFactory.CreateLogger<RecordRideService>();
        var service = new RecordRideService(context, logger);
        var request = new RecordRideRequest(DateTime.Now, 10.5m, 45, 72m);

        var (rideId, eventPayload) = await service.ExecuteAsync(user.UserId, request);

        Assert.True(rideId > 0);
        Assert.NotNull(eventPayload);
        Assert.Equal(user.UserId, eventPayload.RiderId);
        Assert.Equal(10.5m, eventPayload.Miles);
        Assert.Equal(45, eventPayload.RideMinutes);
        Assert.Equal(72m, eventPayload.Temperature);

        // Verify ride was persisted
        var persistedRide = await context.Rides.FindAsync(rideId);
        Assert.NotNull(persistedRide);
        Assert.Equal(user.UserId, persistedRide.RiderId);
        Assert.Equal(10.5m, persistedRide.Miles);
    }

    [Fact]
    public async Task RecordRideService_ValidatesMillesGreaterThanZero()
    {
        using var context = CreateDbContext();
        var user = new UserEntity { DisplayName = "Bob", NormalizedName = "bob", CreatedAtUtc = DateTime.UtcNow };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(context, null!);
        var request = new RecordRideRequest(DateTime.Now, 0m);

        await Assert.ThrowsAsync<ArgumentException>(() => service.ExecuteAsync(user.UserId, request));
    }

    [Fact]
    public async Task RecordRideService_ValidatesRideMinutesGreaterThanZeroWhenProvided()
    {
        using var context = CreateDbContext();
        var user = new UserEntity { DisplayName = "Charlie", NormalizedName = "charlie", CreatedAtUtc = DateTime.UtcNow };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(context, null!);
        var request = new RecordRideRequest(DateTime.Now, 10m, -5);

        await Assert.ThrowsAsync<ArgumentException>(() => service.ExecuteAsync(user.UserId, request));
    }

    [Fact]
    public async Task GetRideDefaultsService_ReturnsDefaultsForNewRider()
    {
        using var context = CreateDbContext();
        var user = new UserEntity { DisplayName = "Diana", NormalizedName = "diana", CreatedAtUtc = DateTime.UtcNow };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new GetRideDefaultsService(context);

        var defaults = await service.ExecuteAsync(user.UserId);

        Assert.False(defaults.HasPreviousRide);
        Assert.Null(defaults.DefaultMiles);
        Assert.Null(defaults.DefaultRideMinutes);
        Assert.Null(defaults.DefaultTemperature);
        Assert.NotEqual(DateTime.MinValue, defaults.DefaultRideDateTimeLocal);
    }

    [Fact]
    public async Task GetRideDefaultsService_ReturnsLastRideDefaults()
    {
        using var context = CreateDbContext();
        var user = new UserEntity { DisplayName = "Eve", NormalizedName = "eve", CreatedAtUtc = DateTime.UtcNow };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Create previous ride
        var previousRide = new RideEntity
        {
            RiderId = user.UserId,
            RideDateTimeLocal = DateTime.Now.AddHours(-1),
            Miles = 10.5m,
            RideMinutes = 45,
            Temperature = 72m,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Rides.Add(previousRide);
        await context.SaveChangesAsync();

        var service = new GetRideDefaultsService(context);

        var defaults = await service.ExecuteAsync(user.UserId);

        Assert.True(defaults.HasPreviousRide);
        Assert.Equal(10.5m, defaults.DefaultMiles);
        Assert.Equal(45, defaults.DefaultRideMinutes);
        Assert.Equal(72m, defaults.DefaultTemperature);
    }

    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}
