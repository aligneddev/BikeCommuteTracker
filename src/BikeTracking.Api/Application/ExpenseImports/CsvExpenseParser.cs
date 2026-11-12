using System.Globalization;
using System.Text.RegularExpressions;
using BikeTracking.Api.Application.Imports;

namespace BikeTracking.Api.Application.ExpenseImports;

public sealed class CsvExpenseParser
{
    private static readonly string[] RequiredColumns = ["DATE", "AMOUNT"];

    private static readonly string[] SupportedDateFormats =
    [
        "yyyy-MM-dd",
        "MM/dd/yyyy",
        "M/d/yyyy",
        "dd-MMM-yyyy",
        "d-MMM-yyyy",
        "MMM dd yyyy",
    ];

    public ParsedExpenseCsvDocument Parse(string csvText)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(csvText);

        var lines = ImportText.SplitLines(csvText);

        if (lines.Length == 0)
        {
            return new ParsedExpenseCsvDocument([]);
        }

        var headers = ImportText.SplitCsvLine(lines[0])
            .Select(static value => ImportText.NormalizeHeader(value))
            .ToArray();
        var missingRequired = RequiredColumns
            .Where(required => !headers.Contains(required))
            .ToArray();
        if (missingRequired.Length > 0)
        {
            var displayNames = missingRequired.Select(static required =>
                required[..1] + required[1..].ToLowerInvariant()
            );
            throw new ArgumentException(
                $"Missing required columns: {string.Join(", ", displayNames)}"
            );
        }

        var columnIndex = headers
            .Select((header, index) => new { header, index })
            .ToDictionary(
                static value => value.header,
                static value => value.index,
                StringComparer.Ordinal
            );

        var rows = new List<ParsedExpenseCsvRow>();
        for (var lineIndex = 1; lineIndex < lines.Length; lineIndex++)
        {
            var values = ImportText.SplitCsvLine(lines[lineIndex]);

            string? GetValue(string header)
            {
                if (!columnIndex.TryGetValue(header, out var index) || index >= values.Length)
                {
                    return null;
                }

                var value = values[index].Trim();
                return string.IsNullOrWhiteSpace(value) ? null : value;
            }

            var date = GetValue("DATE");
            var amount = GetValue("AMOUNT");
            var note = GetValue("NOTE");

            if (date is null && amount is null && note is null)
            {
                continue;
            }

            rows.Add(new ParsedExpenseCsvRow(lineIndex, date, amount, note));
        }

        return new ParsedExpenseCsvDocument(rows);
    }

    public IReadOnlyList<ExpenseImportValidationError> ValidateRow(ParsedExpenseCsvRow row)
    {
        ArgumentNullException.ThrowIfNull(row);

        var errors = new List<ExpenseImportValidationError>();
        if (!TryParseDate(row.Date, out _))
        {
            errors.Add(
                new ExpenseImportValidationError(
                    "INVALID_DATE",
                    "Date",
                    "Date is required and must be parseable."
                )
            );
        }

        if (!TryParseAmount(row.Amount, out var parsedAmount) || parsedAmount <= 0m)
        {
            errors.Add(
                new ExpenseImportValidationError(
                    "INVALID_AMOUNT",
                    "Amount",
                    "Amount must be greater than zero."
                )
            );
        }

        if (row.Note is not null && row.Note.Length > 500)
        {
            errors.Add(
                new ExpenseImportValidationError(
                    "NOTE_TOO_LONG",
                    "Note",
                    "Note must be 500 characters or fewer."
                )
            );
        }

        return errors;
    }

    public string NormalizeAmount(string amount)
    {
        ArgumentNullException.ThrowIfNull(amount);

        var normalized = amount.Trim();
        normalized = normalized.TrimStart('$', '£', '€', '¥');
        normalized = normalized.Replace(",", string.Empty, StringComparison.Ordinal);
        normalized = Regex.Replace(
            normalized,
            "\\s*[A-Z]{3}$",
            string.Empty,
            RegexOptions.CultureInvariant
        );
        return normalized.Trim();
    }

    public bool TryParseAmount(string? amount, out decimal parsedAmount)
    {
        if (string.IsNullOrWhiteSpace(amount))
        {
            parsedAmount = default;
            return false;
        }

        return decimal.TryParse(
            NormalizeAmount(amount),
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out parsedAmount
        );
    }

    public bool TryParseDate(string? rawDate, out DateOnly parsedDate)
    {
        if (string.IsNullOrWhiteSpace(rawDate))
        {
            parsedDate = default;
            return false;
        }

        return DateOnly.TryParseExact(
            rawDate.Trim(),
            SupportedDateFormats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces,
            out parsedDate
        );
    }
}

public sealed record ParsedExpenseCsvDocument(IReadOnlyList<ParsedExpenseCsvRow> Rows);

public sealed record ParsedExpenseCsvRow(int RowNumber, string? Date, string? Amount, string? Note);

public sealed record ExpenseImportValidationError(string Code, string Field, string Message);
