using BikeTracking.Api.Application.Imports;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class MonthlySummaryValidationRulesTests
{
    private static MonthlySummaryRow MakeRow(
        int rowNumber = 1,
        int? month = 1,
        string monthName = "January",
        decimal? miles = 96m,
        int? days = 8,
        int? year = 2025
    ) => new(rowNumber, month, monthName, miles, days, year);

    [Fact]
    public void ValidateRow_UnrecognisedMonthName_ReturnsInvalidMonth()
    {
        var row = MakeRow(month: null, monthName: "Jnauary");

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "INVALID_MONTH" && e.Field == "Month");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void ValidateRow_NonPositiveMiles_ReturnsInvalidMiles(decimal miles)
    {
        var row = MakeRow(miles: miles);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "INVALID_MILES" && e.Field == "Miles");
    }

    [Fact]
    public void ValidateRow_MissingMiles_ReturnsInvalidMiles()
    {
        var row = MakeRow(miles: null);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "INVALID_MILES" && e.Field == "Miles");
    }

    [Fact]
    public void ValidateRow_DaysLessThanOne_ReturnsInvalidDays()
    {
        var row = MakeRow(days: 0);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "INVALID_DAYS" && e.Field == "Days");
    }

    [Fact]
    public void ValidateRow_MissingDays_ReturnsInvalidDays()
    {
        var row = MakeRow(days: null);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "INVALID_DAYS" && e.Field == "Days");
    }

    [Fact]
    public void ValidateRow_DaysExceedsWeekdays_ReturnsErrorWithAvailableWeekdayCount()
    {
        // April 2025 has 22 weekdays.
        var row = MakeRow(month: 4, monthName: "April", year: 2025, days: 35);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        var error = Assert.Single(errors, e => e.Code == "DAYS_EXCEED_WEEKDAYS");
        Assert.Contains("22", error.Message);
    }

    [Fact]
    public void ValidateRow_MilesPerDayExceedsLimit_ReturnsError()
    {
        var row = MakeRow(miles: 2000m, days: 1);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "MILES_PER_DAY_EXCEEDS_LIMIT");
    }

    [Fact]
    public void ValidateRows_SameMonthAppearsTwice_FlagsDuplicateMonthOnAllAffectedRows()
    {
        var rows = new List<MonthlySummaryRow>
        {
            MakeRow(rowNumber: 1, month: 1, monthName: "January"),
            MakeRow(rowNumber: 2, month: 1, monthName: "January", miles: 60m, days: 5),
        };

        var errorsByRow = MonthlySummaryValidationRules.ValidateRows(rows);

        Assert.Contains(errorsByRow[1], e => e.Code == "DUPLICATE_MONTH");
        Assert.Contains(errorsByRow[2], e => e.Code == "DUPLICATE_MONTH");
    }

    [Fact]
    public void ValidateRow_ValidRow_ProducesEmptyErrorList()
    {
        var row = MakeRow();

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Empty(errors);
    }

    // --- Edge cases (T039) ---

    [Fact]
    public void ValidateRow_DaysExceedsWeekdays_MessageContainsExactAvailableWeekdayCount()
    {
        // February 2025 (non-leap) has 20 weekdays.
        var row = MakeRow(month: 2, monthName: "February", year: 2025, days: 25);

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        var error = Assert.Single(errors, e => e.Code == "DAYS_EXCEED_WEEKDAYS");
        Assert.Contains("20", error.Message);
    }

    [Fact]
    public void ValidateRow_UnrecognisedMonthNameTypo_ReturnsInvalidMonth()
    {
        var row = MakeRow(month: null, monthName: "Jnauary");

        var errors = MonthlySummaryValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Code == "INVALID_MONTH");
    }
}
