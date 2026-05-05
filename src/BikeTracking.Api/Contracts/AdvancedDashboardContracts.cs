namespace BikeTracking.Api.Contracts;

/// <summary>
/// Top-level response for the advanced statistics dashboard.
/// Contains savings metrics across four calendar windows, personalized suggestions,
/// and reminder flags for missing user settings.
/// </summary>
public sealed record AdvancedDashboardResponse(
    AdvancedSavingsWindows SavingsWindows,
    IReadOnlyList<AdvancedDashboardSuggestion> Suggestions,
    AdvancedDashboardReminders Reminders,
    /// <summary>UTC timestamp when the response was generated (useful for caching/staleness checks).</summary>
    DateTime GeneratedAtUtc,
    /// <summary>Difficulty analytics section. Null when no qualifying ride data exists.</summary>
    AdvancedDashboardDifficultySection? DifficultySection = null
);

/// <summary>
/// Difficulty analytics section of the Advanced Dashboard.
/// </summary>
public sealed record AdvancedDashboardDifficultySection(
    /// <summary>Overall average difficulty across all qualifying rides (1 decimal place). Null when no qualifying rides.</summary>
    decimal? OverallAverageDifficulty,
    /// <summary>Average difficulty by calendar month. At most 12 entries; sorted by month number ascending.</summary>
    IReadOnlyList<DifficultyByMonth> DifficultyByMonth,
    /// <summary>Same months ranked by average difficulty descending (most difficult first).</summary>
    IReadOnlyList<DifficultyByMonth> MostDifficultMonths,
    /// <summary>Distribution of rides across wind resistance bins −4 to +4. Always 9 entries.</summary>
    IReadOnlyList<WindResistanceBin> WindResistanceDistribution,
    /// <summary>True when the section is showing an empty state (no qualifying data).</summary>
    bool IsEmpty
);

/// <summary>Average difficulty for a calendar month.</summary>
public sealed record DifficultyByMonth(
    /// <summary>Month number 1–12.</summary>
    int MonthNumber,
    /// <summary>Full month name, e.g. "January".</summary>
    string MonthName,
    /// <summary>Average difficulty for this month across all years (1 decimal place).</summary>
    decimal AverageDifficulty,
    /// <summary>Number of qualifying rides in this month group.</summary>
    int RideCount
);

/// <summary>Count of rides at a given wind resistance level.</summary>
public sealed record WindResistanceBin(
    /// <summary>Wind resistance rating (−4 to +4).</summary>
    int Rating,
    /// <summary>Number of rides with this stored WindResistanceRating.</summary>
    int RideCount,
    /// <summary>Label for display: e.g. "−4 (strong tailwind)" … "+4 (strong headwind)".</summary>
    string Label,
    /// <summary>True when rating is negative (tailwind/assisted). Used for visual distinction.</summary>
    bool IsAssisted
);

/// <summary>Four calendar time-window breakdown of savings: week, month, year, all-time.</summary>
public sealed record AdvancedSavingsWindows(
    AdvancedSavingsWindow Weekly,
    AdvancedSavingsWindow Monthly,
    AdvancedSavingsWindow Yearly,
    AdvancedSavingsWindow AllTime
);

/// <summary>Aggregated savings data for a single time window.</summary>
public sealed record AdvancedSavingsWindow(
    /// <summary>Window identifier: "weekly", "monthly", "yearly", or "allTime".</summary>
    string Period,
    int RideCount,
    decimal TotalMiles,
    /// <summary>Total gallons of gas saved vs driving. Null when no rides have a valid MPG snapshot.</summary>
    decimal? GallonsSaved,
    /// <summary>Total fuel cost avoided in USD. Null when gas price data is unavailable for all rides.</summary>
    decimal? FuelCostAvoided,
    /// <summary>True when any ride in this window used a fallback gas-price lookup rather than a recorded price.</summary>
    bool FuelCostEstimated,
    /// <summary>Total IRS mileage-rate savings in USD. Null when no rides have a valid mileage-rate snapshot.</summary>
    decimal? MileageRateSavings,
    /// <summary>Sum of <see cref="FuelCostAvoided"/> and <see cref="MileageRateSavings"/>. Null when both are null.</summary>
    decimal? CombinedSavings,
    /// <summary>Sum of non-deleted manual expense amounts with ExpenseDate within this window's date range.</summary>
    decimal TotalExpenses,
    /// <summary>
    /// Oil-change savings attributed to this window, computed by the number of 3000-mile intervals
    /// crossed during the window (cumulative miles before window start vs window end) × OilChangePrice.
    /// Null when OilChangePrice is not configured in user settings.
    /// </summary>
    decimal? OilChangeSavings,
    /// <summary>
    /// Net financial position: (FuelCostAvoided ?? 0) + (MileageRateSavings ?? 0) + (OilChangeSavings ?? 0) − TotalExpenses.
    /// Null only when all savings components are null and expenses are zero.
    /// Can be negative when expenses exceed savings.
    /// </summary>
    decimal? NetSavings
);

/// <summary>
/// Deterministic rule-based suggestion card. Three types are always returned;
/// <see cref="IsEnabled"/> indicates whether the trigger condition is currently met.
/// </summary>
public sealed record AdvancedDashboardSuggestion(
    /// <summary>Stable identifier: "consistency", "milestone", or "comeback".</summary>
    string SuggestionKey,
    string Title,
    string Description,
    /// <summary>True when the rule condition is satisfied and this suggestion should be displayed.</summary>
    bool IsEnabled
);

/// <summary>
/// Reminder flags shown when required user settings are missing.
/// When true, the frontend displays a card prompting the user to configure the setting.
/// </summary>
public sealed record AdvancedDashboardReminders(
    /// <summary>True when the user has no <c>AverageCarMpg</c> setting; gallons/fuel savings will be null.</summary>
    bool MpgReminderRequired,
    /// <summary>True when the user has no <c>MileageRateCents</c> setting; mileage-rate savings will be null.</summary>
    bool MileageRateReminderRequired
);
