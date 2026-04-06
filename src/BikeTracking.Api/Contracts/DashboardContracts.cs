namespace BikeTracking.Api.Contracts;

public sealed record DashboardResponse(
    DashboardTotals Totals,
    DashboardAverages Averages,
    DashboardCharts Charts,
    IReadOnlyList<DashboardMetricSuggestion> Suggestions,
    DashboardMissingData MissingData,
    DateTime GeneratedAtUtc
);

public sealed record DashboardTotals(
    DashboardMileageMetric CurrentMonthMiles,
    DashboardMileageMetric YearToDateMiles,
    DashboardMileageMetric AllTimeMiles,
    DashboardMoneySaved MoneySaved
);

public sealed record DashboardMileageMetric(decimal Miles, int RideCount, string Period);

public sealed record DashboardMoneySaved(
    decimal? MileageRateSavings,
    decimal? FuelCostAvoided,
    decimal? CombinedSavings,
    int QualifiedRideCount
);

public sealed record DashboardAverages(
    decimal? AverageTemperature,
    decimal? AverageMilesPerRide,
    decimal? AverageRideMinutes
);

public sealed record DashboardCharts(
    IReadOnlyList<DashboardMileagePoint> MileageByMonth,
    IReadOnlyList<DashboardSavingsPoint> SavingsByMonth
);

public sealed record DashboardMileagePoint(string MonthKey, string Label, decimal Miles);

public sealed record DashboardSavingsPoint(
    string MonthKey,
    string Label,
    decimal? MileageRateSavings,
    decimal? FuelCostAvoided,
    decimal? CombinedSavings
);

public sealed record DashboardMetricSuggestion(
    string MetricKey,
    string Title,
    string Description,
    bool IsEnabled,
    decimal? Value = null,
    string? UnitLabel = null
);

public sealed record DashboardMissingData(
    int RidesMissingSavingsSnapshot,
    int RidesMissingGasPrice,
    int RidesMissingTemperature,
    int RidesMissingDuration
);
