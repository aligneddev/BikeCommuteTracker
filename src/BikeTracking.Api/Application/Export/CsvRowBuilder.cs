using System.Text;

namespace BikeTracking.Api.Application.Export;

/// <summary>
/// Lightweight RFC 4180-compliant CSV row builder.
/// Produces a single CSV row string from a sequence of string fields.
/// </summary>
/// <remarks>
/// Quoting rules:
/// <list type="bullet">
///   <item>A field is wrapped in double-quotes when it contains a comma, double-quote, carriage return, or line feed.</item>
///   <item>An embedded double-quote is escaped by doubling it: <c>"</c> → <c>""</c>.</item>
///   <item><see langword="null"/> fields are rendered as an empty string (no quotes).</item>
///   <item>Boolean callers should pass <c>"true"</c> or <c>"false"</c> as literals before calling.</item>
/// </list>
/// </remarks>
public static class CsvRowBuilder
{
    /// <summary>
    /// Builds a comma-separated header row from the supplied column names.
    /// Column names are written verbatim with no quoting.
    /// </summary>
    public static string BuildHeader(IEnumerable<string> columnNames) =>
        string.Join(',', columnNames);

    /// <summary>
    /// Builds a single RFC 4180-compliant CSV data row from the supplied fields.
    /// </summary>
    public static string BuildRow(IEnumerable<string?> fields)
    {
        var sb = new StringBuilder();
        var first = true;

        foreach (var field in fields)
        {
            if (!first)
            {
                sb.Append(',');
            }

            first = false;

            if (field is null || field.Length == 0)
            {
                // null or empty → blank cell, no quotes needed
                continue;
            }

            if (NeedsQuoting(field))
            {
                sb.Append('"');
                foreach (var ch in field)
                {
                    if (ch == '"')
                    {
                        sb.Append("\"\"");
                    }
                    else
                    {
                        sb.Append(ch);
                    }
                }

                sb.Append('"');
            }
            else
            {
                sb.Append(field);
            }
        }

        return sb.ToString();
    }

    private static bool NeedsQuoting(string field) =>
        field.Contains(',') || field.Contains('"') || field.Contains('\r') || field.Contains('\n');
}
