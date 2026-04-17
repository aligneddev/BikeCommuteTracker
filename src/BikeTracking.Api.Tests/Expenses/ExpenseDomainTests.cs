using System;
using BikeTracking.Domain.FSharp.Expenses;
using Microsoft.FSharp.Core;
using Microsoft.FSharp.Reflection;

namespace BikeTracking.Api.Tests.Expenses;

public sealed class ExpenseDomainTests
{
    [Fact]
    public void ValidateAmount_RejectsZeroAndNegativeValues()
    {
        var zeroResult = ExpenseEvents.validateAmount(0m);
        var negativeResult = ExpenseEvents.validateAmount(-1m);

        AssertResultIsError(zeroResult);
        AssertResultIsError(negativeResult);
    }

    [Fact]
    public void ValidateAmount_AcceptsPositiveValue()
    {
        var result = ExpenseEvents.validateAmount(12.34m);

        var (caseName, fields) = GetUnionCase(result);
        Assert.Equal("Ok", caseName);
        Assert.Single(fields);
        Assert.Equal(12.34m, Assert.IsType<decimal>(fields[0]));
    }

    [Fact]
    public void ValidateNotes_RejectsValuesLongerThan500Characters()
    {
        var notes = new string('n', 501);

        var result = ExpenseEvents.validateNotes(FSharpOption<string>.Some(notes));

        AssertResultIsError(result);
    }

    [Fact]
    public void ValidateNotes_AcceptsNoneAndShortValues()
    {
        var noneResult = ExpenseEvents.validateNotes(FSharpOption<string>.None);
        var shortResult = ExpenseEvents.validateNotes(FSharpOption<string>.Some("Chain lube"));

        var (noneCaseName, noneFields) = GetUnionCase(noneResult);
        var (shortCaseName, shortFields) = GetUnionCase(shortResult);

        Assert.Equal("Ok", noneCaseName);
        Assert.Single(noneFields);
        Assert.Null(noneFields[0]);

        Assert.Equal("Ok", shortCaseName);
        Assert.Single(shortFields);
        Assert.Equal("Chain lube", Assert.IsType<FSharpOption<string>>(shortFields[0]).Value);
    }

    [Fact]
    public void ValidateDate_RejectsDateTimeMinValue()
    {
        var result = ExpenseEvents.validateDate(DateTime.MinValue);

        AssertResultIsError(result);
    }

    [Fact]
    public void ValidateDate_AcceptsValidDate()
    {
        var expenseDate = new DateTime(2026, 4, 17, 0, 0, 0, DateTimeKind.Local);

        var result = ExpenseEvents.validateDate(expenseDate);

        var (caseName, fields) = GetUnionCase(result);
        Assert.Equal("Ok", caseName);
        Assert.Single(fields);
        Assert.Equal(expenseDate, Assert.IsType<DateTime>(fields[0]));
    }

    private static void AssertResultIsError(FSharpResult<decimal, string> result)
    {
        var (caseName, _) = GetUnionCase(result);
        Assert.Equal("Error", caseName);
    }

    private static void AssertResultIsError(FSharpResult<FSharpOption<string>, string> result)
    {
        var (caseName, _) = GetUnionCase(result);
        Assert.Equal("Error", caseName);
    }

    private static void AssertResultIsError(FSharpResult<DateTime, string> result)
    {
        var (caseName, _) = GetUnionCase(result);
        Assert.Equal("Error", caseName);
    }

    private static (string CaseName, object[] Fields) GetUnionCase(
        FSharpResult<decimal, string> result
    )
    {
        var union = FSharpValue.GetUnionFields(result, typeof(FSharpResult<decimal, string>), null);
        return (union.Item1.Name, union.Item2);
    }

    private static (string CaseName, object[] Fields) GetUnionCase(
        FSharpResult<FSharpOption<string>, string> result
    )
    {
        var union = FSharpValue.GetUnionFields(
            result,
            typeof(FSharpResult<FSharpOption<string>, string>),
            null
        );
        return (union.Item1.Name, union.Item2);
    }

    private static (string CaseName, object[] Fields) GetUnionCase(
        FSharpResult<DateTime, string> result
    )
    {
        var union = FSharpValue.GetUnionFields(
            result,
            typeof(FSharpResult<DateTime, string>),
            null
        );
        return (union.Item1.Name, union.Item2);
    }
}
