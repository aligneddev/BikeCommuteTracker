# API Contracts: CSV Expense Import

**Feature**: 016-csv-expense-import
**Date**: 2026-04-20
**Clarified**: 2026-04-20
**Base path**: `/api/expense-imports`

---

## New Endpoints

### POST `/api/expense-imports/preview`

Uploads and validates a CSV expense file. Creates an `ExpenseImportJob` + `ExpenseImportRow` records in `awaiting-confirmation` state. Returns preview data including validation errors and duplicate conflicts.

**Request**: `multipart/form-data`
- `file`: CSV file (`.csv`, max 5 MB)

**Response**: `ExpenseImportPreviewResponse`

```csharp
public sealed record ExpenseImportPreviewResponse(
    long JobId,
    string FileName,
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateCount,
    IReadOnlyList<ExpenseImportRowErrorView> Errors,
    IReadOnlyList<ExpenseImportDuplicateView> Duplicates,
    bool CanConfirmImport
);

public sealed record ExpenseImportRowErrorView(
    int RowNumber,
    string Field,
    string Message
);

public sealed record ExpenseImportDuplicateView(
    int RowNumber,
    DateOnly ExpenseDate,
    decimal Amount,
    string? Note,
    IReadOnlyList<ExistingExpenseMatchView> ExistingMatches
);

public sealed record ExistingExpenseMatchView(
    long ExpenseId,
    DateOnly ExpenseDate,
    decimal Amount,
    string? Note
);
```

**Error responses**:
- `400 Bad Request` — missing or invalid file, file is not a CSV, file exceeds 5 MB, missing required columns (Date or Amount)
- `401 Unauthorized` — unauthenticated rider

**Notes**:
- `CanConfirmImport` is `true` when `ValidRows > 0`.
- `DuplicateCount` counts valid rows that have at least one date+amount match in existing expenses.
- Errors are reported per-row. A row may have multiple errors (e.g., bad date AND invalid amount).
- Fully blank rows are silently skipped and not included in `TotalRows`, `ValidRows`, or `InvalidRows`.

---

### POST `/api/expense-imports/{jobId}/confirm`

Confirms and executes a previously previewed import job. Applies duplicate resolutions and creates (or updates) expense records. Returns a completion summary.

**Path parameters**:
- `jobId` (long) — ID returned by the preview endpoint

**Request body**: `application/json` → `ConfirmExpenseImportRequest`

```csharp
public sealed record ConfirmExpenseImportRequest(
    bool OverrideAllDuplicates,
    IReadOnlyList<ExpenseDuplicateResolutionChoice> DuplicateChoices
);

public sealed record ExpenseDuplicateResolutionChoice(
    int RowNumber,
    string Resolution // "keep-existing" | "replace-with-import"
);
```

**Response**: `ExpenseImportSummaryResponse`

```csharp
public sealed record ExpenseImportSummaryResponse(
    long JobId,
    int TotalRows,
    int ImportedRows,
    int SkippedRows,
    int FailedRows
);
```

**Error responses**:
- `400 Bad Request` — job is not in `awaiting-confirmation` status, or invalid resolution values
- `401 Unauthorized` — unauthenticated rider
- `403 Forbidden` — `jobId` belongs to a different rider
- `404 Not Found` — `jobId` does not exist
- `409 Conflict` — job has already been confirmed (status is `completed` or `processing`)

**Notes**:
- If `OverrideAllDuplicates = true`, `DuplicateChoices` is ignored — all valid rows are imported.
- If `OverrideAllDuplicates = false`, any duplicate rows without a corresponding `DuplicateChoices` entry default to `keep-existing`.
- Rows created by this endpoint are created via `RecordExpenseService`, which applies all domain validation and event sourcing rules.
- Rows with `Resolution = replace-with-import` update the matching existing expense via `EditExpenseService` with **partial-update note semantics**: the note is only overwritten when the incoming CSV row provides a non-blank note value; a blank CSV note preserves the existing note unchanged.
- All imported expenses have `ReceiptPath = null` (receipts cannot be imported).

---

### GET `/api/expense-imports/{jobId}/status`

Returns the current status of an import job. Used for page reload recovery if the rider navigates away after confirming.

**Path parameters**:
- `jobId` (long)

**Response**: `ExpenseImportStatusResponse`

```csharp
public sealed record ExpenseImportStatusResponse(
    long JobId,
    string Status,      // "previewing" | "awaiting-confirmation" | "processing" | "completed" | "failed"
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateCount,
    ExpenseImportSummaryResponse? Summary  // non-null when Status = "completed"
);
```

**Error responses**:
- `401 Unauthorized` — unauthenticated rider
- `403 Forbidden` — `jobId` belongs to a different rider
- `404 Not Found` — `jobId` does not exist

---

### DELETE `/api/expense-imports/{jobId}`

Deletes an import job and all associated import row records. Called client-side when the rider navigates away from the summary page. Import jobs are session-scoped and do not persist beyond the current import session.

**Path parameters**:
- `jobId` (long)

**Response**: `204 No Content`

**Error responses**:
- `401 Unauthorized` — unauthenticated rider
- `403 Forbidden` — `jobId` belongs to a different rider
- `404 Not Found` — `jobId` does not exist (idempotent; clients may safely re-call)

**Notes**:
- Deletion is cascade: the job and all child `ExpenseImportRow` records are removed in one operation.
- Already-imported `ExpenseEntity` records are **not** affected — only the import job metadata is removed.
- The frontend calls this endpoint via `useEffect` cleanup and `beforeunload` event handler.
- If the delete call fails silently (e.g., network drop), the orphaned job row has no functional impact; a safety-net cleanup of jobs older than 24 hours may be added in a future phase.

---

## TypeScript Client Types

```typescript
// Matches ExpenseImportPreviewResponse
export interface ExpenseImportPreviewResponse {
  jobId: number;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  errors: ExpenseImportRowError[];
  duplicates: ExpenseImportDuplicateConflict[];
  canConfirmImport: boolean;
}

export interface ExpenseImportRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ExpenseImportDuplicateConflict {
  rowNumber: number;
  expenseDate: string;  // ISO date string
  amount: number;
  note: string | null;
  existingMatches: ExistingExpenseMatch[];
}

export interface ExistingExpenseMatch {
  expenseId: number;
  expenseDate: string;  // ISO date string
  amount: number;
  note: string | null;
}

// Matches ConfirmExpenseImportRequest
export interface ConfirmExpenseImportRequest {
  overrideAllDuplicates: boolean;
  duplicateChoices: ExpenseDuplicateResolutionChoice[];
}

export interface ExpenseDuplicateResolutionChoice {
  rowNumber: number;
  resolution: 'keep-existing' | 'replace-with-import';
}

// Matches ExpenseImportSummaryResponse
export interface ExpenseImportSummaryResponse {
  jobId: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
}

// Matches ExpenseImportStatusResponse
export interface ExpenseImportStatusResponse {
  jobId: number;
  status: 'previewing' | 'awaiting-confirmation' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  summary: ExpenseImportSummaryResponse | null;
}

// Matches ExpenseImportStatusResponse
export interface ExpenseImportStatusResponse {
  jobId: number;
  status: 'previewing' | 'awaiting-confirmation' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  summary: ExpenseImportSummaryResponse | null;
}
```

---

## Validation Rules (enforced at endpoint layer)

| Field | Rule | HTTP status | Error message |
|-------|------|-------------|---------------|
| `file` | Required | 400 | "A CSV file is required." |
| `file` | Extension must be `.csv` | 400 | "Please upload a .csv file." |
| `file` | Size ≤ 5 MB | 400 | "File size must not exceed 5 MB." |
| CSV columns | Must contain `Date` and `Amount` | 400 | "Missing required columns: {list}" |
| `jobId` | Must exist and belong to authenticated rider | 403/404 | — |
| `Resolution` | Must be `keep-existing` or `replace-with-import` | 400 | "Invalid resolution value: {value}" |

---

## Modified Endpoints

No existing endpoints are modified by this feature. All new endpoints are additive.
