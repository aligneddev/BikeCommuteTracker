# API Contracts: Monthly Summary Import

**Feature**: `025-monthly-summary-import` | **Date**: 2026-06-25

Base path: `/api/monthly-imports`

All endpoints require a valid session (`RequireAuthorization`). The rider identity is resolved from the `sub` claim.

---

## Reused Contracts

The following contracts from `ImportContracts.cs` are **reused without modification**:

| Contract | Used by |
|----------|---------|
| `ImportStartRequest` | `POST /start` |
| `ImportStartResponse` | `POST /start` response |
| `ImportStatusResponse` | `GET /{id}/status` response |
| `ImportCancelResponse` | `POST /{id}/cancel` response |
| `ImportValidationError` | Embedded in preview row |
| `ImportDuplicateMatch` | Embedded in preview row |
| `ImportDuplicateResolution` | Embedded in start request |

---

## New Contracts

### `MonthlyImportPreviewRequest`

```csharp
public sealed record MonthlyImportPreviewRequest(
    /// <summary>File name (for display). "paste" when using textarea input.</summary>
    string FileName,
    /// <summary>
    /// Base64-encoded UTF-8 text content. Either file content or pasted text, both encoded.
    /// Max decoded size: 5 MB.
    /// </summary>
    string ContentBase64,
    /// <summary>
    /// Starting year for month-to-date assignment.
    /// Months crossing a December→January boundary use StartYear for the first year
    /// and StartYear+1 for subsequent months.
    /// </summary>
    int StartYear
);
```

### `MonthlyImportGeneratedRide`

Represents one generated ride record in the preview.

```csharp
public sealed record MonthlyImportGeneratedRide(
    /// <summary>Index within the month's generated rides (1-based).</summary>
    int RideIndex,
    /// <summary>Assigned weekday date (ISO 8601 date string, e.g. "2025-05-02").</summary>
    string Date,
    /// <summary>Miles assigned to this ride (2dp, last ride absorbs remainder).</summary>
    decimal Miles,
    /// <summary>True if this date collides with an existing ride record.</summary>
    bool IsDuplicate,
    /// <summary>Existing ride(s) on this date, if any.</summary>
    IReadOnlyList<ImportDuplicateMatch> DuplicateMatches
);
```

### `MonthlyImportMonthRow`

Represents one input row (one month) in the preview.

```csharp
public sealed record MonthlyImportMonthRow(
    /// <summary>Row number in the source input (1-based).</summary>
    int RowNumber,
    /// <summary>Raw month string from input.</summary>
    string RawMonth,
    /// <summary>Assigned year (null if row is invalid).</summary>
    int? Year,
    /// <summary>Parsed total miles (null if row is invalid).</summary>
    decimal? TotalMiles,
    /// <summary>Parsed day count (null if row is invalid).</summary>
    int? Days,
    /// <summary>True if all validation passed and rides were generated.</summary>
    bool IsValid,
    /// <summary>Validation errors for this row.</summary>
    IReadOnlyList<ImportValidationError> Errors,
    /// <summary>Generated ride records for this month (empty if invalid).</summary>
    IReadOnlyList<MonthlyImportGeneratedRide> GeneratedRides
);
```

### `MonthlyImportPreviewResponse`

```csharp
public sealed record MonthlyImportPreviewResponse(
    /// <summary>Job ID — pass back in StartAsync and subsequent calls.</summary>
    long ImportJobId,
    /// <summary>
    /// True if the parser could not find a header row and fell back to
    /// positional column detection. UI must show a warning and require
    /// rider confirmation before proceeding.
    /// </summary>
    bool HeaderDetectionWarning,
    int TotalMonthRows,
    int ValidMonthRows,
    int InvalidMonthRows,
    int TotalGeneratedRides,
    int DuplicateRides,
    bool RequiresDuplicateResolution,
    IReadOnlyList<MonthlyImportMonthRow> MonthRows
);
```

---

## Endpoints

### `POST /api/monthly-imports/preview`

Parse input, validate, generate ride schedule, check duplicates, and create an import job.

**Request**: `MonthlyImportPreviewRequest`

**Responses**:

| Status | Body | Condition |
|--------|------|-----------|
| `200 OK` | `MonthlyImportPreviewResponse` | Parse + validation succeeded (may include invalid rows) |
| `400 Bad Request` | `ErrorResponse("VALIDATION_FAILED", ...)` | File > 5 MB, invalid base64, blank content, year out of range [2000–2100] |
| `401 Unauthorized` | `ErrorResponse("UNAUTHORIZED", ...)` | No valid session |

**Notes**:
- A 200 response does not imply all rows are valid. Check `MonthRows[*].IsValid` and `InvalidMonthRows`.
- If `HeaderDetectionWarning = true`, the frontend must display a warning banner and require explicit rider acknowledgement before enabling "Confirm Import".
- Empty input (all rows empty or header-only) returns 200 with `TotalMonthRows = 0` and `TotalGeneratedRides = 0`.

---

### `POST /api/monthly-imports/start`

Start processing a previewed monthly import job.

**Request**: `ImportStartRequest` (reused from `ImportContracts.cs`)

```json
{
  "importJobId": 42,
  "overrideAllDuplicates": false,
  "resolutions": [
    { "rowNumber": 3, "action": "replace-with-import" },
    { "rowNumber": 7, "action": "keep-existing" }
  ]
}
```

`rowNumber` here refers to the **generated ride row number** (matches `MonthlyImportGeneratedRide.RideIndex` stored as the ImportRowEntity row number).

**Responses**:

| Status | Body | Condition |
|--------|------|-----------|
| `202 Accepted` | `ImportStartResponse` | Job enqueued |
| `400 Bad Request` | `ErrorResponse("VALIDATION_FAILED", ...)` | Job not in `awaiting-confirmation` state, unresolved duplicates |
| `404 Not Found` | `ErrorResponse("NOT_FOUND", ...)` | Job not found for this rider |
| `409 Conflict` | `ErrorResponse("CONFLICT", ...)` | Another import already processing |
| `401 Unauthorized` | `ErrorResponse("UNAUTHORIZED", ...)` | No valid session |

---

### `GET /api/monthly-imports/{importJobId}/status`

Poll or check status of a monthly import job.

**Response**: `ImportStatusResponse` (reused) — identical shape to CSV import status.

| Field | Notes |
|-------|-------|
| `totalRows` | Total generated ride rows (not source month rows) |
| `importedRows` | Rides successfully written to `Rides` table |
| `skippedRows` | Rides skipped due to "keep-existing" duplicate resolution |
| `failedRows` | Rows that errored during processing |

---

### `POST /api/monthly-imports/{importJobId}/cancel`

Cancel a running or pending monthly import job.

**Response**: `ImportCancelResponse` (reused) — identical shape to CSV import cancel.

---

## Error Response Format

All error responses use the shared `ErrorResponse` record:

```csharp
public sealed record ErrorResponse(string Code, string Message);
```

Common codes for monthly import:

| Code | Meaning |
|------|---------|
| `VALIDATION_FAILED` | Input validation failed (bad file, invalid year, etc.) |
| `NOT_FOUND` | Import job not found for this rider |
| `CONFLICT` | Concurrent import already processing |
| `UNAUTHORIZED` | Missing or invalid session |
