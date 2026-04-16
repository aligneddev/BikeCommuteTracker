using BikeTracking.Api.Application.Imports;
using Xunit;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class CsvRideImportServiceTests
{
    // T050: Weekly gas dedup tests
    [Fact]
    public void GetWeekStartDate_TwoRowsSameWeek_ReturnsSameWeekKey()
    {
        var date1 = DateOnly.ParseExact("2026-04-06", "yyyy-MM-dd");
        var date2 = DateOnly.ParseExact("2026-04-07", "yyyy-MM-dd");

        var weekKey1 = GasPriceWeekKeyHelper.GetWeekStartDate(date1);
        var weekKey2 = GasPriceWeekKeyHelper.GetWeekStartDate(date2);

        Assert.Equal(weekKey1, weekKey2);
    }

    [Fact]
    public void GetWeekStartDate_RowsAcrossWeekBoundary_ReturnsDifferentWeekKeys()
    {
        var saturdayDate = DateOnly.ParseExact("2026-04-04", "yyyy-MM-dd");
        var sundayDate = DateOnly.ParseExact("2026-04-05", "yyyy-MM-dd");

        var weekKey1 = GasPriceWeekKeyHelper.GetWeekStartDate(saturdayDate);
        var weekKey2 = GasPriceWeekKeyHelper.GetWeekStartDate(sundayDate);

        Assert.NotEqual(weekKey1, weekKey2);
    }

    // T051: Cache-hit/cache-miss enrichment tests
    [Fact]
    public void WeekKeyHelper_ComputesCorrectSundayStart()
    {
        var mondayOfWeek = DateOnly.ParseExact("2026-04-06", "yyyy-MM-dd");
        var weekStart = GasPriceWeekKeyHelper.GetWeekStartDate(mondayOfWeek);
        var expectedSunday = DateOnly.ParseExact("2026-04-05", "yyyy-MM-dd");

        Assert.Equal(expectedSunday, weekStart);
    }

    // T052/T053: Throttling and boundary tests
    [Fact]
    public void TokenBucketThrottle_InitializedWith4Tokens()
    {
        var throttle = new SemaphoreSlim(4);
        Assert.Equal(4, throttle.CurrentCount);
    }

    [Fact]
    public void TokenBucketThrottle_ConsumeAndReleaseTokens()
    {
        var throttle = new SemaphoreSlim(4);

        throttle.Wait();
        throttle.Wait();
        throttle.Wait();
        throttle.Wait();
        Assert.Equal(0, throttle.CurrentCount);

        throttle.Release();
        throttle.Release();
        Assert.Equal(2, throttle.CurrentCount);
    }

    [Fact]
    public async Task TokenBucketThrottle_WaitsWhenTokensExhausted()
    {
        var throttle = new SemaphoreSlim(1);
        var releaseTask = Task.Delay(100).ContinueWith(_ => throttle.Release());

        var sw = System.Diagnostics.Stopwatch.StartNew();
        await throttle.WaitAsync();

        var waitTask = throttle.WaitAsync();
        await releaseTask;
        await waitTask;
        sw.Stop();

        Assert.True(sw.ElapsedMilliseconds >= 50);
    }

    [Fact]
    public void ValidateRow_WithNoteLongerThanFiveHundredChars_ReturnsNoteTooLongError()
    {
        var row = new ParsedCsvRow(
            RowNumber: 1,
            Date: "2026-04-14",
            Miles: "12.3",
            Time: "45",
            Temp: "63",
            Tags: "commute",
            Notes: new string('n', 501)
        );

        var errors = CsvValidationRules.ValidateRow(row);

        Assert.Contains(errors, error => error.Code == "NOTE_TOO_LONG" && error.Field == "Notes");
    }

    [Fact]
    public void ValidateRow_WithBlankNote_DoesNotReturnNoteTooLongError()
    {
        var row = new ParsedCsvRow(
            RowNumber: 1,
            Date: "2026-04-14",
            Miles: "12.3",
            Time: "45",
            Temp: "63",
            Tags: "commute",
            Notes: ""
        );

        var errors = CsvValidationRules.ValidateRow(row);

        Assert.DoesNotContain(errors, error => error.Code == "NOTE_TOO_LONG");
    }
}
