using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

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

        var lines = csvText
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (lines.Length == 0)
        {
            return new ParsedExpenseCsvDocument([]);
        }

        var headers = SplitCsvLine(lines[0]).Select(static value => NormalizeHeader(value)).ToArray();
        var missingRequired = RequiredColumns.Where(required => !headers.Contains(required)).ToArray();
        if (missingRequired.Length > 0)
        {
            var displayNames = missingRequired.Select(static required =>
                required[..1] + required[1..].ToLowerInvariant()
            );
            throw new ArgumentException($"Missing required columns: {string.Join(", ", displayNames)}");
        }

        var columnIndex = headers
            .Select((header, index) => new { header, index })
            .ToDictionary(static value => value.header, static value => value.index, StringComparer.Ordinal);

        var rows = new List<ParsedExpenseCsvRow>();
        for (var lineIndex = 1; lineIndex < lines.Length; lineIndex++)
        {
            var values = SplitCsvLine(lines[lineIndex]);

            string? GetValue(string header)
            {
                if (!columnIndex.TryGetValue(header, out var index) || index >= values.Count)
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
            errors.Add(new ExpenseImportValidationError("INVALID_DATE", "Date", "Date is required and must be parseable."));
        }

        if (!TryParseAmount(row.Amount, out var parsedAmount) || parsedAmount <= 0m)
        {
            errors.Add(new ExpenseImportValidationError("INVALID_AMOUNT", "Amount", "Amount must be greater than zero."));
        }

        if (row.Note is not null && row.Note.Length > 500)
        {
            errors.Add(new ExpenseImportValidationError("NOTE_TOO_LONG", "Note", "Note must be 500 characters or fewer."));
        }

        return errors;
    }

    public string NormalizeAmount(string amount)
    {
        ArgumentNullException.ThrowIfNull(amount);

        var normalized = amount.Trim();
        normalized = normalized.TrimStart('$', '£', '€', '¥');
        normalized = normalized.Replace(",", string.Empty, StringComparison.Ordinal);
        normalized = Regex.Replace(normalized, "\\s*[A-Z]{3}$", string.Empty, RegexOptions.CultureInvariant);
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

    private static string NormalizeHeader(string value)
    {
        return value.Trim().Trim('\uFEFF').ToUpperInvariant();
    }

    private static List<string> SplitCsvLine(string line)
    {
        var values = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"')
            {
                if (inQuotes && index + 1 < line.Length && line[index + 1] == '"')
                {
                    current.Append('"');
                    index += 1;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (character == ',' && !inQuotes)
            {
                values.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(character);
        }

        values.Add(current.ToString());
        return values;
    }
}

public sealed record ParsedExpenseCsvDocument(IReadOnlyList<ParsedExpenseCsvRow> Rows);

public sealed record ParsedExpenseCsvRow(int RowNumber, string? Date, string? Amount, string? Note);

public sealed record ExpenseImportValidationError(string Code, string Field, string Message);