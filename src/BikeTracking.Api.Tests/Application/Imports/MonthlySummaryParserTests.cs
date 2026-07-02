using System.Text;
using BikeTracking.Api.Application.Imports;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class MonthlySummaryParserTests
{
    [Fact]
    public void Parse_TabDelimitedInput_ParsesRows()
    {
        var text = "Month\tMiles\tDays\nJanuary\t96\t8\nFebruary\t60\t5\n";

        var result = MonthlySummaryParser.Parse(text);

        Assert.False(result.HeaderDetectionWarning);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal("January", result.Rows[0].RawMonth);
        Assert.Equal("96", result.Rows[0].RawMiles);
        Assert.Equal("8", result.Rows[0].RawDays);
    }

    [Fact]
    public void Parse_WhitespaceDelimitedInput_ParsesRows()
    {
        var text = "Month Miles Days\nJanuary 96 8\nFebruary 60 5\n";

        var result = MonthlySummaryParser.Parse(text);

        Assert.False(result.HeaderDetectionWarning);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal("January", result.Rows[0].RawMonth);
        Assert.Equal("96", result.Rows[0].RawMiles);
        Assert.Equal("8", result.Rows[0].RawDays);
    }

    [Fact]
    public void Parse_CaseInsensitiveHeaders_ParsesRows()
    {
        var text = "MONTH\tmiles\tDays\nJanuary\t96\t8\n";

        var result = MonthlySummaryParser.Parse(text);

        Assert.False(result.HeaderDetectionWarning);
        Assert.Single(result.Rows);
        Assert.Equal("January", result.Rows[0].RawMonth);
    }

    [Fact]
    public void Parse_CommaThousandsSeparatorInMiles_StripsCommaFromRawValue()
    {
        var text = "Month\tMiles\tDays\nJanuary\t1,200.5\t10\n";

        var result = MonthlySummaryParser.Parse(text);

        Assert.Single(result.Rows);
        Assert.True(MonthlySummaryParser.TryParseMiles(result.Rows[0].RawMiles, out var miles));
        Assert.Equal(1200.5m, miles);
    }

    [Fact]
    public void Parse_NoHeaderRow_SetsHeaderDetectionWarningAndTreatsFirstRowAsData()
    {
        var text = "January\t96\t8\nFebruary\t60\t5\n";

        var result = MonthlySummaryParser.Parse(text);

        Assert.True(result.HeaderDetectionWarning);
        Assert.Equal(2, result.Rows.Count);
        Assert.Equal("January", result.Rows[0].RawMonth);
        Assert.Equal("February", result.Rows[1].RawMonth);
    }

    [Fact]
    public void Parse_FullEnglishMonthNames_AreRecognised()
    {
        foreach (
            var monthName in new[]
            {
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
            }
        )
        {
            Assert.True(
                MonthlySummaryParser.TryParseMonth(monthName, out _, out _),
                $"Expected '{monthName}' to be recognised as a full month name."
            );
        }
    }

    [Fact]
    public void Parse_ThreeLetterIsoAbbreviations_AreRecognised()
    {
        foreach (
            var abbreviation in new[]
            {
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
            }
        )
        {
            Assert.True(
                MonthlySummaryParser.TryParseMonth(abbreviation, out _, out _),
                $"Expected '{abbreviation}' to be recognised as a 3-letter abbreviation."
            );
        }
    }

    [Fact]
    public void Parse_EmptyInput_ReturnsZeroRows()
    {
        var result = MonthlySummaryParser.Parse(" ");

        Assert.Empty(result.Rows);
    }

    [Fact]
    public void Parse_HeaderOnlyInput_ReturnsZeroRowsAndNoHeaderWarning()
    {
        var text = "Month\tMiles\tDays\n";

        var result = MonthlySummaryParser.Parse(text);

        Assert.Empty(result.Rows);
        Assert.False(result.HeaderDetectionWarning);
    }

    // --- Edge cases (T039) ---

    [Fact]
    public void Parse_NullInput_ReturnsZeroRows()
    {
        var result = MonthlySummaryParser.Parse(null);

        Assert.Empty(result.Rows);
        Assert.False(result.HeaderDetectionWarning);
    }

    [Fact]
    public void TryParseDays_Zero_ReturnsFalseForPositiveCheck()
    {
        var parsed = MonthlySummaryParser.TryParseDays("0", out var days);

        Assert.True(parsed);
        Assert.Equal(0, days);
    }

    [Fact]
    public void TryParseMiles_Zero_ParsesButIsNotPositive()
    {
        var parsed = MonthlySummaryParser.TryParseMiles("0", out var miles);

        Assert.True(parsed);
        Assert.Equal(0m, miles);
    }

    [Fact]
    public void TryParseMiles_Negative_ParsesNegativeValue()
    {
        var parsed = MonthlySummaryParser.TryParseMiles("-10", out var miles);

        Assert.True(parsed);
        Assert.Equal(-10m, miles);
    }

    [Fact]
    public void TryParseMiles_CommaThousandsSeparator_StripsCommaAndParses()
    {
        var parsed = MonthlySummaryParser.TryParseMiles("1,200.5", out var miles);

        Assert.True(parsed);
        Assert.Equal(1200.5m, miles);
    }

    [Fact]
    public void TryParseMonth_TypoInMonthName_ReturnsFalse()
    {
        var parsed = MonthlySummaryParser.TryParseMonth("Jnauary", out _, out _);

        Assert.False(parsed);
    }
}
