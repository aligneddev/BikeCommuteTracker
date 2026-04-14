using BikeTracking.Api.Application.Imports;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class ImportProgressEstimatorTests
{
    [Fact]
    public void CalculateEtaMinutesRounded_ReturnsNullBeforeTenPercentProcessed()
    {
        var startedAtUtc = new DateTime(2026, 4, 8, 10, 0, 0, DateTimeKind.Utc);
        var nowUtc = startedAtUtc.AddMinutes(9);

        var etaMinutesRounded = ImportProgressEstimator.CalculateEtaMinutesRounded(
            totalRows: 100,
            processedRows: 9,
            startedAtUtc: startedAtUtc,
            nowUtc: nowUtc
        );

        Assert.Null(etaMinutesRounded);
    }

    [Fact]
    public void CalculateEtaMinutesRounded_RoundsToNearestFiveMinutes()
    {
        var startedAtUtc = new DateTime(2026, 4, 8, 10, 0, 0, DateTimeKind.Utc);
        var nowUtc = startedAtUtc.AddMinutes(19);

        var etaMinutesRounded = ImportProgressEstimator.CalculateEtaMinutesRounded(
            totalRows: 100,
            processedRows: 50,
            startedAtUtc: startedAtUtc,
            nowUtc: nowUtc
        );

        Assert.Equal(20, etaMinutesRounded);
    }

    [Fact]
    public void GetReachedMilestones_ReturnsTwentyFiveFiftySeventyFiveAndHundred()
    {
        var milestones = ImportProgressEstimator.GetReachedMilestones(
            totalRows: 20,
            processedRows: 20
        );

        Assert.Equal([25, 50, 75, 100], milestones);
    }

    [Fact]
    public void GetReachedMilestones_IncludesOnlyReachedThresholds()
    {
        var milestones = ImportProgressEstimator.GetReachedMilestones(
            totalRows: 20,
            processedRows: 9
        );

        Assert.Equal([25], milestones);
    }
}
