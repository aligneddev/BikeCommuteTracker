using BikeTracking.Api.Application.Rides;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Application;

public sealed partial class RidesApplicationServiceTests
{
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

        var service = new GetRideHistoryService(context, TimeProvider.System);

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

        var service = new GetRideHistoryService(context, TimeProvider.System);

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

        var service = new GetRideHistoryService(context, TimeProvider.System);

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

        var service = new GetRideHistoryService(context, TimeProvider.System);

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

        var service = new GetRideHistoryService(context, TimeProvider.System);

        var result = await service.GetRideHistoryAsync(user.UserId, null, null, pageSize: 2);

        Assert.Equal(2, result.Rides.Count);
        Assert.Equal(1, result.Page);
        Assert.Equal(2, result.PageSize);
        Assert.Equal(5, result.TotalRows);
    }

    [Fact]
    public async Task GetRideHistoryService_WithRideNote_ProjectsNoteInHistoryRow()
    {
        using var context = CreateDbContext();
        var user = new UserEntity
        {
            DisplayName = "Note History",
            NormalizedName = "note history",
            CreatedAtUtc = DateTime.UtcNow,
        };
        context.Users.Add(user);

        context.Rides.Add(
            new RideEntity
            {
                RiderId = user.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 6.4m,
                Notes = "Strong crosswind near downtown bridge.",
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        var service = new GetRideHistoryService(context, TimeProvider.System);
        var result = await service.GetRideHistoryAsync(user.UserId, null, null);

        Assert.Single(result.Rides);
        Assert.Equal("Strong crosswind near downtown bridge.", result.Rides[0].Note);
    }
}
