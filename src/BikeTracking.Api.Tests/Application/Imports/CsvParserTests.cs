using BikeTracking.Api.Application.Imports;

namespace BikeTracking.Api.Tests.Application.Imports;

public sealed class CsvParserTests
{
    [Fact]
    public void Parse_WithCaseInsensitiveHeaders_ParsesRows()
    {
        var csv = "DATE,mIlEs,TiMe,Temp,Tags,Notes\n2026-04-01,12.5,45,60,commute,morning ride";

        var result = CsvParser.Parse(csv);

        Assert.Single(result.Rows);
        Assert.Equal(1, result.Rows[0].RowNumber);
        Assert.Equal("2026-04-01", result.Rows[0].Date);
        Assert.Equal("12.5", result.Rows[0].Miles);
        Assert.Equal("45", result.Rows[0].Time);
    }

    [Fact]
    public void Parse_WithoutRequiredDateHeader_Throws()
    {
        var csv = "Miles,Time,Temp\n12.5,45,60";

        var ex = Assert.Throws<ArgumentException>(() => CsvParser.Parse(csv));

        Assert.Contains("Date", ex.Message);
    }

    [Fact]
    public void ValidateRow_WithValidFields_ReturnsNoErrors()
    {
        var row = new ParsedCsvRow(1, "2026-04-01", "12.5", "1:30", "62", "commute", "note");

        var errors = CsvValidationRules.ValidateRow(row);

        Assert.Empty(errors);
    }

    [Fact]
    public void ValidateRow_WithInvalidDateMilesAndTime_ReturnsErrors()
    {
        var row = new ParsedCsvRow(2, "not-a-date", "201", "0", null, null, null);

        var errors = CsvValidationRules.ValidateRow(row);

        Assert.Contains(errors, e => e.Field == "Date");
        Assert.Contains(errors, e => e.Field == "Miles");
        Assert.Contains(errors, e => e.Field == "Time");
    }
}
