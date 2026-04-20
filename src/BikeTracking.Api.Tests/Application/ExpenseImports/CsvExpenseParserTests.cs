using BikeTracking.Api.Application.ExpenseImports;

namespace BikeTracking.Api.Tests.Application.ExpenseImports;

public sealed class CsvExpenseParserTests
{
    private readonly CsvExpenseParser parser = new();

    [Fact]
    public void Parse_WithUtf8BomAndCaseInsensitiveHeaders_ParsesRows()
    {
        var csv = "\uFEFFDATE,amount,nOtE\r\n2026-04-01,$25.00,Chain lube\r\n";

        var result = parser.Parse(csv);

        var row = Assert.Single(result.Rows);
        Assert.Equal(1, row.RowNumber);
        Assert.Equal("2026-04-01", row.Date);
        Assert.Equal("$25.00", row.Amount);
        Assert.Equal("Chain lube", row.Note);
    }

    [Fact]
    public void Parse_WithMissingAmountHeader_Throws()
    {
        var csv = "Date,Note\n2026-04-01,Missing amount";

        var exception = Assert.Throws<ArgumentException>(() => parser.Parse(csv));

        Assert.Contains("Amount", exception.Message);
    }

    [Theory]
    [InlineData("$1,250.00 USD", "1250.00")]
    [InlineData("£12.50 GBP", "12.50")]
    [InlineData(" 25.00 EUR ", "25.00")]
    public void NormalizeAmount_StripsCurrencyFormatting(string raw, string expected)
    {
        var normalized = parser.NormalizeAmount(raw);

        Assert.Equal(expected, normalized);
    }

    [Fact]
    public void ValidateRow_WithTooLongNote_ReturnsNoteError()
    {
        var row = new ParsedExpenseCsvRow(3, "2026-04-01", "15.50", new string('n', 501));

        var errors = parser.ValidateRow(row);

        var error = Assert.Single(errors);
        Assert.Equal("Note", error.Field);
    }
}
