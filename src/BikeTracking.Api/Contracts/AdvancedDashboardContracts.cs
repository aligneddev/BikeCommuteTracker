namespace BikeTracking.Api.Contracts;

public sealed record AdvancedDashboardResponse(
    AdvancedSavingsWindows SavingsWindows,
    IReadOnlyList<AdvancedDashboardSuggestion> Suggestions,
    AdvancedDashboardReminders Reminders,
    DateTime GeneratedAtUtc
);

/// <summary>Four time-window breakdown of savings.</summary>
public sealed record AdvancedSavingsWindows(
    AdvancedSavingsWindow Weekly,
    AdvancedSavingsWindow Monthly,
    AdvancedSavingsWindow Yearly,
    AdvancedSavingsWindow AllTime
);

/// <summary>Aggregated savings data for a single time window.</summary>
public sealed record AdvancedSavingsWindow(
    string Period,
    int RideCount,
    decimal TotalMiles,
    decimal? GallonsSaved,
    decimal? FuelCostAvoided,
    bool FuelCostEstimated,
    decimal? MileageRateSavings,
    decimal? CombinedSavings
);

/// <summary>Deterministic rule-based suggestion card.</summary>
public sealed record AdvancedDashboardSuggestion(
    string SuggestionKey,
    string Title,
    string Description,
    bool IsEnabled
);

/// <summary>Reminder flags shown when user settings are missing.</summary>
public sealed record AdvancedDashboardReminders(
    bool MpgReminderRequired,
    bool MileageRateReminderRequired
);
