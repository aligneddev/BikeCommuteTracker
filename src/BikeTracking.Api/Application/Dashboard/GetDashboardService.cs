using System.Globalization;
using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence;
using BikeTracking.Api.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace BikeTracking.Api.Application.Dashboard;

public sealed class GetDashboardService(BikeTrackingDbContext dbContext)
{
    public async Task<DashboardResponse> GetAsync(
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
            .SingleOrDefaultAsync(setting => setting.UserId == riderId, cancellationToken);

        var nowLocal = DateTime.Now;
        var currentMonthStart = new DateTime(nowLocal.Year, nowLocal.Month, 1);
        var nextMonthStart = currentMonthStart.AddMonths(1);
        var currentYearStart = new DateTime(nowLocal.Year, 1, 1);
        var nextYearStart = currentYearStart.AddYears(1);

        var currentMonthRides = rides
            .Where(ride =>
                ride.RideDateTimeLocal >= currentMonthStart
                && ride.RideDateTimeLocal < nextMonthStart
            )
            .ToList();
        var currentYearRides = rides
            .Where(ride =>
                ride.RideDateTimeLocal >= currentYearStart && ride.RideDateTimeLocal < nextYearStart
            )
            .ToList();
        var yearToDateMiles = currentYearRides.Sum(ride => ride.Miles);
        var gallonsAvoided = CalculateGallonsAvoided(rides);

        var savings = CalculateSavings(rides);

        return new DashboardResponse(
            Totals: new DashboardTotals(
                CurrentMonthMiles: CreateMileageMetric(currentMonthRides, "thisMonth"),
                YearToDateMiles: CreateMileageMetric(currentYearRides, "thisYear"),
                AllTimeMiles: CreateMileageMetric(rides, "allTime"),
                MoneySaved: savings.Totals
            ),
            Averages: new DashboardAverages(
                AverageTemperature: CalculateAverageTemperature(rides),
                AverageMilesPerRide: CalculateAverageMilesPerRide(rides),
                AverageRideMinutes: CalculateAverageRideMinutes(rides)
            ),
            Charts: new DashboardCharts(
                MileageByMonth: BuildMileageSeries(rides, nowLocal),
                SavingsByMonth: BuildSavingsSeries(rides, nowLocal)
            ),
            Suggestions: BuildSuggestions(settings, gallonsAvoided, yearToDateMiles),
            MissingData: new DashboardMissingData(
                RidesMissingSavingsSnapshot: rides.Count(ride =>
                    ride.SnapshotMileageRateCents is null || ride.SnapshotAverageCarMpg is null
                ),
                RidesMissingGasPrice: rides.Count(ride => ride.GasPricePerGallon is null),
                RidesMissingTemperature: rides.Count(ride => ride.Temperature is null),
                RidesMissingDuration: rides.Count(ride => ride.RideMinutes is null)
            ),
            GeneratedAtUtc: DateTime.UtcNow
        );
    }

    private static DashboardMileageMetric CreateMileageMetric(
        IReadOnlyCollection<RideEntity> rides,
        string period
    )
    {
        return new DashboardMileageMetric(
            Miles: rides.Sum(ride => ride.Miles),
            RideCount: rides.Count,
            Period: period
        );
    }

    private static decimal? CalculateAverageTemperature(IReadOnlyCollection<RideEntity> rides)
    {
        var temperatures = rides
            .Where(ride => ride.Temperature.HasValue)
            .Select(ride => ride.Temperature!.Value)
            .ToList();
        return temperatures.Count == 0
            ? null
            : decimal.Round(temperatures.Average(), 1, MidpointRounding.AwayFromZero);
    }

    private static decimal? CalculateAverageMilesPerRide(IReadOnlyCollection<RideEntity> rides)
    {
        return rides.Count == 0
            ? null
            : decimal.Round(rides.Average(ride => ride.Miles), 1, MidpointRounding.AwayFromZero);
    }

    private static decimal? CalculateAverageRideMinutes(IReadOnlyCollection<RideEntity> rides)
    {
        var rideMinutes = rides
            .Where(ride => ride.RideMinutes.HasValue)
            .Select(ride => ride.RideMinutes!.Value)
            .ToList();
        return rideMinutes.Count == 0
            ? null
            : decimal.Round((decimal)rideMinutes.Average(), 1, MidpointRounding.AwayFromZero);
    }

    private static SavingsComputation CalculateSavings(IReadOnlyCollection<RideEntity> rides)
    {
        var totals = AggregateSavings(rides);
        decimal? combinedSavings = totals.HasAnySavings
            ? totals.MileageRateSavings + totals.FuelCostAvoided
            : null;

        return new SavingsComputation(
            new DashboardMoneySaved(
                MileageRateSavings: totals.HasMileageRateSavings
                    ? RoundMoney(totals.MileageRateSavings)
                    : null,
                FuelCostAvoided: totals.HasFuelCostAvoided
                    ? RoundMoney(totals.FuelCostAvoided)
                    : null,
                CombinedSavings: RoundMoney(combinedSavings),
                QualifiedRideCount: totals.QualifiedRideCount
            )
        );
    }

    private static IReadOnlyList<DashboardMileagePoint> BuildMileageSeries(
        IReadOnlyCollection<RideEntity> rides,
        DateTime nowLocal
    )
    {
        return EnumerateRollingMonths(nowLocal)
            .Select(month =>
            {
                var monthMiles = rides
                    .Where(ride => IsWithinMonth(ride.RideDateTimeLocal, month.Year, month.Month))
                    .Sum(ride => ride.Miles);

                return new DashboardMileagePoint(
                    MonthKey: GetMonthKey(month.Year, month.Month),
                    Label: month.ToString("MMM", CultureInfo.InvariantCulture),
                    Miles: monthMiles
                );
            })
            .ToList();
    }

    private static IReadOnlyList<DashboardSavingsPoint> BuildSavingsSeries(
        IReadOnlyCollection<RideEntity> rides,
        DateTime nowLocal
    )
    {
        return EnumerateRollingMonths(nowLocal)
            .Select(month =>
            {
                var monthRides = rides
                    .Where(ride => IsWithinMonth(ride.RideDateTimeLocal, month.Year, month.Month))
                    .ToList();

                var monthSavings = AggregateSavings(monthRides);
                decimal? combinedSavings = monthSavings.HasAnySavings
                    ? monthSavings.MileageRateSavings + monthSavings.FuelCostAvoided
                    : null;

                return new DashboardSavingsPoint(
                    MonthKey: GetMonthKey(month.Year, month.Month),
                    Label: month.ToString("MMM", CultureInfo.InvariantCulture),
                    MileageRateSavings: monthSavings.HasMileageRateSavings
                        ? RoundMoney(monthSavings.MileageRateSavings)
                        : null,
                    FuelCostAvoided: monthSavings.HasFuelCostAvoided
                        ? RoundMoney(monthSavings.FuelCostAvoided)
                        : null,
                    CombinedSavings: RoundMoney(combinedSavings)
                );
            })
            .ToList();
    }

    private static SavingsAggregate AggregateSavings(IEnumerable<RideEntity> rides)
    {
        var mileageRateSavings = 0m;
        var fuelCostAvoided = 0m;
        var qualifiedRideCount = 0;
        var hasMileageRateSavings = false;
        var hasFuelCostAvoided = false;

        foreach (var ride in rides)
        {
            var rideMileageRateSavings = CalculateMileageRateSavings(ride);
            var rideFuelCostAvoided = CalculateFuelCostAvoided(ride);

            if (rideMileageRateSavings.HasValue || rideFuelCostAvoided.HasValue)
            {
                qualifiedRideCount++;
            }

            if (rideMileageRateSavings.HasValue)
            {
                hasMileageRateSavings = true;
                mileageRateSavings += rideMileageRateSavings.Value;
            }

            if (rideFuelCostAvoided.HasValue)
            {
                hasFuelCostAvoided = true;
                fuelCostAvoided += rideFuelCostAvoided.Value;
            }
        }

        return new SavingsAggregate(
            MileageRateSavings: mileageRateSavings,
            FuelCostAvoided: fuelCostAvoided,
            QualifiedRideCount: qualifiedRideCount,
            HasMileageRateSavings: hasMileageRateSavings,
            HasFuelCostAvoided: hasFuelCostAvoided
        );
    }

    private static IReadOnlyList<DashboardMetricSuggestion> BuildSuggestions(
        UserSettingsEntity? settings,
        decimal? gallonsAvoided,
        decimal yearToDateMiles
    )
    {
        var yearlyGoalMiles = settings?.YearlyGoalMiles;
        decimal? goalProgressPercent =
            yearlyGoalMiles is decimal goal && goal > 0m
                ? decimal.Round((yearToDateMiles / goal) * 100m, 1, MidpointRounding.AwayFromZero)
                : null;

        return
        [
            new DashboardMetricSuggestion(
                MetricKey: "gallonsAvoided",
                Title: "Gallons Avoided",
                Description: "See how much gas your rides kept in the tank.",
                IsEnabled: settings?.DashboardGallonsAvoidedEnabled ?? false,
                Value: gallonsAvoided,
                UnitLabel: "gal"
            ),
            new DashboardMetricSuggestion(
                MetricKey: "goalProgress",
                Title: "Goal Progress",
                Description: "Compare your riding pace to your yearly mileage goal.",
                IsEnabled: settings?.DashboardGoalProgressEnabled ?? false,
                Value: goalProgressPercent,
                UnitLabel: "%"
            ),
        ];
    }

    private static decimal? CalculateGallonsAvoided(IReadOnlyCollection<RideEntity> rides)
    {
        var totalGallonsAvoided = rides
            .Where(ride =>
                ride.SnapshotAverageCarMpg is decimal averageCarMpg && averageCarMpg > 0m
            )
            .Select(ride => ride.Miles / ride.SnapshotAverageCarMpg!.Value)
            .DefaultIfEmpty(0m)
            .Sum();

        return totalGallonsAvoided > 0m
            ? decimal.Round(totalGallonsAvoided, 2, MidpointRounding.AwayFromZero)
            : null;
    }

    private static IEnumerable<DateTime> EnumerateRollingMonths(DateTime nowLocal)
    {
        var start = new DateTime(nowLocal.Year, nowLocal.Month, 1).AddMonths(-11);

        for (var offset = 0; offset < 12; offset++)
        {
            yield return start.AddMonths(offset);
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

    private static decimal? CalculateMileageRateSavings(RideEntity ride)
    {
        return ride.SnapshotMileageRateCents is decimal mileageRateCents
            ? ride.Miles * mileageRateCents / 100m
            : null;
    }

    private static decimal? CalculateFuelCostAvoided(RideEntity ride)
    {
        if (ride.SnapshotAverageCarMpg is not decimal averageCarMpg || averageCarMpg <= 0m)
        {
            return null;
        }

        if (ride.GasPricePerGallon is not decimal gasPricePerGallon)
        {
            return null;
        }

        return ride.Miles / averageCarMpg * gasPricePerGallon;
    }

    private static decimal? RoundMoney(decimal? value)
    {
        return value.HasValue ? decimal.Round(value.Value, 2, MidpointRounding.AwayFromZero) : null;
    }

    private sealed record SavingsAggregate(
        decimal MileageRateSavings,
        decimal FuelCostAvoided,
        int QualifiedRideCount,
        bool HasMileageRateSavings,
        bool HasFuelCostAvoided
    )
    {
        public bool HasAnySavings => HasMileageRateSavings || HasFuelCostAvoided;
    }

    private sealed record SavingsComputation(DashboardMoneySaved Totals);
}
