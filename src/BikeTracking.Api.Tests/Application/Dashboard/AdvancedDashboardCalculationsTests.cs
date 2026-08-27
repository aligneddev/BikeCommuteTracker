using BikeTracking.Domain.FSharp;

namespace BikeTracking.Api.Tests.Application.Dashboard;

/// <summary>
/// Tests for the pure CO2-saved calculation function and per-mile constant
/// (Feature 029, Phase 2 — Foundational). Tests are RED until
/// <c>AdvancedDashboardCalculations.fs</c> is extended with <c>calculateCo2Saved</c>
/// and <c>Co2PerMileLbs</c>.
/// </summary>
public sealed class AdvancedDashboardCalculationsTests
{
    [Fact]
    public void CalculateCo2Saved_WithPositiveMiles_ReturnsMilesTimesFactorRoundedTo2Places()
    {
        // 24.5 miles * 0.90 = 22.05
        var result = AdvancedDashboardCalculations.calculateCo2Saved(24.5m);

        Assert.Equal(22.05m, result);
    }

    [Fact]
    public void CalculateCo2Saved_WithZeroMiles_ReturnsZeroNotExceptionOrNaN()
    {
        var result = AdvancedDashboardCalculations.calculateCo2Saved(0m);

        Assert.Equal(0.00m, result);
    }

    [Fact]
    public void CalculateCo2Saved_RoundsAwayFromZeroAtMidpoint()
    {
        // 1 mile * 0.905 would round to 0.91 under AwayFromZero at the 3rd decimal,
        // but with a fixed 0.90 factor: 12.345 * 0.90 = 11.1105 -> rounds to 11.11
        var result = AdvancedDashboardCalculations.calculateCo2Saved(12.345m);

        Assert.Equal(11.11m, result);
    }

    [Fact]
    public void Co2PerMileLbs_EqualsFixedPointNinety()
    {
        Assert.Equal(0.90m, AdvancedDashboardCalculations.Co2PerMileLbs);
    }
}
