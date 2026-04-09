# API Contracts: CSV Ride Import

**Feature**: 013-csv-ride-import
**Date**: 2026-04-08
**Base path**: `/api/imports`

## New Endpoints

### POST `/api/imports/preview`

Uploads and validates CSV, creates `ImportJob` + `ImportRow` records in `awaiting-confirmation` state.

Request: multipart form-data
- `file`: CSV file (`.csv`, max 5 MB)

Response: `ImportPreviewResponse`

```csharp
public sealed record ImportPreviewResponse(
    long JobId,
    string FileName,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    IReadOnlyList<ImportRowErrorView> Errors,
    IReadOnlyList<ImportDuplicateView> Duplicates,
    bool CanStartImport
);

public sealed record ImportRowErrorView(
    int RowNumber,
    string Field,
    string Message
);

public sealed record ImportDuplicateView(
    int RowNumber,
    DateOnly RideDate,
    decimal Miles,
    IReadOnlyList<ExistingRideMatchView> ExistingMatches
);

public sealed record ExistingRideMatchView(
    long RideId,
    DateTime RideDateTimeLocal,
    decimal Miles,
    int? RideMinutes,
    decimal? Temperature,
    string? Tags,
    string? Notes
);
```

Errors:
- `400` invalid/missing file, bad CSV schema, file too large
- `401` unauthenticated

### POST `/api/imports/{jobId}/start`

Starts processing of a previewed import job.

```csharp
public sealed record StartImportRequest(
    bool OverrideAllDuplicates,
    IReadOnlyList<DuplicateResolutionChoice> DuplicateChoices
);

public sealed record DuplicateResolutionChoice(
    int RowNumber,
    string Resolution // "keep-existing" | "replace-with-import"
);

public sealed record StartImportResponse(
    long JobId,
    string Status,
    int TotalRows
);
```

Rules:
- Requires job ownership by authenticated rider
- If `OverrideAllDuplicates=true`, per-row duplicate choices are optional
- Rejects start when job is already processing/completed/cancelled

### GET `/api/imports/{jobId}/status`

Returns current persisted state for reconnect and polling fallback.

```csharp
public sealed record ImportStatusResponse(
    long JobId,
    string Status,
    int TotalRows,
    int ProcessedRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows,
    int? ProgressPercent,
    int? EtaRoundedMinutes,
    ImportCompletionSummary? Summary
);

public sealed record ImportCompletionSummary(
    int TotalRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows,
    int GasEnrichedRows,
    int WeatherEnrichedRows,
    bool Cancelled
);
```

### POST `/api/imports/{jobId}/cancel`

Requests cooperative cancellation for an in-progress import.

```csharp
public sealed record CancelImportResponse(
    long JobId,
    string Status,
    string Message
);
```

Rules:
- Cancellation keeps already-imported rows
- Idempotent if already cancelled/completed

## Real-time Progress Contract

Progress notifications are emitted for 25% milestones.

```csharp
public sealed record ImportProgressNotification(
    long JobId,
    int ProgressPercent, // 25, 50, 75, 100
    int ProcessedRows,
    int TotalRows,
    int? EtaRoundedMinutes,
    string Status
);
```

## Validation and behavior rules

- Required CSV columns: `Date`, `Miles` (case-insensitive)
- Optional CSV columns: `Time`, `Temp`, `Tags`, `Notes`
- Duplicate key: `Date + Miles`
- Enrichment rules:
  - Cache-first gas/weather lookup
  - On cache miss, perform external lookup
  - Retry once on external failure
  - If retry fails, skip enrichment field and continue row processing
  - External lookup throttle: max 4 calls/second

## Frontend TypeScript contract sketch

```typescript
export interface ImportPreviewResponse {
  jobId: number;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportRowErrorView[];
  duplicates: ImportDuplicateView[];
  canStartImport: boolean;
}

export interface ImportStatusResponse {
  jobId: number;
  status: "pending" | "validating" | "awaiting-confirmation" | "processing" | "completed" | "cancelled" | "failed";
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  progressPercent?: number;
  etaRoundedMinutes?: number;
  summary?: ImportCompletionSummary;
}
```

## Backward compatibility

- Existing ride create/edit/history contracts remain unchanged.
- Import is additive through new endpoints and new frontend route.
