using System.Globalization;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp;
using Microsoft.EntityFrameworkCore;
using Microsoft.FSharp.Core;

namespace BikeTracking.Api.Application.Dashboard;

/// <summary>
/// Returns mileage, savings, difficulty, and wind-resistance analytics scoped to a single
/// calendar year (Jan-Dec), rather than a rolling window (<see cref="GetDashboardService"/>)
/// or an all-time/calendar-window breakdown (<see cref="GetAdvancedDashboardService"/>).
/// Reuses difficulty/wind F# calculations while keeping savings aggregation aligned with
/// current dashboard settings and monthly/yearly mileage totals.
/// </summary>
public sealed class GetYearStatsDashboardService(
    BikeTrackingDbContext dbContext,
    TimeProvider timeProvider
)
{
    /// <summary>
    /// Loads the rider's rides for <paramref name="year"/> and returns the year-scoped
    /// mileage, savings, difficulty, and wind-resistance sections.
    /// </summary>
    public async Task<YearStatsDashboardResponse> GetAsync(
        long riderId,
        int year,
        CancellationToken cancellationToken = default
    )
    {
        var yearStart = new DateTime(year, 1, 1);
        var nextYearStart = yearStart.AddYears(1);

        var rides = await dbContext
            .Rides.Where(ride =>
                ride.RiderId == riderId
                && ride.RideDateTimeLocal >= yearStart
                && ride.RideDateTimeLocal < nextYearStart
            )
            .OrderBy(ride => ride.RideDateTimeLocal)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var hasDataForYear = rides.Count > 0;

        var settings = await dbContext
            .UserSettings.AsNoTracking()
            .SingleOrDefaultAsync(setting => setting.UserId == riderId, cancellationToken);

        var totalManualExpenses =
            await dbContext
                .Expenses.Where(e =>
                    e.RiderId == riderId
                    && !e.IsDeleted
                    && e.ExpenseDate >= yearStart
                    && e.ExpenseDate < nextYearStart
                )
                .SumAsync(e => (decimal?)e.Amount, cancellationToken)
            ?? 0m;

        return new YearStatsDashboardResponse(
            Year: year,
            HasDataForYear: hasDataForYear,
            Totals: BuildTotalsSection(
                rides,
                totalManualExpenses,
                settings?.OilChangePrice,
                settings?.MileageRateCents
            ),
            MileageByMonth: BuildMileageSeries(rides, year),
            SavingsByMonth: BuildSavingsSeries(rides, year, settings?.MileageRateCents),
            Difficulty: BuildDifficultySection(rides, year),
            WindResistance: BuildWindResistanceSection(rides, year)
        );
    }

    private static YearStatsTotals BuildTotalsSection(
        IReadOnlyList<RideEntity> rides,
        decimal totalManualExpenses,
        decimal? oilChangePrice,
        decimal? mileageRateCents
    )
    {
        var totalMiles = rides.Sum(ride => ride.Miles);
        var savings = SavingsCalculationRules.AggregateSavings(rides, mileageRateCents);
        decimal? totalCombinedSavings = savings.HasAnySavings
            ? SavingsCalculationRules.RoundMoney(savings.MileageRateSavings + savings.FuelCostAvoided)
            : null;

        return new YearStatsTotals(
            TotalMiles: totalMiles,
            TotalCombinedSavings: totalCombinedSavings,
            ExpenseSummary: SavingsCalculationRules.CalculateExpenseSummary(totalManualExpenses, totalMiles, oilChangePrice),
            TotalRideMinutes: RidingTimeRules.SumRecordedRideMinutes(rides)
        );
    }

    /// <summary>
    /// Returns the distinct years for which the rider has at least one ride, descending.
    /// Falls back to <c>[currentYear]</c> when the rider has no rides at all (FR-002/FR-008).
    /// </summary>
    public async Task<AvailableYearsResponse> GetAvailableYearsAsync(
        long riderId,
        CancellationToken cancellationToken = default
    )
    {
        var years = await dbContext
            .Rides.Where(ride => ride.RiderId == riderId)
            .AsNoTracking()
            .Select(ride => ride.RideDateTimeLocal.Year)
            .Distinct()
            .ToListAsync(cancellationToken);

        var descendingYears = years.OrderByDescending(y => y).ToList();

        return new AvailableYearsResponse(
            descendingYears.Count > 0 ? descendingYears : [timeProvider.GetLocalNow().Year]
        );
    }

    private static IReadOnlyList<YearStatsMileagePoint> BuildMileageSeries(
        IReadOnlyList<RideEntity> rides,
        int year
    )
    {
        return EnumerateMonthsOfYear(year)
            .Select(month =>
            {
                var monthMiles = rides
                    .Where(ride => DashboardMonthRules.IsWithinMonth(ride.RideDateTimeLocal, year, month))
                    .Sum(ride => ride.Miles);

                return new YearStatsMileagePoint(
                    MonthKey: DashboardMonthRules.GetMonthKey(year, month),
                    Label: new DateTime(year, month, 1).ToString(
                        "MMM",
                        CultureInfo.InvariantCulture
                    ),
                    Miles: monthMiles
                );
            })
            .ToList();
    }

    private static IReadOnlyList<YearStatsSavingsPoint> BuildSavingsSeries(
        IReadOnlyList<RideEntity> rides,
        int year,
        decimal? mileageRateCents
    )
    {
        return EnumerateMonthsOfYear(year)
            .Select(month =>
            {
                var monthRides = rides
                    .Where(ride => DashboardMonthRules.IsWithinMonth(ride.RideDateTimeLocal, year, month))
                    .ToList();

                var savings = SavingsCalculationRules.AggregateSavings(monthRides, mileageRateCents);
                decimal? combinedSavings = savings.HasAnySavings
                    ? savings.MileageRateSavings + savings.FuelCostAvoided
                    : null;

                return new YearStatsSavingsPoint(
                    MonthKey: DashboardMonthRules.GetMonthKey(year, month),
                    Label: new DateTime(year, month, 1).ToString(
                        "MMM",
                        CultureInfo.InvariantCulture
                    ),
                    MileageRateSavings: savings.HasMileageRateSavings
                        ? SavingsCalculationRules.RoundMoney(savings.MileageRateSavings)
                        : null,
                    FuelCostAvoided: savings.HasFuelCostAvoided
                        ? SavingsCalculationRules.RoundMoney(savings.FuelCostAvoided)
                        : null,
                    CombinedSavings: SavingsCalculationRules.RoundMoney(combinedSavings)
                );
            })
            .ToList();
    }

    private static YearStatsDifficultySection BuildDifficultySection(
        IReadOnlyList<RideEntity> rides,
        int year
    )
    {
        var fsharpList = RideDifficultyRules.ToSnapshots(rides);

        var overallAverage = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(
            fsharpList
        );
        var byMonthSeq = AdvancedDashboardCalculations.calculateDifficultyByMonth(fsharpList);

        var byMonth = byMonthSeq
            .Select(result => new YearStatsDifficultyByMonthPoint(
                MonthKey: DashboardMonthRules.GetMonthKey(year, result.MonthNumber),
                Label: result.MonthName.Length >= 3 ? result.MonthName[..3] : result.MonthName,
                AverageDifficulty: result.AverageDifficulty
            ))
            .ToList();

        var mostDifficultMonths = byMonth
            .OrderByDescending(point => point.AverageDifficulty)
            .ThenByDescending(point => point.MonthKey, StringComparer.Ordinal)
            .ToList();

        var hasData = OptionModule.IsSome(overallAverage) || byMonth.Count > 0;

        return new YearStatsDifficultySection(
            HasData: hasData,
            OverallAverageDifficulty: OptionModule.IsSome(overallAverage)
                ? overallAverage.Value
                : null,
            ByMonth: byMonth,
            MostDifficultMonths: mostDifficultMonths
        );
    }

    private static YearStatsWindResistanceSection BuildWindResistanceSection(
        IReadOnlyList<RideEntity> rides,
        int year
    )
    {
        _ = year;

        var hasWindData = rides.Any(ride => ride.WindResistanceRating.HasValue);

        if (!hasWindData)
        {
            return new YearStatsWindResistanceSection(HasData: false, Bins: []);
        }

        var fsharpList = RideDifficultyRules.ToSnapshots(rides);
        var distributionSeq = AdvancedDashboardCalculations.calculateWindResistanceDistribution(
            fsharpList
        );

        var bins = distributionSeq
            .Where(bin => bin.RideCount > 0)
            .Select(bin => new YearStatsWindResistanceBin(
                Label: RideDifficultyRules.GetWindResistanceLabel(bin.Rating),
                Count: bin.RideCount
            ))
            .ToList();

        return new YearStatsWindResistanceSection(HasData: true, Bins: bins);
    }

    private static IEnumerable<int> EnumerateMonthsOfYear(int year)
    {
        _ = year;
        for (var month = 1; month <= 12; month++)
        {
            yield return month;
        }
    }
}
