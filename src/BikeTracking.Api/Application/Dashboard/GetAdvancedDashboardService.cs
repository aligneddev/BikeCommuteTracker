using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Domain.FSharp;
using Microsoft.EntityFrameworkCore;
using Microsoft.FSharp.Collections;
using Microsoft.FSharp.Core;

namespace BikeTracking.Api.Application.Dashboard;

/// <summary>
/// Returns advanced statistics for the authenticated user including savings broken down
/// by weekly, monthly, yearly, and all-time calendar windows, personalised suggestions,
/// and reminder flags when required user settings are missing.
/// </summary>
public sealed class GetAdvancedDashboardService(BikeTrackingDbContext dbContext)
{
    /// <summary>
    /// Loads all rides, user settings, and gas-price lookups for <paramref name="riderId"/>,
    /// then computes savings windows, rule-based suggestions, and reminder flags.
    /// </summary>
    /// <param name="riderId">The internal user ID of the authenticated rider.</param>
    /// <param name="cancellationToken">Token to cancel the async operation.</param>
    /// <returns>A fully populated <see cref="AdvancedDashboardResponse"/>.</returns>
    public async Task<AdvancedDashboardResponse> GetAsync(
        long riderId,
        CancellationToken cancellationToken = default
    )
    {
        var rides = await dbContext
            .Rides.Where(ride => ride.RiderId == riderId)
            .OrderBy(ride => ride.RideDateTimeLocal)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var settings = await dbContext
            .UserSettings.AsNoTracking()
            .SingleOrDefaultAsync(s => s.UserId == riderId, cancellationToken);

        var gasPriceLookups = await dbContext
            .GasPriceLookups.AsNoTracking()
            .OrderByDescending(g => g.PriceDate)
            .ToListAsync(cancellationToken);

        var expenses = await dbContext
            .Expenses.Where(e => e.RiderId == riderId && !e.IsDeleted)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var nowLocal = DateTime.Now;

        // Calendar-based windows (not rolling) for consistency with the main dashboard.
        // Using calendar periods means "this week" always starts on Monday, "this month"
        // on the 1st, and "this year" on Jan 1 — matching how users think about time.
        // Rolling windows (e.g. last 7 days) were rejected to avoid diverging from the
        // main dashboard's monthly/yearly totals. See research.md Decision 1.
        var weekStart = nowLocal.Date.AddDays(-(((int)nowLocal.DayOfWeek - 1 + 7) % 7));
        var weekEnd = weekStart.AddDays(7);
        var monthStart = new DateTime(nowLocal.Year, nowLocal.Month, 1);
        var monthEnd = monthStart.AddMonths(1);
        var yearStart = new DateTime(nowLocal.Year, 1, 1);
        var yearEnd = yearStart.AddYears(1);

        var weeklyRides = rides
            .Where(r => r.RideDateTimeLocal >= weekStart && r.RideDateTimeLocal < weekEnd)
            .ToList();
        var monthlyRides = rides
            .Where(r => r.RideDateTimeLocal >= monthStart && r.RideDateTimeLocal < monthEnd)
            .ToList();
        var yearlyRides = rides
            .Where(r => r.RideDateTimeLocal >= yearStart && r.RideDateTimeLocal < yearEnd)
            .ToList();

        // Cumulative miles before each window start — used to compute windowed oil-change intervals.
        var milesBeforeWeekStart = rides
            .Where(r => r.RideDateTimeLocal < weekStart)
            .Sum(r => r.Miles);
        var milesBeforeMonthStart = rides
            .Where(r => r.RideDateTimeLocal < monthStart)
            .Sum(r => r.Miles);
        var milesBeforeYearStart = rides
            .Where(r => r.RideDateTimeLocal < yearStart)
            .Sum(r => r.Miles);

        var reminders = new AdvancedDashboardReminders(
            MpgReminderRequired: settings?.AverageCarMpg is null,
            MileageRateReminderRequired: settings?.MileageRateCents is null
        );

        var savingsWindows = new AdvancedSavingsWindows(
            Weekly: BuildWindow(
                "weekly",
                weeklyRides,
                gasPriceLookups,
                expenses,
                weekStart,
                weekEnd,
                milesBeforeWeekStart,
                settings?.OilChangePrice
            ),
            Monthly: BuildWindow(
                "monthly",
                monthlyRides,
                gasPriceLookups,
                expenses,
                monthStart,
                monthEnd,
                milesBeforeMonthStart,
                settings?.OilChangePrice
            ),
            Yearly: BuildWindow(
                "yearly",
                yearlyRides,
                gasPriceLookups,
                expenses,
                yearStart,
                yearEnd,
                milesBeforeYearStart,
                settings?.OilChangePrice
            ),
            AllTime: BuildWindow(
                "allTime",
                rides,
                gasPriceLookups,
                expenses,
                windowStart: null,
                windowEnd: null,
                cumulativeMilesBeforeWindow: 0m,
                settings?.OilChangePrice
            )
        );

        var allTimeSavings = savingsWindows.AllTime;
        var suggestions = BuildSuggestions(rides, weeklyRides, allTimeSavings, nowLocal);

        var difficultySection = BuildDifficultySection(rides);

        return new AdvancedDashboardResponse(
            SavingsWindows: savingsWindows,
            Suggestions: suggestions,
            Reminders: reminders,
            GeneratedAtUtc: DateTime.UtcNow,
            DifficultySection: difficultySection
        );
    }

    /// <summary>
    /// Aggregates savings metrics for a set of rides within a named time window.
    /// Uses per-ride snapshots (MPG, mileage rate) for historical accuracy — if a user
    /// changes their settings, past savings are not retroactively altered (Decision 2/4).
    /// When <c>GasPricePerGallon</c> is null on a ride, the most recent gas-price lookup
    /// on or before the ride date is used as a fallback and the estimated flag is set (Decision 3).
    /// Expenses are filtered by <c>ExpenseDate</c> within the window's date range.
    /// Oil-change savings are computed by counting 3000-mile interval crossings during the window.
    /// </summary>
    private static AdvancedSavingsWindow BuildWindow(
        string period,
        IReadOnlyList<Infrastructure.Persistence.Entities.RideEntity> windowRides,
        IReadOnlyList<Infrastructure.Persistence.Entities.GasPriceLookupEntity> gasPriceLookups,
        IReadOnlyList<Infrastructure.Persistence.Entities.ExpenseEntity> allExpenses,
        DateTime? windowStart,
        DateTime? windowEnd,
        decimal cumulativeMilesBeforeWindow,
        decimal? oilChangePrice
    )
    {
        var totalMiles = windowRides.Sum(r => r.Miles);
        var rideCount = windowRides.Count;

        decimal gallonsSum = 0m;
        bool hasGallons = false;

        decimal fuelCostSum = 0m;
        bool hasFuelCost = false;
        bool fuelCostEstimated = false;

        decimal mileageRateSum = 0m;
        bool hasMileageRate = false;

        foreach (var ride in windowRides)
        {
            if (ride.SnapshotAverageCarMpg is decimal mpg && mpg > 0m)
            {
                var gallons = ride.Miles / mpg;
                gallonsSum += gallons;
                hasGallons = true;

                decimal? gasPrice = ride.GasPricePerGallon;
                if (gasPrice is null)
                {
                    // Find most recent fallback gas price on or before ride date
                    var rideDate = DateOnly.FromDateTime(ride.RideDateTimeLocal);
                    var fallback = gasPriceLookups.FirstOrDefault(g => g.PriceDate <= rideDate);
                    if (fallback is not null)
                    {
                        gasPrice = fallback.PricePerGallon;
                        fuelCostEstimated = true;
                    }
                }

                if (gasPrice.HasValue)
                {
                    fuelCostSum += gallons * gasPrice.Value;
                    hasFuelCost = true;
                }
            }

            if (ride.SnapshotMileageRateCents is decimal rateCents)
            {
                mileageRateSum += ride.Miles * rateCents / 100m;
                hasMileageRate = true;
            }
        }

        decimal? gallonsSaved = hasGallons ? RoundTo2(gallonsSum) : null;
        decimal? fuelCostAvoided = hasFuelCost ? RoundTo2(fuelCostSum) : null;
        decimal? mileageRateSavings = hasMileageRate ? RoundTo2(mileageRateSum) : null;
        decimal? combinedSavings =
            fuelCostAvoided.HasValue || mileageRateSavings.HasValue
                ? RoundTo2((fuelCostAvoided ?? 0m) + (mileageRateSavings ?? 0m))
                : null;

        // Expenses within this window (filtered by ExpenseDate; null bounds = all-time)
        var totalExpenses = allExpenses
            .Where(e =>
                (windowStart is null || e.ExpenseDate >= windowStart.Value)
                && (windowEnd is null || e.ExpenseDate < windowEnd.Value)
            )
            .Sum(e => e.Amount);
        totalExpenses = RoundTo2(totalExpenses);

        // Oil-change savings for this window: count 3000-mile intervals crossed during the window.
        // A crossing occurs when cumulative miles at window end passes a multiple of 3000
        // that was not yet reached at window start.
        decimal? oilChangeSavings = null;
        if (oilChangePrice.HasValue)
        {
            var milesInWindow = windowRides.Sum(r => r.Miles);
            var cumulativeAtEnd = cumulativeMilesBeforeWindow + milesInWindow;
            var intervalsBefore = (int)Math.Floor(cumulativeMilesBeforeWindow / 3000m);
            var intervalsAtEnd = (int)Math.Floor(cumulativeAtEnd / 3000m);
            var crossings = intervalsAtEnd - intervalsBefore;
            oilChangeSavings = crossings > 0 ? RoundTo2(crossings * oilChangePrice.Value) : 0m;
        }

        // Net savings: gross savings + oil-change offset − expenses.
        // Null only when all savings are unavailable and there are no expenses.
        decimal? netSavings = null;
        bool hasSavingsData = combinedSavings.HasValue || oilChangeSavings.HasValue;
        if (hasSavingsData || totalExpenses > 0m)
        {
            netSavings = RoundTo2(
                (combinedSavings ?? 0m) + (oilChangeSavings ?? 0m) - totalExpenses
            );
        }

        return new AdvancedSavingsWindow(
            Period: period,
            RideCount: rideCount,
            TotalMiles: totalMiles,
            GallonsSaved: gallonsSaved,
            FuelCostAvoided: fuelCostAvoided,
            FuelCostEstimated: fuelCostEstimated,
            MileageRateSavings: mileageRateSavings,
            CombinedSavings: combinedSavings,
            TotalExpenses: totalExpenses,
            OilChangeSavings: oilChangeSavings,
            NetSavings: netSavings
        );
    }

    /// <summary>
    /// Produces the three deterministic rule-based suggestions: consistency (rode this week),
    /// milestone (combined savings crossed a threshold), and comeback (inactive &gt; 7 days).
    /// All three are always returned; <c>IsEnabled</c> reflects whether the condition is met.
    /// See research.md Decision 5 for threshold values and trigger conditions.
    /// </summary>
    private static IReadOnlyList<AdvancedDashboardSuggestion> BuildSuggestions(
        IReadOnlyList<Infrastructure.Persistence.Entities.RideEntity> allRides,
        IReadOnlyList<Infrastructure.Persistence.Entities.RideEntity> weeklyRides,
        AdvancedSavingsWindow allTimeWindow,
        DateTime nowLocal
    )
    {
        // Consistency: ≥1 ride this calendar week
        var consistencyEnabled = weeklyRides.Count >= 1;
        var weeklyRideCount = weeklyRides.Count;

        // Milestone: all-time combined savings crosses a threshold
        var allTimeCombined = allTimeWindow.CombinedSavings ?? 0m;
        decimal[] milestones = [10m, 50m, 100m, 500m];
        var highestCrossed = milestones
            .Where(t => allTimeCombined >= t)
            .Select(t => (decimal?)t)
            .LastOrDefault();
        var milestoneEnabled = highestCrossed.HasValue;

        // Comeback: last ride > 7 days ago and has at least 1 prior ride
        var lastRide = allRides.Count > 0 ? allRides[^1] : null;
        var daysSinceLastRide = lastRide is not null
            ? (nowLocal.Date - lastRide.RideDateTimeLocal.Date).Days
            : 0;
        var comebackEnabled = allRides.Count >= 1 && daysSinceLastRide > 7;

        return
        [
            new AdvancedDashboardSuggestion(
                SuggestionKey: "consistency",
                Title: "Great Consistency!",
                Description: consistencyEnabled
                    ? $"You've biked {weeklyRideCount} time(s) this week — keep it up!"
                    : "Ride at least once this week to build your streak.",
                IsEnabled: consistencyEnabled
            ),
            new AdvancedDashboardSuggestion(
                SuggestionKey: "milestone",
                Title: "Savings Milestone",
                Description: milestoneEnabled
                    ? $"You've saved over ${highestCrossed!.Value:0} biking instead of driving!"
                    : "Save $10 in combined fuel and mileage costs to hit your first milestone.",
                IsEnabled: milestoneEnabled
            ),
            new AdvancedDashboardSuggestion(
                SuggestionKey: "comeback",
                Title: "Comeback Ride",
                Description: comebackEnabled
                    ? $"It's been {daysSinceLastRide} days since your last ride — hop back on!"
                    : "You're on a roll! Keep riding regularly.",
                IsEnabled: comebackEnabled
            ),
        ];
    }

    /// <summary>Rounds a decimal value to 2 places using standard rounding (0.5 rounds up).</summary>
    private static decimal RoundTo2(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>
    /// Builds the difficulty analytics section from all rides.
    /// Projects rides to RideDifficultySnapshot, calls F# calculation functions,
    /// and returns an AdvancedDashboardDifficultySection.
    /// </summary>
    private static AdvancedDashboardDifficultySection BuildDifficultySection(
        IReadOnlyList<Infrastructure.Persistence.Entities.RideEntity> rides
    )
    {
        var snapshots = rides
            .Select(r => new AdvancedDashboardCalculations.RideDifficultySnapshot(
                RideDate: r.RideDateTimeLocal,
                Difficulty: r.Difficulty.HasValue
                    ? FSharpOption<int>.Some(r.Difficulty.Value)
                    : FSharpOption<int>.None,
                WindResistanceRating: r.WindResistanceRating.HasValue
                    ? FSharpOption<int>.Some(r.WindResistanceRating.Value)
                    : FSharpOption<int>.None,
                WindSpeedMph: r.WindSpeedMph.HasValue
                    ? FSharpOption<decimal>.Some(r.WindSpeedMph.Value)
                    : FSharpOption<decimal>.None,
                PrimaryTravelDirection: r.PrimaryTravelDirection is not null
                    ? FSharpOption<string>.Some(r.PrimaryTravelDirection)
                    : FSharpOption<string>.None,
                WindDirectionDeg: r.WindDirectionDeg.HasValue
                    ? FSharpOption<int>.Some(r.WindDirectionDeg.Value)
                    : FSharpOption<int>.None
            ))
            .ToList();

        var fsharpList = ListModule.OfSeq(snapshots);

        var overallAverage = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(
            fsharpList
        );
        var byMonthSeq = AdvancedDashboardCalculations.calculateDifficultyByMonth(fsharpList);
        var distributionSeq = AdvancedDashboardCalculations.calculateWindResistanceDistribution(
            fsharpList
        );

        var difficultyByMonth = byMonthSeq
            .Select(r => new DifficultyByMonth(
                r.MonthNumber,
                r.MonthName,
                r.AverageDifficulty,
                r.RideCount
            ))
            .ToList();

        var mostDifficultMonths = difficultyByMonth
            .OrderByDescending(r => r.AverageDifficulty)
            .ThenByDescending(r => r.MonthNumber)
            .ToList();

        var windResistanceBins = distributionSeq
            .Select(b => new WindResistanceBin(
                Rating: b.Rating,
                RideCount: b.RideCount,
                Label: GetWindResistanceLabel(b.Rating),
                IsAssisted: b.Rating < 0
            ))
            .ToList();

        var isEmpty = !OptionModule.IsSome(overallAverage) && difficultyByMonth.Count == 0;

        return new AdvancedDashboardDifficultySection(
            OverallAverageDifficulty: OptionModule.IsSome(overallAverage)
                ? overallAverage.Value
                : null,
            DifficultyByMonth: difficultyByMonth,
            MostDifficultMonths: mostDifficultMonths,
            WindResistanceDistribution: windResistanceBins,
            IsEmpty: isEmpty
        );
    }

    private static string GetWindResistanceLabel(int rating) =>
        rating switch
        {
            -4 => "\u22124 (strong tailwind)",
            -3 => "\u22123 (tailwind)",
            -2 => "\u22122 (tailwind)",
            -1 => "\u22121 (light tailwind)",
            0 => "0 (neutral)",
            1 => "+1 (light headwind)",
            2 => "+2 (headwind)",
            3 => "+3 (headwind)",
            4 => "+4 (strong headwind)",
            _ => $"{(rating > 0 ? "+" : "")}{rating}",
        };
}
