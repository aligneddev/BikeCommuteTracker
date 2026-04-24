using BikeTracking.Api.Application.Imports;
using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Tests.Application.Imports;

/// <summary>
/// Tests for Difficulty and Direction column support in CSV import (Feature 019).
/// Tests in this class are RED until CsvParser and CsvValidationRules are extended.
/// </summary>
public sealed class CsvImportDifficultyTests
{
    // --- CsvParser: column recognition ---

    [Fact]
    public void Parse_WithDifficultyAndDirectionColumns_ExtractsValues()
    {
        var csv = "Date,Miles,Difficulty,Direction\n2026-01-15,12.5,3,NE";
        var result = CsvParser.Parse(csv);
        Assert.Single(result.Rows);
        Assert.Equal("3", result.Rows[0].Difficulty);
        Assert.Equal("NE", result.Rows[0].Direction);
    }

    [Fact]
    public void Parse_WithDifficultyAndDirectionColumnsAbsent_NullProperties()
    {
        var csv = "Date,Miles,Time\n2026-01-15,12.5,45";
        var result = CsvParser.Parse(csv);
        Assert.Single(result.Rows);
        Assert.Null(result.Rows[0].Difficulty);
        Assert.Null(result.Rows[0].Direction);
    }

    [Fact]
    public void Parse_WithCaseInsensitiveDifficultyDirectionHeaders_ParsesCorrectly()
    {
        var csv = "date,miles,DIFFICULTY,DIRECTION\n2026-01-15,12.5,2,south";
        var result = CsvParser.Parse(csv);
        Assert.Single(result.Rows);
        Assert.Equal("2", result.Rows[0].Difficulty);
        Assert.Equal("south", result.Rows[0].Direction);
    }

    // --- CsvValidationRules: difficulty ---

    [Theory]
    [InlineData("1")]
    [InlineData("2")]
    [InlineData("3")]
    [InlineData("4")]
    [InlineData("5")]
    public void ValidateRow_WithValidDifficulty_NoErrors(string value)
    {
        var row = MakeRow(difficulty: value);
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field == "Difficulty");
    }

    [Theory]
    [InlineData("0")]
    [InlineData("6")]
    [InlineData("hard")]
    [InlineData("-1")]
    public void ValidateRow_WithInvalidDifficulty_ReturnsError(string value)
    {
        var row = MakeRow(difficulty: value);
        var errors = CsvValidationRules.ValidateRow(row);
        var error = Assert.Single(errors.Where(e => e.Field == "Difficulty"));
        Assert.Equal("INVALID_DIFFICULTY", error.Code);
        Assert.Contains("1", error.Message);
        Assert.Contains("5", error.Message);
    }

    [Fact]
    public void ValidateRow_WithNullDifficulty_NoErrors()
    {
        var row = MakeRow(difficulty: null);
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field == "Difficulty");
    }

    // --- CsvValidationRules: direction ---

    [Theory]
    [InlineData("North")]
    [InlineData("NE")]
    [InlineData("East")]
    [InlineData("SE")]
    [InlineData("South")]
    [InlineData("SW")]
    [InlineData("West")]
    [InlineData("NW")]
    public void ValidateRow_WithValidDirection_NoErrors(string value)
    {
        var row = MakeRow(direction: value);
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field == "Direction");
    }

    [Theory]
    [InlineData("north")]
    [InlineData("NORTH")]
    [InlineData("ne")]
    public void ValidateRow_WithValidDirectionCaseInsensitive_NoErrors(string value)
    {
        var row = MakeRow(direction: value);
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field == "Direction");
    }

    [Theory]
    [InlineData("Northeast")]
    [InlineData("E/W")]
    [InlineData("Up")]
    [InlineData("Invalid")]
    public void ValidateRow_WithInvalidDirection_ReturnsError(string value)
    {
        var row = MakeRow(direction: value);
        var errors = CsvValidationRules.ValidateRow(row);
        var error = Assert.Single(errors.Where(e => e.Field == "Direction"));
        Assert.Equal("INVALID_DIRECTION", error.Code);
        // Should list accepted values
        Assert.Contains("North", error.Message);
        Assert.Contains("NE", error.Message);
    }

    [Fact]
    public void ValidateRow_WithNullDirection_NoErrors()
    {
        var row = MakeRow(direction: null);
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field == "Direction");
    }

    [Fact]
    public void ValidateRow_WithBothColumnsAbsent_NoErrors()
    {
        var row = new ParsedCsvRow(
            RowNumber: 1,
            Date: "2026-01-15",
            Miles: "12.5",
            Time: null,
            Temp: null,
            Tags: null,
            Notes: null,
            Difficulty: null,
            Direction: null
        );
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field is "Difficulty" or "Direction");
    }

    [Fact]
    public void ValidateRow_WithOnlyDifficultyPresent_ValidatesOnlyDifficulty()
    {
        var row = MakeRow(difficulty: "3", direction: null);
        var errors = CsvValidationRules.ValidateRow(row);
        Assert.DoesNotContain(errors, e => e.Field is "Difficulty" or "Direction");
    }

    private static ParsedCsvRow MakeRow(string? difficulty = null, string? direction = null)
        => new ParsedCsvRow(
            RowNumber: 1,
            Date: "2026-01-15",
            Miles: "12.5",
            Time: null,
            Temp: null,
            Tags: null,
            Notes: null,
            Difficulty: difficulty,
            Direction: direction
        );
}
