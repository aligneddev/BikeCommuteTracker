using System.Globalization;
using BikeTracking.Api.Contracts;

namespace BikeTracking.Api.Application.Imports;

public static class CsvValidationRules
{
    private static readonly string[] SupportedDateFormats =
    [
        "yyyy-MM-dd",
        "MM/dd/yyyy",
        "M/d/yyyy",
        "dd-MMM-yyyy",
        "MMM dd yyyy",
    ];

    public static IReadOnlyList<ImportValidationError> ValidateRow(ParsedCsvRow row)
    {
        var errors = new List<ImportValidationError>();

        if (!TryParseDate(row.Date, out _))
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

        return errors;
    }

    public static bool TryParseDate(string? rawDate, out DateOnly value)
    {
        if (string.IsNullOrWhiteSpace(rawDate))
        {
            value = default;
            return false;
        }

        return DateOnly.TryParseExact(
                rawDate,
                SupportedDateFormats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out value
            )
            || DateOnly.TryParse(
                rawDate,
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out value
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
