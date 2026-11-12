namespace BikeTracking.Api.Application.Rides;

public static class GasGradeRules
{
    public const string Regular = "Regular";
    public const string Premium = "Premium";

    /// <summary>
    /// Matches <paramref name="grade"/> case-insensitively against the supported grades and
    /// returns the canonical spelling.
    /// </summary>
    public static bool TryNormalize(string? grade, out string normalizedGrade)
    {
        if (string.Equals(grade, Regular, StringComparison.OrdinalIgnoreCase))
        {
            normalizedGrade = Regular;
            return true;
        }

        if (string.Equals(grade, Premium, StringComparison.OrdinalIgnoreCase))
        {
            normalizedGrade = Premium;
            return true;
        }

        normalizedGrade = string.Empty;
        return false;
    }

    /// <summary>
    /// Returns the canonical grade, falling back to <see cref="Regular"/> for missing or
    /// unrecognized values.
    /// </summary>
    public static string NormalizeOrDefault(string? grade)
    {
        return TryNormalize(grade, out var normalizedGrade) ? normalizedGrade : Regular;
    }
}
