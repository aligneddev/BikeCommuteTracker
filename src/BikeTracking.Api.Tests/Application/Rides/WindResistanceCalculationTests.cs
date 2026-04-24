using BikeTracking.Domain.FSharp;
using Microsoft.FSharp.Core;
using static BikeTracking.Domain.FSharp.WindResistance;

namespace BikeTracking.Api.Tests.Application.Rides;

public sealed class WindResistanceCalculationTests
{
    // ──────────────────────────────────────────────────────────────
    // degreesToCompass
    // ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(0, "North")]
    [InlineData(22, "North")]
    [InlineData(23, "NE")]
    [InlineData(45, "NE")]
    [InlineData(337, "NW")]
    [InlineData(360, "North")]
    public void DegreesToCompass_ValidDegrees_ReturnsExpectedDirection(
        int degrees,
        string expectedName
    )
    {
        var result = degreesToCompass(degrees);

        Assert.True(result.IsOk);
        var direction = result.ResultValue;
        var expected = tryParseCompassDirection(expectedName);
        Assert.NotNull(expected);
        Assert.Equal(expected.Value, direction);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(361)]
    public void DegreesToCompass_OutOfRange_ReturnsError(int degrees)
    {
        var result = degreesToCompass(degrees);

        Assert.True(result.IsError);
        Assert.IsType<WindResistanceError.InvalidWindDirection>(result.ErrorValue);
    }

    // ──────────────────────────────────────────────────────────────
    // calculateResistance
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void CalculateResistance_20MphHeadwind_ReturnsPlus4()
    {
        // Travel North, wind from 0° = direct headwind
        var result = calculateResistance(20m, CompassDirection.North, 0);

        Assert.True(result.IsOk);
        Assert.Equal(4, result.ResultValue);
    }

    [Fact]
    public void CalculateResistance_20MphTailwind_ReturnsMinus4()
    {
        // Travel North, wind from 180° = direct tailwind
        var result = calculateResistance(20m, CompassDirection.North, 180);

        Assert.True(result.IsOk);
        Assert.Equal(-4, result.ResultValue);
    }

    [Fact]
    public void CalculateResistance_Crosswind_ReturnsZero()
    {
        // Travel North, wind from 90° = perpendicular crosswind
        var result = calculateResistance(20m, CompassDirection.North, 90);

        Assert.True(result.IsOk);
        Assert.Equal(0, result.ResultValue);
    }

    [Fact]
    public void CalculateResistance_NegativeSpeed_ReturnsError()
    {
        var result = calculateResistance(-1m, CompassDirection.North, 0);

        Assert.True(result.IsError);
        Assert.IsType<WindResistanceError.InvalidWindSpeed>(result.ErrorValue);
    }

    [Fact]
    public void CalculateResistance_VeryHighSpeed_ClampedToPlus4()
    {
        // 100 mph headwind would produce 20, clamped to +4
        var result = calculateResistance(100m, CompassDirection.North, 0);

        Assert.True(result.IsOk);
        Assert.Equal(4, result.ResultValue);
    }

    [Fact]
    public void CalculateResistance_VeryHighTailwind_ClampedToMinus4()
    {
        // 100 mph tailwind would produce -20, clamped to -4
        var result = calculateResistance(100m, CompassDirection.North, 180);

        Assert.True(result.IsOk);
        Assert.Equal(-4, result.ResultValue);
    }

    // ──────────────────────────────────────────────────────────────
    // calculateDifficulty
    // ──────────────────────────────────────────────────────────────

    [Fact]
    public void CalculateDifficulty_NullWindSpeed_ReturnsZeroOne()
    {
        var result = calculateDifficulty(
            FSharpOption<decimal>.None,
            CompassDirection.North,
            FSharpOption<int>.None
        );

        Assert.True(result.IsOk);
        Assert.Equal(Tuple.Create(0, 1), result.ResultValue);
    }

    [Fact]
    public void CalculateDifficulty_ZeroWindSpeed_ReturnsZeroOne()
    {
        var result = calculateDifficulty(
            FSharpOption<decimal>.Some(0m),
            CompassDirection.North,
            FSharpOption<int>.Some(90)
        );

        Assert.True(result.IsOk);
        Assert.Equal(Tuple.Create(0, 1), result.ResultValue);
    }

    [Fact]
    public void CalculateDifficulty_SpeedPresentButNoDirection_ReturnsZeroOne()
    {
        var result = calculateDifficulty(
            FSharpOption<decimal>.Some(15m),
            CompassDirection.North,
            FSharpOption<int>.None
        );

        Assert.True(result.IsOk);
        Assert.Equal(Tuple.Create(0, 1), result.ResultValue);
    }

    [Fact]
    public void CalculateDifficulty_FullHeadwind20Mph_ReturnsFourFive()
    {
        var result = calculateDifficulty(
            FSharpOption<decimal>.Some(20m),
            CompassDirection.North,
            FSharpOption<int>.Some(0)
        );

        Assert.True(result.IsOk);
        Assert.Equal(Tuple.Create(4, 5), result.ResultValue);
    }

    [Fact]
    public void CalculateDifficulty_FullTailwind20Mph_ReturnsMinusFourOne()
    {
        var result = calculateDifficulty(
            FSharpOption<decimal>.Some(20m),
            CompassDirection.North,
            FSharpOption<int>.Some(180)
        );

        Assert.True(result.IsOk);
        Assert.Equal(Tuple.Create(-4, 1), result.ResultValue);
    }

    // ──────────────────────────────────────────────────────────────
    // resistanceToDifficulty — all 9 values
    // ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(-4, 1)]
    [InlineData(-3, 1)]
    [InlineData(-2, 2)]
    [InlineData(-1, 2)]
    [InlineData(0, 3)]
    [InlineData(1, 4)]
    [InlineData(2, 4)]
    [InlineData(3, 5)]
    [InlineData(4, 5)]
    public void ResistanceToDifficulty_AllRatings_MapsCorrectly(int resistance, int expectedDifficulty)
    {
        var difficulty = resistanceToDifficulty(resistance);

        Assert.Equal(expectedDifficulty, difficulty);
    }
}
