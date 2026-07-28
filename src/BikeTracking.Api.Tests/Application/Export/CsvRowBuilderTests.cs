using BikeTracking.Api.Application.Export;

namespace BikeTracking.Api.Tests.Application.Export;

public sealed class CsvRowBuilderTests
{
    // ──────────────────────────────────────────────────────────────────────
    // BuildHeader
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildHeader_WithSingleColumn_ReturnsSingleField()
    {
        var result = CsvRowBuilder.BuildHeader(["ExpenseId"]);

        Assert.Equal("ExpenseId", result);
    }

    [Fact]
    public void BuildHeader_WithMultipleColumns_ReturnsCommaSeparated()
    {
        var result = CsvRowBuilder.BuildHeader(["ExpenseId", "Date", "Amount", "Notes", "CreatedAtUtc"]);

        Assert.Equal("ExpenseId,Date,Amount,Notes,CreatedAtUtc", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — null handling
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_NullField_RendersAsBlank()
    {
        var result = CsvRowBuilder.BuildRow(["123", null, "2026-01-01"]);

        Assert.Equal("123,,2026-01-01", result);
    }

    [Fact]
    public void BuildRow_AllNullFields_RendersAsAllBlanks()
    {
        var result = CsvRowBuilder.BuildRow([null, null, null]);

        Assert.Equal(",,", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — plain fields (no quoting required)
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_PlainFields_NoQuoting()
    {
        var result = CsvRowBuilder.BuildRow(["101", "2026-01-15", "49.95"]);

        Assert.Equal("101,2026-01-15,49.95", result);
    }

    [Fact]
    public void BuildRow_EmptyString_NoQuoting()
    {
        var result = CsvRowBuilder.BuildRow(["101", "", "49.95"]);

        Assert.Equal("101,,49.95", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — RFC 4180 quoting: comma triggers quoting
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_FieldContainsComma_IsQuoted()
    {
        var result = CsvRowBuilder.BuildRow(["Tyre, inner tube"]);

        Assert.Equal("\"Tyre, inner tube\"", result);
    }

    [Fact]
    public void BuildRow_FieldContainsCommaInMiddle_QuotedField()
    {
        var result = CsvRowBuilder.BuildRow(["101", "2026-01-15", "49.95", "Chain, oil, lube"]);

        Assert.Equal("101,2026-01-15,49.95,\"Chain, oil, lube\"", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — RFC 4180 quoting: double-quote triggers quoting and escaping
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_FieldContainsDoubleQuote_IsQuotedAndDoubled()
    {
        var result = CsvRowBuilder.BuildRow(["She said \"hello\""]);

        Assert.Equal("\"She said \"\"hello\"\"\"", result);
    }

    [Fact]
    public void BuildRow_FieldContainsDoubleQuoteAtStart_IsQuotedAndDoubled()
    {
        var result = CsvRowBuilder.BuildRow(["\"quoted\""]);

        Assert.Equal("\"\"\"quoted\"\"\"", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — RFC 4180 quoting: newline characters trigger quoting
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_FieldContainsNewline_IsQuoted()
    {
        var result = CsvRowBuilder.BuildRow(["line1\nline2"]);

        Assert.Equal("\"line1\nline2\"", result);
    }

    [Fact]
    public void BuildRow_FieldContainsCarriageReturn_IsQuoted()
    {
        var result = CsvRowBuilder.BuildRow(["line1\rline2"]);

        Assert.Equal("\"line1\rline2\"", result);
    }

    [Fact]
    public void BuildRow_FieldContainsCRLF_IsQuoted()
    {
        var result = CsvRowBuilder.BuildRow(["line1\r\nline2"]);

        Assert.Equal("\"line1\r\nline2\"", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — bool rendering
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_BoolTrueAsString_PassesThroughAsLiteral()
    {
        // CsvRowBuilder.BuildRow works with string? — callers pre-convert booleans.
        // "true" and "false" are plain strings with no special characters.
        var result = CsvRowBuilder.BuildRow(["true"]);
        Assert.Equal("true", result);
    }

    [Fact]
    public void BuildRow_BoolFalseAsString_PassesThroughAsLiteral()
    {
        var result = CsvRowBuilder.BuildRow(["false"]);
        Assert.Equal("false", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — combined complex row (realistic expense row)
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_RealisticExpenseRowWithQuotedNotes_FormatsCorrectly()
    {
        var result = CsvRowBuilder.BuildRow(["103", "2026-03-10", "7.50", "Tyre, inner tube", "2026-03-10T12:00:00Z"]);

        Assert.Equal("103,2026-03-10,7.50,\"Tyre, inner tube\",2026-03-10T12:00:00Z", result);
    }

    [Fact]
    public void BuildRow_ExpenseRowWithNullNotes_BlankNotesCell()
    {
        var result = CsvRowBuilder.BuildRow(["102", "2026-02-03", "12.00", null, "2026-02-03T08:00:00Z"]);

        Assert.Equal("102,2026-02-03,12.00,,2026-02-03T08:00:00Z", result);
    }

    // ──────────────────────────────────────────────────────────────────────
    // BuildRow — single-field edge cases
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BuildRow_EmptySequence_ReturnsEmptyString()
    {
        var result = CsvRowBuilder.BuildRow([]);

        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void BuildRow_SingleNullField_ReturnsBlank()
    {
        var result = CsvRowBuilder.BuildRow([null]);

        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void BuildRow_SinglePlainField_ReturnsFieldAsIs()
    {
        var result = CsvRowBuilder.BuildRow(["hello"]);

        Assert.Equal("hello", result);
    }
}
