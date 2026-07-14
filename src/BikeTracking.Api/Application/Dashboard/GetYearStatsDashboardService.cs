using System.Globalization;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using BikeTracking.Domain.FSharp;
using Microsoft.EntityFrameworkCore;
using Microsoft.FSharp.Collections;
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
        var savings = AggregateSavings(rides, mileageRateCents);
        decimal? totalCombinedSavings = savings.HasAnySavings
            ? RoundMoney(savings.MileageRateSavings + savings.FuelCostAvoided)
            : null;

        return new YearStatsTotals(
            TotalMiles: totalMiles,
            TotalCombinedSavings: totalCombinedSavings,
            ExpenseSummary: CalculateExpenseSummary(totalManualExpenses, totalMiles, oilChangePrice)
        );
    }

    private static DashboardExpenseSummary CalculateExpenseSummary(
        decimal totalManualExpenses,
        decimal totalMiles,
        decimal? oilChangePrice
    )
    {
        if (oilChangePrice is null)
        {
            return new DashboardExpenseSummary(
                TotalManualExpenses: totalManualExpenses,
                OilChangeSavings: null,
                NetExpenses: null,
                OilChangeIntervalCount: 0
            );
        }

        var intervalCount = (int)Math.Floor(totalMiles / 3000m);
        var oilChangeSavings = intervalCount * oilChangePrice.Value;
        var netExpenses = totalManualExpenses - oilChangeSavings;

        return new DashboardExpenseSummary(
            TotalManualExpenses: totalManualExpenses,
            OilChangeSavings: oilChangeSavings,
            NetExpenses: netExpenses,
            OilChangeIntervalCount: intervalCount
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
                    .Where(ride => IsWithinMonth(ride.RideDateTimeLocal, year, month))
                    .Sum(ride => ride.Miles);

                return new YearStatsMileagePoint(
                    MonthKey: GetMonthKey(year, month),
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
                    .Where(ride => IsWithinMonth(ride.RideDateTimeLocal, year, month))
                    .ToList();

                var savings = AggregateSavings(monthRides, mileageRateCents);
                decimal? combinedSavings = savings.HasAnySavings
                    ? savings.MileageRateSavings + savings.FuelCostAvoided
                    : null;

                return new YearStatsSavingsPoint(
                    MonthKey: GetMonthKey(year, month),
                    Label: new DateTime(year, month, 1).ToString(
                        "MMM",
                        CultureInfo.InvariantCulture
                    ),
                    MileageRateSavings: savings.HasMileageRateSavings
                        ? RoundMoney(savings.MileageRateSavings)
                        : null,
                    FuelCostAvoided: savings.HasFuelCostAvoided
                        ? RoundMoney(savings.FuelCostAvoided)
                        : null,
                    CombinedSavings: RoundMoney(combinedSavings)
                );
            })
            .ToList();
    }

    private static YearStatsDifficultySection BuildDifficultySection(
        IReadOnlyList<RideEntity> rides,
        int year
    )
    {
        var snapshots = rides
            .Select(ride => new AdvancedDashboardCalculations.RideDifficultySnapshot(
                RideDate: ride.RideDateTimeLocal,
                Difficulty: ride.Difficulty.HasValue
                    ? FSharpOption<int>.Some(ride.Difficulty.Value)
                    : FSharpOption<int>.None,
                WindResistanceRating: ride.WindResistanceRating.HasValue
                    ? FSharpOption<int>.Some(ride.WindResistanceRating.Value)
                    : FSharpOption<int>.None,
                WindSpeedMph: ride.WindSpeedMph.HasValue
                    ? FSharpOption<decimal>.Some(ride.WindSpeedMph.Value)
                    : FSharpOption<decimal>.None,
                PrimaryTravelDirection: ride.PrimaryTravelDirection is not null
                    ? FSharpOption<string>.Some(ride.PrimaryTravelDirection)
                    : FSharpOption<string>.None,
                WindDirectionDeg: ride.WindDirectionDeg.HasValue
                    ? FSharpOption<int>.Some(ride.WindDirectionDeg.Value)
                    : FSharpOption<int>.None
            ))
            .ToList();

        var fsharpList = ListModule.OfSeq(snapshots);

        var overallAverage = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(
            fsharpList
        );
        var byMonthSeq = AdvancedDashboardCalculations.calculateDifficultyByMonth(fsharpList);

        var byMonth = byMonthSeq
            .Select(result => new YearStatsDifficultyByMonthPoint(
                MonthKey: GetMonthKey(year, result.MonthNumber),
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

        var snapshots = rides
            .Select(ride => new AdvancedDashboardCalculations.RideDifficultySnapshot(
                RideDate: ride.RideDateTimeLocal,
                Difficulty: ride.Difficulty.HasValue
                    ? FSharpOption<int>.Some(ride.Difficulty.Value)
                    : FSharpOption<int>.None,
                WindResistanceRating: ride.WindResistanceRating.HasValue
                    ? FSharpOption<int>.Some(ride.WindResistanceRating.Value)
                    : FSharpOption<int>.None,
                WindSpeedMph: ride.WindSpeedMph.HasValue
                    ? FSharpOption<decimal>.Some(ride.WindSpeedMph.Value)
                    : FSharpOption<decimal>.None,
                PrimaryTravelDirection: ride.PrimaryTravelDirection is not null
                    ? FSharpOption<string>.Some(ride.PrimaryTravelDirection)
                    : FSharpOption<string>.None,
                WindDirectionDeg: ride.WindDirectionDeg.HasValue
                    ? FSharpOption<int>.Some(ride.WindDirectionDeg.Value)
                    : FSharpOption<int>.None
            ))
            .ToList();

        var fsharpList = ListModule.OfSeq(snapshots);
        var distributionSeq = AdvancedDashboardCalculations.calculateWindResistanceDistribution(
            fsharpList
        );

        var bins = distributionSeq
            .Where(bin => bin.RideCount > 0)
            .Select(bin => new YearStatsWindResistanceBin(
                Label: GetWindResistanceLabel(bin.Rating),
                Count: bin.RideCount
            ))
            .ToList();

        return new YearStatsWindResistanceSection(HasData: true, Bins: bins);
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

    private static SavingsAggregate AggregateSavings(
        IEnumerable<RideEntity> rides,
        decimal? mileageRateCents
    )
    {
        var mileageRateSavings = 0m;
        var fuelCostAvoided = 0m;
        var hasMileageRateSavings = false;
        var hasFuelCostAvoided = false;

        foreach (var ride in rides)
        {
            var rideMileageRateSavings = SavingsCalculationRules.CalculateMileageRateSavings(
                ride.Miles,
                mileageRateCents
            );
            if (rideMileageRateSavings.HasValue)
            {
                hasMileageRateSavings = true;
                mileageRateSavings += rideMileageRateSavings.Value;
            }

            var rideFuelCostAvoided = SavingsCalculationRules.CalculateFuelCostAvoided(
                ride.Miles,
                ride.SnapshotAverageCarMpg,
                ride.GasPricePerGallon
            );
            if (rideFuelCostAvoided.HasValue)
            {
                hasFuelCostAvoided = true;
                fuelCostAvoided += rideFuelCostAvoided.Value;
            }
        }

        return new SavingsAggregate(
            MileageRateSavings: mileageRateSavings,
            FuelCostAvoided: fuelCostAvoided,
            HasMileageRateSavings: hasMileageRateSavings,
            HasFuelCostAvoided: hasFuelCostAvoided
        );
    }

    private static IEnumerable<int> EnumerateMonthsOfYear(int year)
    {
        _ = year;
        for (var month = 1; month <= 12; month++)
        {
            yield return month;
        }
    }

    private static bool IsWithinMonth(DateTime value, int year, int month)
    {
        return value.Year == year && value.Month == month;
    }

    private static string GetMonthKey(int year, int month)
    {
        return $"{year:D4}-{month:D2}";
    }

    private static decimal? RoundMoney(decimal? value)
    {
        return value.HasValue ? decimal.Round(value.Value, 2, MidpointRounding.AwayFromZero) : null;
    }

    private sealed record SavingsAggregate(
        decimal MileageRateSavings,
        decimal FuelCostAvoided,
        bool HasMileageRateSavings,
        bool HasFuelCostAvoided
    )
    {
        public bool HasAnySavings => HasMileageRateSavings || HasFuelCostAvoided;
    }
}
