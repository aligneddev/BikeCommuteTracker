using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Application.Dashboard;

public sealed class GetDashboardServiceTests
{
    [Fact]
    public void GetDashboardService_TypeExists()
    {
        var serviceType = typeof(BikeTrackingDbContext).Assembly.GetType(
            "BikeTracking.Api.Application.Dashboard.GetDashboardService"
        );

        Assert.NotNull(serviceType);
    }

    [Fact]
    public void GetDashboardService_ExposesAsyncReadMethod()
    {
        var serviceType = typeof(BikeTrackingDbContext).Assembly.GetType(
            "BikeTracking.Api.Application.Dashboard.GetDashboardService"
        );

        Assert.NotNull(serviceType);

        var method = serviceType!.GetMethod("GetAsync") ?? serviceType.GetMethod("ExecuteAsync");

        Assert.NotNull(method);
    }

    [Fact]
    public async Task GetDashboardService_UsesRideSnapshotsForSavings_WhenCurrentSettingsChanged()
    {
        using var dbContext = CreateDbContext();
        var rider = new UserEntity
        {
            DisplayName = "Dashboard Snapshot Rider",
            NormalizedName = "dashboard snapshot rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        dbContext.Users.Add(rider);
        await dbContext.SaveChangesAsync();

        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                AverageCarMpg = 40m,
                MileageRateCents = 80m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 10m,
                GasPricePerGallon = 3m,
                SnapshotAverageCarMpg = 20m,
                SnapshotMileageRateCents = 50m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetDashboardService(dbContext);
        var dashboard = await service.GetAsync(rider.UserId);

        Assert.Equal(5m, dashboard.Totals.MoneySaved.MileageRateSavings);
        Assert.Equal(1.5m, dashboard.Totals.MoneySaved.FuelCostAvoided);
        Assert.Equal(6.5m, dashboard.Totals.MoneySaved.CombinedSavings);
    }

    [Fact]
    public async Task GetDashboardService_ExcludesLegacyRideWithoutSnapshot_FromSavings()
    {
        using var dbContext = CreateDbContext();
        var rider = new UserEntity
        {
            DisplayName = "Legacy Snapshot Rider",
            NormalizedName = "legacy snapshot rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        dbContext.Users.Add(rider);
        await dbContext.SaveChangesAsync();

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 8m,
                GasPricePerGallon = 3.2m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetDashboardService(dbContext);
        var dashboard = await service.GetAsync(rider.UserId);

        Assert.Null(dashboard.Totals.MoneySaved.MileageRateSavings);
        Assert.Null(dashboard.Totals.MoneySaved.FuelCostAvoided);
        Assert.Null(dashboard.Totals.MoneySaved.CombinedSavings);
        Assert.Equal(0, dashboard.Totals.MoneySaved.QualifiedRideCount);
        Assert.Equal(1, dashboard.MissingData.RidesMissingSavingsSnapshot);
        Assert.Equal(1, dashboard.Totals.AllTimeMiles.RideCount);
        Assert.Equal(8m, dashboard.Totals.AllTimeMiles.Miles);
    }

    [Fact]
    public async Task GetDashboardService_IncludesOptionalMetricValues_WhenDataIsAvailable()
    {
        using var dbContext = CreateDbContext();
        var rider = new UserEntity
        {
            DisplayName = "Optional Metric Rider",
            NormalizedName = "optional metric rider",
            CreatedAtUtc = DateTime.UtcNow,
        };
        dbContext.Users.Add(rider);
        await dbContext.SaveChangesAsync();

        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                YearlyGoalMiles = 100m,
                DashboardGallonsAvoidedEnabled = true,
                DashboardGoalProgressEnabled = true,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 20m,
                SnapshotAverageCarMpg = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetDashboardService(dbContext);
        var dashboard = await service.GetAsync(rider.UserId);

        var gallonsSuggestion = dashboard.Suggestions.Single(metric =>
            metric.MetricKey == "gallonsAvoided"
        );
        var goalSuggestion = dashboard.Suggestions.Single(metric =>
            metric.MetricKey == "goalProgress"
        );

        Assert.Equal(2m, gallonsSuggestion.Value);
        Assert.Equal("gal", gallonsSuggestion.UnitLabel);
        Assert.Equal(20m, goalSuggestion.Value);
        Assert.Equal("%", goalSuggestion.UnitLabel);
    }

    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}
