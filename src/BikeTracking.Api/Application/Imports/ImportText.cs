using System.Text;

namespace BikeTracking.Api.Application.Imports;

/// <summary>
/// Text handling shared by the ride, monthly summary, and expense import parsers.
/// </summary>
public static class ImportText
{
    /// <summary>
    /// Decodes uploaded bytes as UTF-8, honoring any byte order mark.
    /// </summary>
    public static string Decode(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var reader = new StreamReader(
            stream,
            encoding: Encoding.UTF8,
            detectEncodingFromByteOrderMarks: true
        );

        return reader.ReadToEnd();
    }

    /// <summary>
    /// Splits text into trimmed, non-empty lines regardless of line-ending style.
    /// </summary>
    public static string[] SplitLines(string text)
    {
        return text.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    public static string NormalizeHeader(string value) =>
        value.Trim().Trim('\uFEFF').ToUpperInvariant();

    /// <summary>
    /// Splits a single CSV line into fields, honoring RFC 4180 double-quote
    /// rules so that quoted fields may contain commas (e.g. "W-1, min13.5, avg16.8")
    /// and escaped quotes ("" within a quoted field represents a literal ").
    /// </summary>
    public static string[] SplitCsvLine(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    current.Append(c);
                }
            }
            else if (c == '"' && current.Length == 0)
            {
                inQuotes = true;
            }
            else if (c == ',')
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        fields.Add(current.ToString());
        return [.. fields];
    }
}
