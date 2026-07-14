namespace BikeTracking.Api.Application.Dashboard;

internal static class SavingsCalculationRules
{
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
}
