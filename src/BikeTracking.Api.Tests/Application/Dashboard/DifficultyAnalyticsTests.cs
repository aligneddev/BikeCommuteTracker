using BikeTracking.Domain.FSharp;
using Microsoft.FSharp.Collections;
using Microsoft.FSharp.Core;

namespace BikeTracking.Api.Tests.Application.Dashboard;

/// <summary>
/// Tests for difficulty analytics calculation functions (Feature 019, Phase 5).
/// Tests are RED until AdvancedDashboardCalculations.fs is extended with the new functions.
/// </summary>
public sealed class DifficultyAnalyticsTests
{
    // Helper to build a snapshot
    private static AdvancedDashboardCalculations.RideDifficultySnapshot MakeSnapshot(
        DateTime? date = null,
        int? difficulty = null,
        int? windResistanceRating = null,
        decimal? windSpeedMph = null,
        string? travelDirection = null,
        int? windDirectionDeg = null
    ) => new AdvancedDashboardCalculations.RideDifficultySnapshot(
        RideDate: date ?? new DateTime(2026, 1, 15),
        Difficulty: difficulty.HasValue ? FSharpOption<int>.Some(difficulty.Value) : FSharpOption<int>.None,
        WindResistanceRating: windResistanceRating.HasValue ? FSharpOption<int>.Some(windResistanceRating.Value) : FSharpOption<int>.None,
        WindSpeedMph: windSpeedMph.HasValue ? FSharpOption<decimal>.Some(windSpeedMph.Value) : FSharpOption<decimal>.None,
        PrimaryTravelDirection: travelDirection != null ? FSharpOption<string>.Some(travelDirection) : FSharpOption<string>.None,
        WindDirectionDeg: windDirectionDeg.HasValue ? FSharpOption<int>.Some(windDirectionDeg.Value) : FSharpOption<int>.None
    );

    private static FSharpList<AdvancedDashboardCalculations.RideDifficultySnapshot> ToFSharpList(
        params AdvancedDashboardCalculations.RideDifficultySnapshot[] snapshots
    ) => ListModule.OfSeq(snapshots);

    // --- resolveDifficulty ---

    [Fact]
    public void ResolveDifficulty_WithStoredDifficulty_ReturnsIt()
    {
        var snapshot = MakeSnapshot(difficulty: 4);
        var result = AdvancedDashboardCalculations.resolveDifficulty(snapshot);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(4, result.Value);
    }

    [Fact]
    public void ResolveDifficulty_WithWindResistanceRatingOnly_MapsToDifficulty()
    {
        // WindResistanceRating +3 → difficulty 5 (per resistanceToDifficulty)
        var snapshot = MakeSnapshot(windResistanceRating: 3);
        var result = AdvancedDashboardCalculations.resolveDifficulty(snapshot);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(5, result.Value);
    }

    [Fact]
    public void ResolveDifficulty_WithWindResistanceRatingNegative_MapsToDifficulty()
    {
        // WindResistanceRating -4 → difficulty 1
        var snapshot = MakeSnapshot(windResistanceRating: -4);
        var result = AdvancedDashboardCalculations.resolveDifficulty(snapshot);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(1, result.Value);
    }

    [Fact]
    public void ResolveDifficulty_WithWindDataOnly_ComputesDifficulty()
    {
        // 20 mph headwind (travel North, wind from North = 0°) → resistance +4 → difficulty 5
        var snapshot = MakeSnapshot(windSpeedMph: 20m, travelDirection: "North", windDirectionDeg: 0);
        var result = AdvancedDashboardCalculations.resolveDifficulty(snapshot);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(5, result.Value);
    }

    [Fact]
    public void ResolveDifficulty_WithNoData_ReturnsNone()
    {
        var snapshot = MakeSnapshot();
        var result = AdvancedDashboardCalculations.resolveDifficulty(snapshot);
        Assert.False(OptionModule.IsSome(result));
    }

    [Fact]
    public void ResolveDifficulty_StoredDifficultyTakesPrecedenceOverRating()
    {
        // Stored difficulty 2, rating would give 5 — stored wins
        var snapshot = MakeSnapshot(difficulty: 2, windResistanceRating: 3);
        var result = AdvancedDashboardCalculations.resolveDifficulty(snapshot);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(2, result.Value);
    }

    // --- calculateOverallAverageDifficulty ---

    [Fact]
    public void CalculateOverallAverageDifficulty_EmptyList_ReturnsNone()
    {
        var result = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(
            FSharpList<AdvancedDashboardCalculations.RideDifficultySnapshot>.Empty
        );
        Assert.False(OptionModule.IsSome(result));
    }

    [Fact]
    public void CalculateOverallAverageDifficulty_WithRides_ReturnsAverage()
    {
        var snapshots = ToFSharpList(
            MakeSnapshot(difficulty: 2),
            MakeSnapshot(difficulty: 4),
            MakeSnapshot(difficulty: 3)
        );
        var result = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(snapshots);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(3.0m, result.Value);
    }

    [Fact]
    public void CalculateOverallAverageDifficulty_ReturnsOneDecimalPlace()
    {
        var snapshots = ToFSharpList(
            MakeSnapshot(difficulty: 1),
            MakeSnapshot(difficulty: 2)
        );
        var result = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(snapshots);
        Assert.True(OptionModule.IsSome(result));
        Assert.Equal(1.5m, result.Value);
    }

    [Fact]
    public void CalculateOverallAverageDifficulty_WhenNoneResolvable_ReturnsNone()
    {
        // Snapshots with no data — nothing resolves
        var snapshots = ToFSharpList(MakeSnapshot(), MakeSnapshot());
        var result = AdvancedDashboardCalculations.calculateOverallAverageDifficulty(snapshots);
        Assert.False(OptionModule.IsSome(result));
    }

    // --- calculateDifficultyByMonth ---

    [Fact]
    public void CalculateDifficultyByMonth_EmptyList_ReturnsEmptyList()
    {
        var result = AdvancedDashboardCalculations.calculateDifficultyByMonth(
            FSharpList<AdvancedDashboardCalculations.RideDifficultySnapshot>.Empty
        );
        Assert.Empty(result);
    }

    [Fact]
    public void CalculateDifficultyByMonth_GroupsByMonth()
    {
        var snapshots = ToFSharpList(
            MakeSnapshot(date: new DateTime(2026, 1, 5), difficulty: 2),
            MakeSnapshot(date: new DateTime(2026, 1, 15), difficulty: 4),
            MakeSnapshot(date: new DateTime(2026, 3, 10), difficulty: 3)
        );
        var result = AdvancedDashboardCalculations.calculateDifficultyByMonth(snapshots).ToList();
        Assert.Equal(2, result.Count);
        var jan = result.First(r => r.MonthNumber == 1);
        Assert.Equal(3.0m, jan.AverageDifficulty);
        Assert.Equal(2, jan.RideCount);
        var mar = result.First(r => r.MonthNumber == 3);
        Assert.Equal(3.0m, mar.AverageDifficulty);
        Assert.Equal(1, mar.RideCount);
    }

    [Fact]
    public void CalculateDifficultyByMonth_AggregatesAcrossYears()
    {
        // Both January rides (different years) combined
        var snapshots = ToFSharpList(
            MakeSnapshot(date: new DateTime(2025, 1, 10), difficulty: 2),
            MakeSnapshot(date: new DateTime(2026, 1, 20), difficulty: 4)
        );
        var result = AdvancedDashboardCalculations.calculateDifficultyByMonth(snapshots).ToList();
        Assert.Single(result);
        Assert.Equal(1, result[0].MonthNumber);
        Assert.Equal("January", result[0].MonthName);
        Assert.Equal(3.0m, result[0].AverageDifficulty);
        Assert.Equal(2, result[0].RideCount);
    }

    [Fact]
    public void CalculateDifficultyByMonth_SortedByMonthAscending()
    {
        var snapshots = ToFSharpList(
            MakeSnapshot(date: new DateTime(2026, 6, 1), difficulty: 3),
            MakeSnapshot(date: new DateTime(2026, 2, 1), difficulty: 4),
            MakeSnapshot(date: new DateTime(2026, 4, 1), difficulty: 2)
        );
        var result = AdvancedDashboardCalculations.calculateDifficultyByMonth(snapshots).ToList();
        Assert.Equal(3, result.Count);
        Assert.Equal(2, result[0].MonthNumber);
        Assert.Equal(4, result[1].MonthNumber);
        Assert.Equal(6, result[2].MonthNumber);
    }

    // --- calculateWindResistanceDistribution ---

    [Fact]
    public void CalculateWindResistanceDistribution_EmptyList_ReturnsAllNineBinsWithZeroCount()
    {
        var result = AdvancedDashboardCalculations.calculateWindResistanceDistribution(
            FSharpList<AdvancedDashboardCalculations.RideDifficultySnapshot>.Empty
        ).ToList();
        Assert.Equal(9, result.Count);
        for (var rating = -4; rating <= 4; rating++)
        {
            var bin = result.First(b => b.Rating == rating);
            Assert.Equal(0, bin.RideCount);
        }
    }

    [Fact]
    public void CalculateWindResistanceDistribution_CountsStoredRatings()
    {
        var snapshots = ToFSharpList(
            MakeSnapshot(windResistanceRating: 2),
            MakeSnapshot(windResistanceRating: 2),
            MakeSnapshot(windResistanceRating: -1)
        );
        var result = AdvancedDashboardCalculations.calculateWindResistanceDistribution(snapshots).ToList();
        Assert.Equal(9, result.Count);
        Assert.Equal(2, result.First(b => b.Rating == 2).RideCount);
        Assert.Equal(1, result.First(b => b.Rating == -1).RideCount);
        Assert.Equal(0, result.First(b => b.Rating == 0).RideCount);
    }
}
