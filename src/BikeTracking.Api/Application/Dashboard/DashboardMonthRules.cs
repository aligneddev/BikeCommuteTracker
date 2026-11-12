namespace BikeTracking.Api.Application.Dashboard;

internal static class DashboardMonthRules
{
    public static bool IsWithinMonth(DateTime value, int year, int month)
    {
        return value.Year == year && value.Month == month;
    }

    /// <summary>
    /// Returns the <c>yyyy-MM</c> key used to label monthly chart points.
    /// </summary>
    public static string GetMonthKey(int year, int month)
    {
        return $"{year:D4}-{month:D2}";
    }
}
