using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Application.Dashboard;

public sealed class GetYearStatsDashboardServiceTests
{
    [Fact]
    public void GetYearStatsDashboardService_TypeExists()
    {
        var serviceType = typeof(BikeTrackingDbContext).Assembly.GetType(
            "BikeTracking.Api.Application.Dashboard.GetYearStatsDashboardService"
        );

        Assert.NotNull(serviceType);
    }

    [Fact]
    public void GetYearStatsDashboardService_ExposesAsyncReadMethod()
    {
        var serviceType = typeof(BikeTrackingDbContext).Assembly.GetType(
            "BikeTracking.Api.Application.Dashboard.GetYearStatsDashboardService"
        );

        Assert.NotNull(serviceType);

        var method = serviceType!.GetMethod("GetAsync");
        var availableYearsMethod = serviceType.GetMethod("GetAvailableYearsAsync");

        Assert.NotNull(method);
        Assert.NotNull(availableYearsMethod);
    }

    [Fact]
    public async Task GetAsync_YearWithFullTwelveMonthsOfRides_ProducesCorrectPerMonthTotals()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Full Year Rider");
        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                MileageRateCents = 50m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        for (var month = 1; month <= 12; month++)
        {
            dbContext.Rides.Add(
                new RideEntity
                {
                    RiderId = rider.UserId,
                    RideDateTimeLocal = new DateTime(2025, month, 15),
                    Miles = 10m * month,
                    SnapshotMileageRateCents = 50m,
                    SnapshotAverageCarMpg = 20m,
                    GasPricePerGallon = 3m,
                    CreatedAtUtc = DateTime.UtcNow,
                }
            );
        }
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2025);

        Assert.Equal(2025, response.Year);
        Assert.True(response.HasDataForYear);
        Assert.Equal(12, response.MileageByMonth.Count);
        Assert.Equal(12, response.SavingsByMonth.Count);

        for (var month = 1; month <= 12; month++)
        {
            var point = response.MileageByMonth[month - 1];
            Assert.Equal($"2025-{month:D2}", point.MonthKey);
            Assert.Equal(10m * month, point.Miles);

            var savingsPoint = response.SavingsByMonth[month - 1];
            Assert.Equal(500m * month, savingsPoint.MileageRateSavings);
            Assert.NotNull(savingsPoint.FuelCostAvoided);
        }
    }

    [Fact]
    public async Task GetAsync_InProgressCurrentYearWithPartialData_ZeroFillsElapsedAndFutureMonths()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Partial Year Rider");

        var currentYear = DateTime.Now.Year;
        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(currentYear, 1, 10),
                Miles = 25m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, currentYear);

        Assert.True(response.HasDataForYear);
        Assert.Equal(25m, response.MileageByMonth[0].Miles);

        for (var month = 2; month <= 12; month++)
        {
            Assert.Equal(0m, response.MileageByMonth[month - 1].Miles);
            var savingsPoint = response.SavingsByMonth[month - 1];
            Assert.Null(savingsPoint.MileageRateSavings);
            Assert.Null(savingsPoint.FuelCostAvoided);
            Assert.Null(savingsPoint.CombinedSavings);
        }
    }

    [Fact]
    public async Task GetAsync_YearWithZeroRides_ReturnsHasDataForYearFalse_NoException()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Zero Rides Rider");

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2019);

        Assert.False(response.HasDataForYear);
        Assert.Equal(12, response.MileageByMonth.Count);
        Assert.All(response.MileageByMonth, point => Assert.Equal(0m, point.Miles));
        Assert.All(
            response.SavingsByMonth,
            point =>
            {
                Assert.Null(point.MileageRateSavings);
                Assert.Null(point.FuelCostAvoided);
                Assert.Null(point.CombinedSavings);
            }
        );
        Assert.False(response.Difficulty.HasData);
        Assert.False(response.WindResistance.HasData);
    }

    [Fact]
    public async Task GetAsync_UsesCurrentSettingsMileageRate_ForMileageSavings()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Snapshot Rider");

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
                RideDateTimeLocal = new DateTime(2022, 6, 1),
                Miles = 10m,
                GasPricePerGallon = 3m,
                SnapshotAverageCarMpg = 20m,
                SnapshotMileageRateCents = 50m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2022);

        var june = response.SavingsByMonth[5];
        Assert.Equal(800m, june.MileageRateSavings);
        Assert.Equal(1.5m, june.FuelCostAvoided);
        Assert.Equal(801.5m, june.CombinedSavings);
    }

    [Fact]
    public async Task GetAsync_FiltersDifficultyAndWindResistance_ToRequestedYearOnly()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Difficulty Rider");

        dbContext.Rides.AddRange(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2024, 3, 1),
                Miles = 5m,
                Difficulty = 3,
                WindResistanceRating = 2,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2025, 3, 1),
                Miles = 5m,
                Difficulty = 5,
                WindResistanceRating = -1,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2025);

        Assert.True(response.Difficulty.HasData);
        Assert.Equal(5m, response.Difficulty.OverallAverageDifficulty);
        Assert.Single(response.Difficulty.ByMonth);
        Assert.Equal("2025-03", response.Difficulty.ByMonth[0].MonthKey);
        Assert.True(response.WindResistance.HasData);
    }

    [Fact]
    public async Task GetAsync_RidesWithoutDifficultyOrWindData_YieldsPartialEmptyState()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "No Difficulty Data Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2025, 4, 1),
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2025);

        Assert.True(response.HasDataForYear);
        Assert.False(response.Difficulty.HasData);
        Assert.False(response.WindResistance.HasData);
    }

    [Fact]
    public async Task GetAsync_YearWithRidesAndExpenses_ComputesTotalsSection()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Totals Rider");
        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                MileageRateCents = 50m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        dbContext.Rides.AddRange(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2025, 1, 10),
                Miles = 100m,
                SnapshotMileageRateCents = 50m,
                SnapshotAverageCarMpg = 20m,
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2025, 2, 10),
                Miles = 50m,
                SnapshotMileageRateCents = 50m,
                SnapshotAverageCarMpg = 20m,
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );

        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = rider.UserId,
                ExpenseDate = new DateTime(2025, 3, 1),
                Amount = 40m,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = rider.UserId,
                ExpenseDate = new DateTime(2024, 12, 1),
                Amount = 999m,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2025);

        Assert.Equal(150m, response.Totals.TotalMiles);
        Assert.Equal(7500m + 22.5m, response.Totals.TotalCombinedSavings);
        Assert.Equal(40m, response.Totals.ExpenseSummary.TotalManualExpenses);
    }

    [Fact]
    public async Task GetAsync_YearWithZeroRides_TotalsAreZeroOrNull()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Totals Zero Rider");

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, 2019);

        Assert.Equal(0m, response.Totals.TotalMiles);
        Assert.Null(response.Totals.TotalCombinedSavings);
        Assert.Equal(0m, response.Totals.ExpenseSummary.TotalManualExpenses);
    }

    [Fact]
    public async Task GetAvailableYearsAsync_RiderWithRidesInMultipleYears_ReturnsDescendingDistinctYears()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Multi Year Rider");

        dbContext.Rides.AddRange(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2023, 5, 1),
                Miles = 1m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2024, 5, 1),
                Miles = 1m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2025, 5, 1),
                Miles = 1m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2025, 8, 1),
                Miles = 1m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAvailableYearsAsync(rider.UserId);

        Assert.Equal([2025, 2024, 2023], response.Years);
    }

    [Fact]
    public async Task GetAvailableYearsAsync_RiderWithZeroRides_ReturnsCurrentYearFallback()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "No Rides Rider");

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAvailableYearsAsync(rider.UserId);

        Assert.Equal([DateTime.Now.Year], response.Years);
    }

    [Fact]
    public async Task GetAvailableYearsAsync_RiderWithRidesInOnlyOneYear_ReturnsThatSingleYear()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Single Year Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2021, 5, 1),
                Miles = 1m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAvailableYearsAsync(rider.UserId);

        Assert.Equal([2021], response.Years);
    }

    [Theory]
    [InlineData(1900)]
    public async Task GetAsync_YearBoundaryValue1900_IsAccepted(int year)
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Boundary Rider 1900");

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, year);

        Assert.Equal(year, response.Year);
    }

    [Fact]
    public async Task GetAsync_YearBoundaryValueCurrentYearPlusOne_IsAccepted()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Boundary Rider Next Year");

        var service = new GetYearStatsDashboardService(dbContext, TimeProvider.System);
        var response = await service.GetAsync(rider.UserId, DateTime.Now.Year + 1);

        Assert.Equal(DateTime.Now.Year + 1, response.Year);
    }

    private static async Task<UserEntity> CreateRiderAsync(
        BikeTrackingDbContext dbContext,
        string displayName
    )
    {
        var rider = new UserEntity
        {
            DisplayName = displayName,
            NormalizedName = displayName.ToLowerInvariant(),
            CreatedAtUtc = DateTime.UtcNow,
        };
        dbContext.Users.Add(rider);
        await dbContext.SaveChangesAsync();
        return rider;
    }

    private static BikeTrackingDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<BikeTrackingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new BikeTrackingDbContext(options);
    }
}
