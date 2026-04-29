namespace BikeTracking.Api.Application.Imports;

public sealed record ParsedCsvRow(
    int RowNumber,
    string? Date,
    string? Miles,
    string? Time,
    string? Temp,
    string? Tags,
    string? Notes,
    string? Difficulty = null,
    string? PrimaryTravelDirection = null
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

            var date = GetValue("DATE");
            var miles = GetValue("MILES");
            var time = GetValue("TIME");
            var temp = GetValue("TEMP");
            var tags = GetValue("TAGS");
            var notes = GetValue("NOTES");
            var difficulty = GetValue("DIFFICULTY");
            // Only accept the canonical header `PrimaryTravelDirection` (no legacy aliases)
            var primaryTravelDirection = GetValue("PRIMARYTRAVELDIRECTION");

            if (
                date is null
                && miles is null
                && time is null
                && temp is null
                && tags is null
                && notes is null
                && difficulty is null
                && primaryTravelDirection is null
            )
            {
                continue;
            }

            rows.Add(
                new ParsedCsvRow(
                    RowNumber: lineIndex,
                    Date: date,
                    Miles: miles,
                    Time: time,
                    Temp: temp,
                    Tags: tags,
                    Notes: notes,
                    Difficulty: difficulty,
                    PrimaryTravelDirection: primaryTravelDirection
                )
            );
        }

        return new ParsedCsvDocument(rows);
    }

    private static string NormalizeHeader(string value) =>
        value.Trim().Trim('\uFEFF').ToUpperInvariant();
}
