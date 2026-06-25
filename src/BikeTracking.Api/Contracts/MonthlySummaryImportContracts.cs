namespace BikeTracking.Api.Contracts;

public sealed record MonthlyImportPreviewRequest(
    string FileName,
    string ContentBase64,
    int StartYear
);

public sealed record MonthlyImportGeneratedRide(
    int RideIndex,
    string Date,
    decimal Miles,
    bool IsDuplicate,
    IReadOnlyList<ImportDuplicateMatch> DuplicateMatches
);

public sealed record MonthlyImportMonthRow(
    int RowNumber,
    string? RawMonth,
    int? Year,
    decimal? TotalMiles,
    int? Days,
    bool IsValid,
    IReadOnlyList<ImportValidationError> Errors,
    IReadOnlyList<MonthlyImportGeneratedRide> GeneratedRides
);

public sealed record MonthlyImportPreviewResponse(
    long ImportJobId,
    bool HeaderDetectionWarning,
    int TotalMonthRows,
    int ValidMonthRows,
    int InvalidMonthRows,
    int TotalGeneratedRides,
    int DuplicateRides,
    bool RequiresDuplicateResolution,
    IReadOnlyList<MonthlyImportMonthRow> MonthRows
);
