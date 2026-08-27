using BikeTracking.Api.Application.Dashboard;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Api.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Tests.Application.Dashboard;

public sealed class GetAdvancedDashboardServiceTests
{
    // ── US1: Aggregate Savings ─────────────────────────────────────────────

    [Fact]
    public async Task GetAdvancedDashboardService_WithRidesInMultipleYears_ReturnsCorrectAllTimeGallonsSaved()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "MultiYear Rider");

        dbContext.Rides.AddRange(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2023, 6, 1),
                Miles = 20m,
                SnapshotAverageCarMpg = 20m,
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(2024, 3, 15),
                Miles = 10m,
                SnapshotAverageCarMpg = 10m,
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // 20 miles / 20 mpg = 1 gallon + 10 miles / 10 mpg = 1 gallon = 2 total
        Assert.Equal(2m, result.SavingsWindows.AllTime.GallonsSaved);
        Assert.Equal(2, result.SavingsWindows.AllTime.RideCount);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_WithRideMissingGasPrice_FlagsFuelCostEstimatedTrue()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "MissingGasPrice Rider");

        // Gas price lookup for fallback
        var rideDate = DateOnly.FromDateTime(DateTime.Now);
        dbContext.GasPriceLookups.Add(
            new GasPriceLookupEntity
            {
                PriceDate = rideDate.AddDays(-1),
                WeekStartDate = rideDate.AddDays(-7),
                EiaPeriodDate = rideDate.AddDays(-1),
                PricePerGallon = 3.50m,
                DataSource = "test",
                RetrievedAtUtc = DateTime.UtcNow,
            }
        );

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 10m,
                SnapshotAverageCarMpg = 20m,
                GasPricePerGallon = null, // missing — triggers fallback
                SnapshotMileageRateCents = 67m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.True(result.SavingsWindows.AllTime.FuelCostEstimated);
        Assert.NotNull(result.SavingsWindows.AllTime.FuelCostAvoided);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_UserWithNoMpgSetting_ReturnsMpgReminderRequired()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "NoMpg Rider");

        // Settings without AverageCarMpg
        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                AverageCarMpg = null,
                MileageRateCents = 67m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.True(result.Reminders.MpgReminderRequired);
        Assert.False(result.Reminders.MileageRateReminderRequired);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_UserWithNoMileageRateSetting_ReturnsMileageRateReminderRequired()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "NoMileageRate Rider");

        // Settings without MileageRateCents
        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                AverageCarMpg = 30m,
                MileageRateCents = null,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.False(result.Reminders.MpgReminderRequired);
        Assert.True(result.Reminders.MileageRateReminderRequired);
    }

    // ── US2: Time Windows ─────────────────────────────────────────────────

    [Fact]
    public async Task GetAdvancedDashboardService_WithRidesInMultipleWindows_ReturnsCorrectGallonsSavedPerWindow()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Windows Rider");

        var now = DateTime.Now;
        var weekStart = now.Date.AddDays(-(((int)now.DayOfWeek - 1 + 7) % 7));

        dbContext.Rides.AddRange(
            // This week
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = weekStart,
                Miles = 10m,
                SnapshotAverageCarMpg = 10m,
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            // Last year (all-time only)
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(now.Year - 1, 6, 1),
                Miles = 20m,
                SnapshotAverageCarMpg = 20m,
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // Weekly: only the current-week ride (1 gallon)
        Assert.Equal(1m, result.SavingsWindows.Weekly.GallonsSaved);
        // All-time: both rides (1 + 1 = 2 gallons)
        Assert.Equal(2m, result.SavingsWindows.AllTime.GallonsSaved);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_PartialMonthRides_HandlesZeroDivisionGracefully()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "PartialMonth Rider");

        // Ride with SnapshotAverageCarMpg = 0 should be excluded gracefully
        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(DateTime.Now.Year, DateTime.Now.Month, 1),
                Miles = 10m,
                SnapshotAverageCarMpg = 0m, // zero — must not divide
                GasPricePerGallon = 3m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // Zero MPG rides should contribute null (not throw)
        Assert.Null(result.SavingsWindows.Monthly.GallonsSaved);
        Assert.Null(result.SavingsWindows.Monthly.FuelCostAvoided);
    }

    // ── US3: Suggestions ──────────────────────────────────────────────────

    [Fact]
    public async Task GetAdvancedDashboardService_RideThisWeek_ConsistencySuggestionEnabled()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Consistency Rider");

        // Fixed reference "now" (a Wednesday) removes dependency on wall-clock time so this
        // test can't flip near a real week boundary.
        var fixedNow = new DateTime(2026, 1, 14, 12, 0, 0, DateTimeKind.Utc);
        var timeProvider = new FakeTimeProvider(fixedNow);
        var weekStart = fixedNow.Date.AddDays(-(((int)fixedNow.DayOfWeek - 1 + 7) % 7));

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = weekStart,
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, timeProvider);
        var result = await service.GetAsync(rider.UserId);

        var consistency = result.Suggestions.Single(s => s.SuggestionKey == "consistency");
        Assert.True(consistency.IsEnabled);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_CombinedSavingsExceed50_MilestoneSuggestionEnabled()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Milestone Rider");

        // Mileage rate savings: 100 miles × 67 = 6700 > 50
        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now.AddMonths(-6),
                Miles = 100m,
                SnapshotMileageRateCents = 67m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        var milestone = result.Suggestions.Single(s => s.SuggestionKey == "milestone");
        Assert.True(milestone.IsEnabled);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_LastRideMoreThan7DaysAgo_ComebackSuggestionEnabled()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Comeback Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now.AddDays(-10),
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        var comeback = result.Suggestions.Single(s => s.SuggestionKey == "comeback");
        Assert.True(comeback.IsEnabled);
    }

    // ── Edge Cases ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAdvancedDashboardService_UserWithNoRides_ReturnsZeroValuesGracefully()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "No Rides Rider");

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.Equal(0, result.SavingsWindows.AllTime.RideCount);
        Assert.Null(result.SavingsWindows.AllTime.GallonsSaved);
        Assert.Null(result.SavingsWindows.AllTime.FuelCostAvoided);
        Assert.Null(result.SavingsWindows.AllTime.MileageRateSavings);
        Assert.Null(result.SavingsWindows.AllTime.CombinedSavings);

        var comeback = result.Suggestions.Single(s => s.SuggestionKey == "comeback");
        Assert.False(comeback.IsEnabled);

        var consistency = result.Suggestions.Single(s => s.SuggestionKey == "consistency");
        Assert.False(consistency.IsEnabled);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_NoSettings_BothReminderFlagsSet()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "NoSettings Rider");

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // No UserSettings row means both nulls
        Assert.True(result.Reminders.MpgReminderRequired);
        Assert.True(result.Reminders.MileageRateReminderRequired);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_ResponseIncludesAllThreeSuggestions()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "AllSuggestions Rider");

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.Equal(3, result.Suggestions.Count);
        Assert.Contains(result.Suggestions, s => s.SuggestionKey == "consistency");
        Assert.Contains(result.Suggestions, s => s.SuggestionKey == "milestone");
        Assert.Contains(result.Suggestions, s => s.SuggestionKey == "comeback");
    }

    [Fact]
    public async Task GetAdvancedDashboardService_MileageRateSavings_ComputedCorrectly()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "MileageRate Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now.AddMonths(-1),
                Miles = 10m,
                SnapshotMileageRateCents = 67m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // 10 miles × 67 = 670
        Assert.Equal(670m, result.SavingsWindows.AllTime.MileageRateSavings);
    }

    // ── US5: Expenses in Savings Breakdown ────────────────────────────────

    [Fact]
    public async Task GetAdvancedDashboardService_WithExpensesInWindow_IncludesExpensesInCorrectWindow()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Expenses Window Rider");

        var now = DateTime.Now;
        var monthStart = new DateTime(now.Year, now.Month, 1);
        var monthEnd = monthStart.AddMonths(1);
        var weekStart = now.Date.AddDays(-(((int)now.DayOfWeek - 1 + 7) % 7));
        var weekEnd = weekStart.AddDays(7);

        // Expense in current month, but deliberately outside the current week
        // window (the service treats the week as Mon–Sun local time), so the
        // test's window differentiation holds regardless of what day "now" is.
        var monthOnlyExpenseDate = monthStart.AddDays(1);
        if (monthOnlyExpenseDate >= weekStart && monthOnlyExpenseDate < weekEnd)
        {
            monthOnlyExpenseDate = weekEnd < monthEnd ? weekEnd : monthStart;
        }

        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = rider.UserId,
                ExpenseDate = monthOnlyExpenseDate,
                Amount = 50m,
                IsDeleted = false,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        // Expense in last year — should NOT appear in monthly or weekly window
        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = rider.UserId,
                ExpenseDate = new DateTime(now.Year - 1, 6, 1),
                Amount = 200m,
                IsDeleted = false,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.Equal(50m, result.SavingsWindows.Monthly.TotalExpenses);
        Assert.Equal(250m, result.SavingsWindows.AllTime.TotalExpenses);
        Assert.Equal(0m, result.SavingsWindows.Weekly.TotalExpenses);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_WithFuelCostAndMileageRate_NetSavingsUsesFuelCostOnly()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "NetSavings Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now.AddMonths(-3),
                Miles = 100m,
                SnapshotAverageCarMpg = 20m,
                GasPricePerGallon = 3m,
                SnapshotMileageRateCents = 67m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        // $30 expense — should reduce all-time net savings
        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = rider.UserId,
                ExpenseDate = DateTime.Now.AddMonths(-3),
                Amount = 30m,
                IsDeleted = false,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // 100 miles / 20 mpg × $3 = $15 fuel cost avoided - $30 expenses = -$15 net
        // Mileage-rate savings still exists, but it does not feed net savings.
        Assert.Equal(15m, result.SavingsWindows.AllTime.FuelCostAvoided);
        Assert.Equal(6700m, result.SavingsWindows.AllTime.MileageRateSavings);
        Assert.Equal(6715m, result.SavingsWindows.AllTime.CombinedSavings);
        Assert.Equal(30m, result.SavingsWindows.AllTime.TotalExpenses);
        Assert.Equal(-15m, result.SavingsWindows.AllTime.NetSavings);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_ExpensesExceedSavings_NetSavingsIsNegative()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Negative NetSavings Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now.AddMonths(-1),
                Miles = 10m,
                SnapshotMileageRateCents = 67m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        // 700 expense exceeds 10 × 67 = 670 savings
        dbContext.Expenses.Add(
            new ExpenseEntity
            {
                RiderId = rider.UserId,
                ExpenseDate = DateTime.Now.AddMonths(-1),
                Amount = 700m,
                IsDeleted = false,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // Net savings should be negative: 670 - 700 = -30
        Assert.NotNull(result.SavingsWindows.AllTime.NetSavings);
        Assert.True(result.SavingsWindows.AllTime.NetSavings < 0m);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_WithOilChangePrice_IncludesWindowedOilChangeSavings()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "OilChange Rider");

        // Settings with oil change price
        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                OilChangePrice = 40m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        var now = DateTime.Now;
        var yearStart = new DateTime(now.Year, 1, 1);

        // Add rides this year that accumulate >3000 miles (crosses one oil change interval)
        dbContext.Rides.AddRange(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = yearStart.AddDays(10),
                Miles = 1600m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = yearStart.AddDays(20),
                Miles = 1600m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // 3200 miles total — crosses one 3000-mile interval → 1 oil change × $40 = $40
        Assert.Equal(40m, result.SavingsWindows.AllTime.OilChangeSavings);
        Assert.Equal(40m, result.SavingsWindows.Yearly.OilChangeSavings);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_WithNoOilChangePrice_OilChangeSavingsIsNull()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "NoOilChange Rider");

        // Settings without OilChangePrice
        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                OilChangePrice = null,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now.AddDays(-5),
                Miles = 5000m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.Null(result.SavingsWindows.AllTime.OilChangeSavings);
    }

    // ── CO2 Savings (Feature 029) ───────────────────────────────────────────

    [Fact]
    public async Task GetAdvancedDashboardService_WithRidesAcrossWindows_ReturnsCo2SavedEqualToTotalMilesTimesFactorOnAllFourWindows()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Co2 Windows Rider");

        var now = DateTime.Now;
        var weekStart = now.Date.AddDays(-(((int)now.DayOfWeek - 1 + 7) % 7));

        dbContext.Rides.AddRange(
            // This week (also counts toward month/year/all-time)
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = weekStart,
                Miles = 10m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            // Earlier this year but before this week (counts toward year/all-time only)
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(now.Year, 1, 1),
                Miles = 5m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            // Last year (all-time only)
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(now.Year - 1, 6, 1),
                Miles = 20m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        var windows = result.SavingsWindows;
        AssertCo2SavedMatchesMiles(windows.Weekly);
        AssertCo2SavedMatchesMiles(windows.Monthly);
        AssertCo2SavedMatchesMiles(windows.Yearly);
        AssertCo2SavedMatchesMiles(windows.AllTime);

        static void AssertCo2SavedMatchesMiles(AdvancedSavingsWindow window)
        {
            var expected = Math.Round(window.TotalMiles * 0.90m, 2, MidpointRounding.AwayFromZero);
            Assert.Equal(expected, window.Co2Saved, 2);
        }
    }

    [Fact]
    public async Task GetAdvancedDashboardService_ZeroMileWindow_ReturnsCo2SavedZeroNotNull()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Co2 ZeroMile Rider");

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        // No rides at all — every window has zero miles.
        Assert.Equal(0.00m, result.SavingsWindows.Weekly.Co2Saved);
        Assert.Equal(0.00m, result.SavingsWindows.Monthly.Co2Saved);
        Assert.Equal(0.00m, result.SavingsWindows.Yearly.Co2Saved);
        Assert.Equal(0.00m, result.SavingsWindows.AllTime.Co2Saved);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_RiderMpgAndMileageRateSettingsChange_DoesNotAffectCo2Saved()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Co2 SettingsIndependent Rider");

        dbContext.Rides.Add(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 10m,
                // No MPG/mileage-rate snapshot at all — CO2 must still be computed from miles.
                SnapshotAverageCarMpg = null,
                SnapshotMileageRateCents = null,
                GasPricePerGallon = null,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var serviceWithoutSettings = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var resultWithoutSettings = await serviceWithoutSettings.GetAsync(rider.UserId);

        dbContext.UserSettings.Add(
            new UserSettingsEntity
            {
                UserId = rider.UserId,
                AverageCarMpg = 45m,
                MileageRateCents = 70m,
                UpdatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var serviceWithSettings = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var resultWithSettings = await serviceWithSettings.GetAsync(rider.UserId);

        Assert.Equal(9.00m, resultWithoutSettings.SavingsWindows.AllTime.Co2Saved);
        Assert.Equal(
            resultWithoutSettings.SavingsWindows.AllTime.Co2Saved,
            resultWithSettings.SavingsWindows.AllTime.Co2Saved
        );
    }

    [Fact]
    public async Task GetAdvancedDashboardService_ZeroRides_ReturnsCo2SavedPerMileLbsOfNinetyHundredths()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Co2 PerMile ZeroRides Rider");

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        Assert.Equal(0.90m, result.Co2SavedPerMileLbs);
    }

    [Fact]
    public async Task GetAdvancedDashboardService_ForEachWindow_Co2SavedEqualsPerMileFactorTimesTotalMiles()
    {
        using var dbContext = CreateDbContext();
        var rider = await CreateRiderAsync(dbContext, "Co2 CrossCheck Rider");

        dbContext.Rides.AddRange(
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = DateTime.Now,
                Miles = 7.3m,
                CreatedAtUtc = DateTime.UtcNow,
            },
            new RideEntity
            {
                RiderId = rider.UserId,
                RideDateTimeLocal = new DateTime(DateTime.Now.Year - 1, 3, 1),
                Miles = 13.6m,
                CreatedAtUtc = DateTime.UtcNow,
            }
        );
        await dbContext.SaveChangesAsync();

        var service = new GetAdvancedDashboardService(dbContext, TimeProvider.System);
        var result = await service.GetAsync(rider.UserId);

        foreach (
            var window in new[]
            {
                result.SavingsWindows.Weekly,
                result.SavingsWindows.Monthly,
                result.SavingsWindows.Yearly,
                result.SavingsWindows.AllTime,
            }
        )
        {
            var expected = Math.Round(
                result.Co2SavedPerMileLbs * window.TotalMiles,
                2,
                MidpointRounding.AwayFromZero
            );
            Assert.Equal(expected, window.Co2Saved, 2);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static async Task<UserEntity> CreateRiderAsync(
        BikeTrackingDbContext dbContext,
        string displayName
    )
    {
        var rider = new UserEntity
        {
            DisplayName = displayName,
            NormalizedName = displayName.ToLower(),
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
