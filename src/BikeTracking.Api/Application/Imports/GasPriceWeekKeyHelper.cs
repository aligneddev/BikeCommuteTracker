namespace BikeTracking.Api.Application.Imports;

/// <summary>
/// Helper for computing the Sunday start date (cache key) for a given date.
/// Used to deduplicate gas price lookups when multiple rows fall in the same week.
/// </summary>
public static class GasPriceWeekKeyHelper
{
    /// <summary>
    /// Computes the Sunday start date for the ISO week containing the given date.
    /// This serves as the cache key for weekly gas price lookups, ensuring that
    /// multiple rows in the same week result in only one API call.
    /// </summary>
    /// <param name="date">The date to compute the week start for</param>
    /// <returns>The DateOnly representing the Sunday start of the week</returns>
    /// <remarks>
    /// Example:
    /// - 2026-04-01 (Wednesday) → 2026-03-29 (Sunday)
    /// - 2026-03-29 (Sunday) → 2026-03-29 (Sunday)
    /// - 2026-03-30 (Monday) → 2026-03-29 (Sunday)
    /// </remarks>
    public static DateOnly GetWeekStartDate(DateOnly date)
    {
        // DayOfWeek: Sunday=0, Monday=1, ..., Saturday=6
        // We want to get to the preceding Sunday (or the same day if it's already Sunday)
        var dayOfWeek = date.DayOfWeek;
        var daysToSubtract = dayOfWeek == DayOfWeek.Sunday ? 0 : (int)dayOfWeek;
        return date.AddDays(-daysToSubtract);
    }
}
