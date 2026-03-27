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
        var user = new UserEntity
        {
            DisplayName = "Alice",
            NormalizedName = "alice",
            CreatedAtUtc = DateTime.UtcNow,
        };
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
        var user = new UserEntity
        {
            DisplayName = "Bob",
            NormalizedName = "bob",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new RecordRideService(context, null!);
        var request = new RecordRideRequest(DateTime.Now, 0m);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task RecordRideService_ValidatesRideMinutesGreaterThanZeroWhenProvided()
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

        var service = new RecordRideService(context, null!);
        var request = new RecordRideRequest(DateTime.Now, 10m, -5);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ExecuteAsync(user.UserId, request)
        );
    }

    [Fact]
    public async Task GetRideDefaultsService_ReturnsDefaultsForNewRider()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Diana",
            NormalizedName = "diana",
            CreatedAtUtc = DateTime.UtcNow,
        };
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
        var user = new UserEntity
        {
            DisplayName = "Eve",
            NormalizedName = "eve",
            CreatedAtUtc = DateTime.UtcNow,
        };
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
            CreatedAtUtc = DateTime.UtcNow,
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

    // History service tests

    [Fact]
    public async Task GetRideHistoryService_WithRides_ReturnsSummariesAndRows()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Frank",
            NormalizedName = "frank",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        // Add rides with one in prior month so thisMonth assertions stay deterministic.
        var today = DateTime.Now;
        var previousMonth = today.AddMonths(-1);
        context.Rides.AddRange(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = previousMonth,
                Miles = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = today,
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null);

        Assert.NotNull(result);
        Assert.NotNull(result.Summaries);
        Assert.Equal(15m, result.Summaries.AllTime.Miles);
        Assert.Equal(2, result.Summaries.AllTime.RideCount);
        Assert.Equal(5m, result.Summaries.ThisMonth.Miles);
        Assert.Equal(1, result.Summaries.ThisMonth.RideCount);
        Assert.Equal(2, result.Rides.Count);
        Assert.Equal(15m, result.FilteredTotal.Miles);
    }

    [Fact]
    public async Task GetRideHistoryService_WithoutRides_ReturnsZeroSummaries()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Grace",
            NormalizedName = "grace",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null);

        Assert.NotNull(result);
        Assert.Empty(result.Rides);
        Assert.Equal(0, result.TotalRows);
        Assert.Equal(0m, result.Summaries.AllTime.Miles);
        Assert.Equal(0, result.Summaries.AllTime.RideCount);
        Assert.Equal(0m, result.FilteredTotal.Miles);
    }

    [Fact]
    public async Task GetRideHistoryService_WithDateRangeFilter_ReturnsFilteredRows()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Henry",
            NormalizedName = "henry",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        var today = DateTime.Now;
        var dateOnlyToday = DateOnly.FromDateTime(today);
        var dateOnlyWeekAgo = dateOnlyToday.AddDays(-7);

        context.Rides.AddRange(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = dateOnlyWeekAgo.ToDateTime(TimeOnly.MinValue),
                Miles = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = today,
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(
            user.UserId,
            dateOnlyToday.AddDays(-1),
            dateOnlyToday
        );

        Assert.Single(result.Rides);
        Assert.Equal(5m, result.FilteredTotal.Miles);
        Assert.Equal(1, result.TotalRows);
    }

    [Fact]
    public async Task GetRideHistoryService_WithInvalidDateRange_Throws()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Ivy",
            NormalizedName = "ivy",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.GetRideHistoryAsync(
                user.UserId,
                DateOnly.FromDateTime(DateTime.Now),
                DateOnly.FromDateTime(DateTime.Now.AddDays(-1))
            )
        );
    }

    [Fact]
    public async Task GetRideHistoryService_WithPageSize_RespectsPagination()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Jack",
            NormalizedName = "jack",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        // Add 5 rides
        for (int i = 0; i < 5; i++)
        {
            context.Rides.Add(
                new RideEntity
                {
                    RiderId = user.UserId,
                    RideDateTimeLocal = DateTime.Now.AddDays(-i),
                    Miles = (i + 1) * 1m,
                    CreatedAtUtc = DateTime.UtcNow,
                }
            );
        }
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null, pageSize: 2);

        Assert.Equal(2, result.Rides.Count);
        Assert.Equal(1, result.Page);
        Assert.Equal(2, result.PageSize);
        Assert.Equal(5, result.TotalRows);
    }

    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}
