namespace BikeTracking.Api.Application.Imports;

public sealed record ParsedMonthlySummaryDocument(
    bool HeaderDetectionWarning,
    IReadOnlyList<ParsedMonthlySummaryRow> Rows
);

public sealed record ParsedMonthlySummaryRow(
    int RowNumber,
    string? RawMonth,
    string? RawMiles,
    string? RawDays
);

public sealed record MonthlySummaryRow(
    int RowNumber,
    int? Month,
    string MonthName,
    decimal? Miles,
    int? Days,
    int? Year
);
