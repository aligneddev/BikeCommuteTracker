namespace BikeTracking.Api.Application.Imports;

public static class ImportProgressEstimator
{
    private static readonly int[] Milestones = [25, 50, 75, 100];

    public static int? CalculateEtaMinutesRounded(
        int totalRows,
        int processedRows,
        DateTime? startedAtUtc,
        DateTime nowUtc
    )
    {
        if (totalRows <= 0 || processedRows <= 0 || startedAtUtc is null)
        {
            return null;
        }

        var minimumRowsForEstimate = (int)Math.Ceiling(totalRows * 0.1m);
        if (processedRows < minimumRowsForEstimate || processedRows >= totalRows)
        {
            return processedRows >= totalRows ? 0 : null;
        }

        var elapsed = nowUtc - startedAtUtc.Value;
        if (elapsed <= TimeSpan.Zero)
        {
            return null;
        }

        var rowsPerMinute = processedRows / elapsed.TotalMinutes;
        if (rowsPerMinute <= 0)
        {
            return null;
        }

        var remainingRows = totalRows - processedRows;
        var remainingMinutes = remainingRows / rowsPerMinute;
        var roundedToNearestFive = (int)(
            Math.Round(remainingMinutes / 5d, MidpointRounding.AwayFromZero) * 5
        );

        return Math.Max(0, roundedToNearestFive);
    }

    public static int CalculatePercentComplete(int totalRows, int processedRows)
    {
        if (totalRows <= 0)
        {
            return 0;
        }

        return (int)Math.Clamp(Math.Round((double)processedRows * 100 / totalRows), 0, 100);
    }

    public static IReadOnlyList<int> GetReachedMilestones(int totalRows, int processedRows)
    {
        var percentComplete = CalculatePercentComplete(totalRows, processedRows);
        return Milestones.Where(milestone => percentComplete >= milestone).ToArray();
    }
}
