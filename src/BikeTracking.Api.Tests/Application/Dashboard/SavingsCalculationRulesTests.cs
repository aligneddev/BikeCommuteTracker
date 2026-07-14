using BikeTracking.Api.Application.Dashboard;

namespace BikeTracking.Api.Tests.Application.Dashboard;

public sealed class SavingsCalculationRulesTests
{
    [Theory]
    [InlineData(10, 80, 800)]
    [InlineData(1.25, 67.5, 84.375)]
    [InlineData(-4, 50, -200)]
    public void CalculateMileageRateSavings_WithRequiredRate_ReturnsMilesTimesRate(
        decimal miles,
        decimal rateCents,
        decimal expected
    )
    {
        var result = SavingsCalculationRules.CalculateMileageRateSavings(miles, rateCents);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateMileageRateSavings_WithNullableRateNull_ReturnsNull()
    {
        var result = SavingsCalculationRules.CalculateMileageRateSavings(
            10m,
            mileageRateCents: null
        );

        Assert.Null(result);
    }

    [Theory]
    [InlineData(10, 80)]
    [InlineData(12.5, 67.5)]
    [InlineData(-2, 30)]
    public void Contract_MileageNullableOverload_MatchesRequiredOverload_WhenRateProvided(
        decimal miles,
        decimal rateCents
    )
    {
        var requiredResult = SavingsCalculationRules.CalculateMileageRateSavings(miles, rateCents);
        var nullableResult = SavingsCalculationRules.CalculateMileageRateSavings(
            miles,
            (decimal?)rateCents
        );

        Assert.NotNull(nullableResult);
        Assert.Equal(requiredResult, nullableResult!.Value);
    }

    [Theory]
    [InlineData(10, 20, 3, 1.5)]
    [InlineData(22.5, 30, 4.25, 3.1875)]
    [InlineData(-10, 20, 3, -1.5)]
    public void CalculateFuelCostAvoided_WithRequiredInputs_ReturnsMilesDivMpgTimesGas(
        decimal miles,
        decimal mpg,
        decimal gasPrice,
        decimal expected
    )
    {
        var result = SavingsCalculationRules.CalculateFuelCostAvoided(miles, mpg, gasPrice);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void CalculateFuelCostAvoided_WithNullMpg_ReturnsNull()
    {
        var result = SavingsCalculationRules.CalculateFuelCostAvoided(10m, null, 3m);

        Assert.Null(result);
    }

    [Fact]
    public void CalculateFuelCostAvoided_WithZeroMpg_ReturnsNull()
    {
        var result = SavingsCalculationRules.CalculateFuelCostAvoided(
            10m,
            averageCarMpg: (decimal?)0m,
            gasPricePerGallon: (decimal?)3m
        );

        Assert.Null(result);
    }

    [Fact]
    public void CalculateFuelCostAvoided_WithNegativeMpg_ReturnsNull()
    {
        var result = SavingsCalculationRules.CalculateFuelCostAvoided(
            10m,
            averageCarMpg: (decimal?)-1m,
            gasPricePerGallon: (decimal?)3m
        );

        Assert.Null(result);
    }

    [Fact]
    public void CalculateFuelCostAvoided_WithNullGasPrice_ReturnsNull()
    {
        var result = SavingsCalculationRules.CalculateFuelCostAvoided(10m, 20m, null);

        Assert.Null(result);
    }

    [Theory]
    [InlineData(10, 20, 3)]
    [InlineData(22.5, 30, 4.25)]
    [InlineData(-10, 25, 3.1)]
    public void Contract_FuelNullableOverload_MatchesRequiredOverload_WhenInputsValid(
        decimal miles,
        decimal mpg,
        decimal gasPrice
    )
    {
        var requiredResult = SavingsCalculationRules.CalculateFuelCostAvoided(miles, mpg, gasPrice);
        var nullableResult = SavingsCalculationRules.CalculateFuelCostAvoided(
            miles,
            (decimal?)mpg,
            (decimal?)gasPrice
        );

        Assert.NotNull(nullableResult);
        Assert.Equal(requiredResult, nullableResult!.Value);
    }
}
