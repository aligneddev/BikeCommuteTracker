using BikeTracking.Api.Contracts;
using BikeTracking.Api.Infrastructure.Persistence.Entities;

namespace BikeTracking.Api.Application.Dashboard;

internal static class SavingsCalculationRules
{
    public const decimal OilChangeIntervalMiles = 3000m;

    public static decimal? CalculateMileageRateSavings(decimal miles, decimal? mileageRateCents)
    {
        return mileageRateCents is decimal rateCents
            ? CalculateMileageRateSavings(miles, rateCents)
            : null;
    }

    public static decimal CalculateMileageRateSavings(decimal miles, decimal mileageRateCents)
    {
        return miles * mileageRateCents;
    }

    public static decimal? CalculateFuelCostAvoided(
        decimal miles,
        decimal? averageCarMpg,
        decimal? gasPricePerGallon
    )
    {
        if (averageCarMpg is not decimal mpg || mpg <= 0m)
        {
            return null;
        }

        if (gasPricePerGallon is not decimal gasPrice)
        {
            return null;
        }

        return CalculateFuelCostAvoided(miles, mpg, gasPrice);
    }

    public static decimal CalculateFuelCostAvoided(
        decimal miles,
        decimal averageCarMpg,
        decimal gasPricePerGallon
    )
    {
        return miles / averageCarMpg * gasPricePerGallon;
    }

    /// <summary>
    /// Sums mileage-rate savings and fuel cost avoided across <paramref name="rides"/>,
    /// tracking whether any ride contributed to each total.
    /// </summary>
    public static SavingsAggregate AggregateSavings(
        IEnumerable<RideEntity> rides,
        decimal? mileageRateCents
    )
    {
        var mileageRateSavings = 0m;
        var fuelCostAvoided = 0m;
        var qualifiedRideCount = 0;
        var hasMileageRateSavings = false;
        var hasFuelCostAvoided = false;

        foreach (var ride in rides)
        {
            var rideMileageRateSavings = CalculateMileageRateSavings(ride.Miles, mileageRateCents);
            var rideFuelCostAvoided = CalculateFuelCostAvoided(
                ride.Miles,
                ride.SnapshotAverageCarMpg,
                ride.GasPricePerGallon
            );

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

    /// <summary>
    /// Offsets manual expenses with oil-change savings: one oil change is avoided for every
    /// full <see cref="OilChangeIntervalMiles"/> ridden.
    /// </summary>
    public static DashboardExpenseSummary CalculateExpenseSummary(
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

        var intervalCount = (int)Math.Floor(totalMiles / OilChangeIntervalMiles);
        var oilChangeSavings = intervalCount * oilChangePrice.Value;
        var netExpenses = totalManualExpenses - oilChangeSavings;

        return new DashboardExpenseSummary(
            TotalManualExpenses: totalManualExpenses,
            OilChangeSavings: oilChangeSavings,
            NetExpenses: netExpenses,
            OilChangeIntervalCount: intervalCount
        );
    }

    public static decimal RoundMoney(decimal value)
    {
        return decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    }

    public static decimal? RoundMoney(decimal? value)
    {
        return value.HasValue ? RoundMoney(value.Value) : null;
    }
}

internal sealed record SavingsAggregate(
    decimal MileageRateSavings,
    decimal FuelCostAvoided,
    int QualifiedRideCount,
    bool HasMileageRateSavings,
    bool HasFuelCostAvoided
)
{
    public bool HasAnySavings => HasMileageRateSavings || HasFuelCostAvoided;
}
