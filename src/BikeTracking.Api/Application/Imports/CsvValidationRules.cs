using System.Globalization;
using BikeTracking.Api.Contracts;
using BikeTracking.Domain.FSharp;
using Microsoft.FSharp.Core;

namespace BikeTracking.Api.Application.Imports;

public static class CsvValidationRules
{
    private static readonly string[] SupportedDateFormats =
    [
        "yyyy-MM-dd",
        "MM/dd/yyyy",
        "M/d/yyyy",
        "dd-MMM-yyyy",
        "d-MMM-yyyy",
        "MMM dd yyyy",
        "MM/dd/yy",
        "M/d/yy",
    ];

    public static IReadOnlyList<ImportValidationError> ValidateRow(ParsedCsvRow row)
    {
        var errors = new List<ImportValidationError>();

        if (IsMonthDayWithoutYear(row.Date))
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_DATE",
                    $"Date '{row.Date}' contains only a month and day without a year. "
                        + "Change the Date column to a short date format (e.g. 3/12/2026) and re-save the file.",
                    "Date"
                )
            );
        }
        else if (!TryParseDate(row.Date, out _))
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_DATE",
                    "Date is required and must be parseable.",
                    "Date"
                )
            );
        }

        if (!TryParseMiles(row.Miles, out _))
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_MILES",
                    "Miles must be greater than 0 and less than or equal to 200.",
                    "Miles"
                )
            );
        }

        if (!TryParseRideMinutes(row.Time, out _))
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_TIME",
                    "Time must be a positive minute value or HH:mm.",
                    "Time"
                )
            );
        }

        if (row.Temp is not null && !TryParseTemperature(row.Temp, out _))
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "INVALID_TEMP",
                    "Temp must be a numeric value.",
                    "Temp"
                )
            );
        }

        if (row.Notes is not null && row.Notes.Length > 500)
        {
            errors.Add(
                new ImportValidationError(
                    row.RowNumber,
                    "NOTE_TOO_LONG",
                    "Note must be 500 characters or fewer.",
                    "Notes"
                )
            );
        }

        if (row.Difficulty is not null)
        {
            if (
                !int.TryParse(row.Difficulty, out var difficulty)
                || difficulty < 1
                || difficulty > 5
            )
            {
                errors.Add(
                    new ImportValidationError(
                        row.RowNumber,
                        "INVALID_DIFFICULTY",
                        $"Difficulty '{row.Difficulty}' is not valid. Must be an integer between 1 (Very Easy) and 5 (Very Hard).",
                        "Difficulty"
                    )
                );
            }
        }

        if (row.PrimaryTravelDirection is not null)
        {
            var validDirections = WindResistance.validDirectionNames.ToList();
            var isValid = validDirections.Any(d =>
                string.Equals(
                    d,
                    row.PrimaryTravelDirection.Trim(),
                    StringComparison.OrdinalIgnoreCase
                )
            );

            if (!isValid)
            {
                errors.Add(
                    new ImportValidationError(
                        row.RowNumber,
                        "INVALID_DIRECTION",
                        $"PrimaryTravelDirection '{row.PrimaryTravelDirection}' is not recognised. Accepted values: {string.Join(", ", validDirections)}.",
                        "PrimaryTravelDirection"
                    )
                );
            }
        }

        return errors;
    }

    public static bool TryParseDate(string? rawDate, out DateOnly value)
    {
        if (string.IsNullOrWhiteSpace(rawDate))
        {
            value = default;
            return false;
        }

        var trimmed = rawDate.Trim();

        if (
            DateOnly.TryParseExact(
                trimmed,
                SupportedDateFormats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out value
            )
        )
        {
            return true;
        }

        // Accept day-month-without-year (e.g. "12-Mar") and default to the current year.
        // Month-first yearless patterns (e.g. "Mar-12") are rejected via IsMonthDayWithoutYear.
        if (
            DateTime.TryParseExact(
                trimmed,
                ["dd-MMM", "d-MMM"],
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out var dayMonthOnly
            )
        )
        {
            value = new DateOnly(DateTime.Now.Year, dayMonthOnly.Month, dayMonthOnly.Day);
            return true;
        }

        value = default;
        return false;
    }

    /// <summary>
    /// Returns true when the input looks like a month-name + day number without a year
    /// (e.g. "Mar-12" or "Mar 12"). These formats are ambiguous and must be rejected.
    /// </summary>
    public static bool IsMonthDayWithoutYear(string? rawDate)
    {
        if (string.IsNullOrWhiteSpace(rawDate))
        {
            return false;
        }

        return DateTime.TryParseExact(
            rawDate.Trim(),
            ["MMM-d", "MMM-dd", "MMM d", "MMM dd"],
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces,
            out _
        );
    }

    public static bool TryParseMiles(string? rawMiles, out decimal value)
    {
        if (
            decimal.TryParse(rawMiles, NumberStyles.Number, CultureInfo.InvariantCulture, out value)
        )
        {
            return value > 0m && value <= 200m;
        }

        value = default;
        return false;
    }

    public static bool TryParseRideMinutes(string? rawTime, out int? value)
    {
        if (string.IsNullOrWhiteSpace(rawTime))
        {
            value = null;
            return true;
        }

        if (
            int.TryParse(
                rawTime,
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var minutes
            )
        )
        {
            value = minutes;
            return minutes > 0;
        }

        var parts = rawTime.Split(':', StringSplitOptions.TrimEntries);
        if (
            parts.Length == 2
            && int.TryParse(parts[0], out var hours)
            && int.TryParse(parts[1], out var mins)
            && hours >= 0
            && mins >= 0
            && mins < 60
        )
        {
            var totalMinutes = (hours * 60) + mins;
            value = totalMinutes;
            return totalMinutes > 0;
        }

        value = null;
        return false;
    }

    public static bool TryParseTemperature(string? rawTemp, out decimal? value)
    {
        if (string.IsNullOrWhiteSpace(rawTemp))
        {
            value = null;
            return true;
        }

        if (
            decimal.TryParse(
                rawTemp,
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out var parsed
            )
        )
        {
            value = parsed;
            return true;
        }

        value = null;
        return false;
    }
}
