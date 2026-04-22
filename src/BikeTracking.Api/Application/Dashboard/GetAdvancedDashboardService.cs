using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Dashboard;

public sealed class GetAdvancedDashboardService(BikeTrackingDbContext dbContext)
{
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

        var nowLocal = DateTime.Now;

        // Calendar time-window boundaries
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

        var reminders = new AdvancedDashboardReminders(
            MpgReminderRequired: settings?.AverageCarMpg is null,
            MileageRateReminderRequired: settings?.MileageRateCents is null
        );

        var savingsWindows = new AdvancedSavingsWindows(
            Weekly: BuildWindow("weekly", weeklyRides, gasPriceLookups),
            Monthly: BuildWindow("monthly", monthlyRides, gasPriceLookups),
            Yearly: BuildWindow("yearly", yearlyRides, gasPriceLookups),
            AllTime: BuildWindow("allTime", rides, gasPriceLookups)
        );

        var allTimeSavings = savingsWindows.AllTime;
        var suggestions = BuildSuggestions(rides, weeklyRides, allTimeSavings, nowLocal);

        return new AdvancedDashboardResponse(
            SavingsWindows: savingsWindows,
            Suggestions: suggestions,
            Reminders: reminders,
            GeneratedAtUtc: DateTime.UtcNow
        );
    }

    private static AdvancedSavingsWindow BuildWindow(
        string period,
        IReadOnlyList<Infrastructure.Persistence.Entities.RideEntity> windowRides,
        IReadOnlyList<Infrastructure.Persistence.Entities.GasPriceLookupEntity> gasPriceLookups
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

        return new AdvancedSavingsWindow(
            Period: period,
            RideCount: rideCount,
            TotalMiles: totalMiles,
            GallonsSaved: gallonsSaved,
            FuelCostAvoided: fuelCostAvoided,
            FuelCostEstimated: fuelCostEstimated,
            MileageRateSavings: mileageRateSavings,
            CombinedSavings: combinedSavings
        );
    }

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

    private static decimal RoundTo2(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
