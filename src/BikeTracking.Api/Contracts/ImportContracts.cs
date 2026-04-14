namespace BikeTracking.Api.Contracts;

public sealed record ImportPreviewRequest(string FileName, string ContentBase64);

public sealed record ImportValidationError(
    int RowNumber,
    string Code,
    string Message,
    string? Field = null
);

public sealed record ImportDuplicateMatch(
    long ExistingRideId,
    string ExistingRideDate,
    decimal ExistingMiles
);

public sealed record ImportPreviewRow(
    int RowNumber,
    string? Date,
    decimal? Miles,
    int? RideMinutes,
    decimal? Temperature,
    string? Tags,
    string? Notes,
    bool IsValid,
    IReadOnlyList<ImportValidationError> Errors,
    IReadOnlyList<ImportDuplicateMatch> DuplicateMatches
);

public sealed record ImportPreviewResponse(
    long ImportJobId,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateRows,
    bool RequiresDuplicateResolution,
    IReadOnlyList<ImportPreviewRow> Rows
);

public sealed record ImportDuplicateResolution(int RowNumber, string Action);

public sealed record ImportStartRequest(
    long ImportJobId,
    bool OverrideAllDuplicates,
    IReadOnlyList<ImportDuplicateResolution>? Resolutions
);

public sealed record ImportStartResponse(long ImportJobId, string Status, DateTime StartedAtUtc);

public sealed record ImportStatusResponse(
    long ImportJobId,
    string Status,
    int TotalRows,
    int ProcessedRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows,
    int? PercentComplete,
    int? EtaMinutesRounded,
    DateTime CreatedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc,
    string? LastError
);

public sealed record ImportCancelResponse(
    long ImportJobId,
    string Status,
    int ProcessedRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows,
    DateTime CancelledAtUtc
);
