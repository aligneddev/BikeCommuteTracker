namespace BikeTracking.Api.Application.Imports;

public sealed record ParsedCsvRow(
    int RowNumber,
    string? Date,
    string? Miles,
    string? Time,
    string? Temp,
    string? Tags,
    string? Notes
);

public sealed record ParsedCsvDocument(IReadOnlyList<ParsedCsvRow> Rows);

public static class CsvParser
{
    private static readonly string[] RequiredColumns = ["DATE", "MILES"];

    public static ParsedCsvDocument Parse(string csvText)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(csvText);

        var lines = csvText
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (lines.Length == 0)
        {
            return new ParsedCsvDocument([]);
        }

        var headers = lines[0]
            .Split(',', StringSplitOptions.None)
            .Select(static value => NormalizeHeader(value))
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
            .ToDictionary(static x => x.header, static x => x.index, StringComparer.Ordinal);

        var rows = new List<ParsedCsvRow>();
        for (var lineIndex = 1; lineIndex < lines.Length; lineIndex++)
        {
            var values = lines[lineIndex].Split(',', StringSplitOptions.None);

            string? GetValue(string header)
            {
                if (!columnIndex.TryGetValue(header, out var index) || index >= values.Length)
                {
                    return null;
                }

                var value = values[index].Trim();
                return string.IsNullOrWhiteSpace(value) ? null : value;
            }

            rows.Add(
                new ParsedCsvRow(
                    RowNumber: lineIndex,
                    Date: GetValue("DATE"),
                    Miles: GetValue("MILES"),
                    Time: GetValue("TIME"),
                    Temp: GetValue("TEMP"),
                    Tags: GetValue("TAGS"),
                    Notes: GetValue("NOTES")
                )
            );
        }

        return new ParsedCsvDocument(rows);
    }

    private static string NormalizeHeader(string value) => value.Trim().ToUpperInvariant();
}
