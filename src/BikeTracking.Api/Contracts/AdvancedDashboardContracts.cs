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
    DateTime GeneratedAtUtc
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
    decimal? CombinedSavings
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
