using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Application.Imports;

public static class MonthlySummaryValidationRules
{
    public static IReadOnlyList<ImportValidationError> ValidateRow(MonthlySummaryRow row)
    {
        var errors = new List<ImportValidationError>();

        if (row.Month is null)
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_MONTH",
                    "Unrecognised month name.",
                    "Month"
                )
            );
        }

        if (row.Miles is null || row.Miles <= 0m)
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_MILES",
                    "Miles must be greater than 0.",
                    "Miles"
                )
            );
        }

        if (row.Days is null || row.Days < 1)
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_DAYS",
                    "Days must be greater than 0.",
                    "Days"
                )
            );
        }

        if (row.Month is not null && row.Year is not null)
        {
            var weekdays = GetWeekdayCount(row.Month.Value, row.Year.Value);
            if (row.Days is not null && row.Days > weekdays)
            {
                errors.Add(
                    new ImportValidationError(
                        row.RowNumber,
                        "DAYS_EXCEED_WEEKDAYS",
                        $"Days ({row.Days}) exceeds available weekdays ({weekdays}) in {row.MonthName} {row.Year}.",
                        "Days"
                    )
                );
            }
        }

        if (row.Miles is not null && row.Days is not null && row.Days > 0)
        {
            var perDay = Math.Floor((row.Miles.Value / row.Days.Value) * 100m) / 100m;
            if (perDay > 200m)
            {
                errors.Add(
                    new ImportValidationError(
                        row.RowNumber,
                        "MILES_PER_DAY_EXCEEDS_LIMIT",
                        "Per-day miles must not exceed 200.",
                        "Miles"
                    )
                );
            }
        }

        return errors;
    }

    public static IReadOnlyDictionary<int, IReadOnlyList<ImportValidationError>> ValidateRows(
        IReadOnlyList<MonthlySummaryRow> rows
    )
    {
        var errorsByRow = rows.ToDictionary(
            row => row.RowNumber,
            row => (IReadOnlyList<ImportValidationError>)ValidateRow(row).ToList()
        );

        foreach (
            var duplicateGroup in rows.Where(row => row.Month is not null)
                .GroupBy(row => row.Month!.Value)
                .Where(group => group.Count() > 1)
        )
        {
            foreach (var row in duplicateGroup)
            {
                var current = errorsByRow[row.RowNumber].ToList();
                current.Add(
                    new ImportValidationError(
                        row.RowNumber,
                        "DUPLICATE_MONTH",
                        $"Month {row.MonthName} appears more than once in the input.",
                        "Month"
                    )
                );
                errorsByRow[row.RowNumber] = current;
            }
        }

        return errorsByRow;
    }

    private static int GetWeekdayCount(int month, int year)
    {
        var daysInMonth = DateTime.DaysInMonth(year, month);
        var count = 0;
        for (var day = 1; day <= daysInMonth; day++)
        {
            var date = new DateOnly(year, month, day);
            if (date.DayOfWeek is >= DayOfWeek.Monday and <= DayOfWeek.Friday)
            {
                count++;
            }
        }

        return count;
    }
}
