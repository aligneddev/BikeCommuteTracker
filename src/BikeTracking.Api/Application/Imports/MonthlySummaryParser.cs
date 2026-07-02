using System.Globalization;
using System.Text.RegularExpressions;

namespace BikeTracking.Api.Application.Imports;

public static class MonthlySummaryParser
{
    private static readonly IReadOnlyDictionary<string, int> MonthLookup = new Dictionary<
        string,
        int
    >(StringComparer.OrdinalIgnoreCase)
    {
        ["JANUARY"] = 1,
        ["JAN"] = 1,
        ["FEBRUARY"] = 2,
        ["FEB"] = 2,
        ["MARCH"] = 3,
        ["MAR"] = 3,
        ["APRIL"] = 4,
        ["APR"] = 4,
        ["MAY"] = 5,
        ["JUNE"] = 6,
        ["JUN"] = 6,
        ["JULY"] = 7,
        ["JUL"] = 7,
        ["AUGUST"] = 8,
        ["AUG"] = 8,
        ["SEPTEMBER"] = 9,
        ["SEP"] = 9,
        ["OCTOBER"] = 10,
        ["OCT"] = 10,
        ["NOVEMBER"] = 11,
        ["NOV"] = 11,
        ["DECEMBER"] = 12,
        ["DEC"] = 12,
    };

    public static ParsedMonthlySummaryDocument Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new ParsedMonthlySummaryDocument(false, []);
        }

        var lines = text.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (lines.Length == 0)
        {
            return new ParsedMonthlySummaryDocument(false, []);
        }

        var headerTokens = SplitTokens(lines[0]);
        var hasHeader =
            headerTokens.Any(token => token.Equals("MONTH", StringComparison.OrdinalIgnoreCase))
            && headerTokens.Any(token => token.Equals("MILES", StringComparison.OrdinalIgnoreCase))
            && headerTokens.Any(token => token.Equals("DAYS", StringComparison.OrdinalIgnoreCase));

        var rows = new List<ParsedMonthlySummaryRow>();
        if (hasHeader)
        {
            var headerIndex = headerTokens
                .Select((token, index) => new { token = token.Trim().ToUpperInvariant(), index })
                .ToDictionary(
                    static x => x.token,
                    static x => x.index,
                    StringComparer.OrdinalIgnoreCase
                );

            for (var lineIndex = 1; lineIndex < lines.Length; lineIndex++)
            {
                var tokens = SplitTokens(lines[lineIndex]);
                if (tokens.Length == 0)
                {
                    continue;
                }

                string? GetValue(string header) =>
                    headerIndex.TryGetValue(header, out var index) && index < tokens.Length
                        ? NormalizeCell(tokens[index])
                        : null;

                var month = GetValue("MONTH");
                var miles = GetValue("MILES");
                var days = GetValue("DAYS");

                if (month is null && miles is null && days is null)
                {
                    continue;
                }

                rows.Add(new ParsedMonthlySummaryRow(lineIndex, month, miles, days));
            }
        }
        else
        {
            for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++)
            {
                var tokens = SplitTokens(lines[lineIndex]);
                if (tokens.Length == 0)
                {
                    continue;
                }

                var month = NormalizeCell(tokens.ElementAtOrDefault(0));
                var miles = NormalizeCell(tokens.ElementAtOrDefault(1));
                var days = NormalizeCell(tokens.ElementAtOrDefault(2));

                if (month is null && miles is null && days is null)
                {
                    continue;
                }

                rows.Add(new ParsedMonthlySummaryRow(lineIndex + 1, month, miles, days));
            }
        }

        return new ParsedMonthlySummaryDocument(!hasHeader, rows);
    }

    public static bool TryParseMonth(string? rawMonth, out int month, out string monthName)
    {
        month = 0;
        monthName = string.Empty;
        if (string.IsNullOrWhiteSpace(rawMonth))
        {
            return false;
        }

        var cleaned = rawMonth.Trim().ToUpperInvariant();
        if (!MonthLookup.TryGetValue(cleaned, out month))
        {
            return false;
        }

        monthName = CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(month);
        return true;
    }

    public static bool TryParseMiles(string? rawMiles, out decimal miles)
    {
        miles = 0m;
        if (string.IsNullOrWhiteSpace(rawMiles))
        {
            return false;
        }

        var cleaned = rawMiles.Replace(",", string.Empty, StringComparison.Ordinal).Trim();
        return decimal.TryParse(
            cleaned,
            NumberStyles.Number,
            CultureInfo.InvariantCulture,
            out miles
        );
    }

    public static bool TryParseDays(string? rawDays, out int days) =>
        int.TryParse(rawDays, NumberStyles.Integer, CultureInfo.InvariantCulture, out days);

    private static string? NormalizeCell(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim().Trim('\uFEFF').Trim('"');
    }

    private static string[] SplitTokens(string line)
    {
        if (line.Contains('\t'))
        {
            return line.Split('\t', StringSplitOptions.None)
                .Select(NormalizeCell)
                .Where(x => x is not null)
                .Select(x => x!)
                .ToArray();
        }

        return Regex
            .Split(line.Trim(), @"\s+")
            .Select(NormalizeCell)
            .Where(token => token is not null)
            .Select(token => token!)
            .ToArray();
    }
}
