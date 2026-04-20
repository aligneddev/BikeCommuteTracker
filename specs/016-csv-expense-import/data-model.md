# Data Model: CSV Expense Import (Spec 016)

**Feature**: 016-csv-expense-import
**Date**: 2026-04-20
**Clarified**: 2026-04-20
**Status**: Complete

## Overview

This feature introduces two new lightweight persistence entities to track the two-phase import workflow (preview → confirm). Existing expense entities from spec 015 are reused for the final persisted expense records.

1. `ExpenseImportJob` tracks one CSV import lifecycle for a rider.
2. `ExpenseImportRow` tracks parsed row state, validation, and duplicate metadata.
3. Existing `ExpenseEntity` (spec 015) is used for final persisted expenses.

---

## Entity: ExpenseImportJob

Represents one uploaded CSV expense import request.

| Column | Type | Nullable | Constraints / Notes |
|--------|------|----------|----------------------|
| `Id` | `long` | No | PK, auto-increment |
| `RiderId` | `long` | No | Required; rider-scoped ownership |
| `FileName` | `string` | No | MaxLength(255); stored for traceability |
| `TotalRows` | `int` | No | ≥ 0 |
| `ValidRows` | `int` | No | ≥ 0; excludes fully blank rows |
| `InvalidRows` | `int` | No | ≥ 0 |
| `ImportedRows` | `int` | No | ≥ 0; set after confirm |
| `SkippedRows` | `int` | No | ≥ 0; duplicates kept |
| `OverrideAllDuplicates` | `bool` | No | Default `false` |
| `Status` | `string` | No | Enum: `previewing`, `awaiting-confirmation`, `processing`, `completed`, `failed` |
| `LastError` | `string` | Yes | MaxLength(1000); failure summary if any |
| `CreatedAtUtc` | `DateTime` | No | Set on initial preview upload |
| `CompletedAtUtc` | `DateTime` | Yes | Set on completed or failed |

### Validation invariants

- `ValidRows + InvalidRows <= TotalRows` (blank rows are excluded from both counts)
- `ImportedRows + SkippedRows <= ValidRows`
- `Status = completed | failed` requires `CompletedAtUtc` to be set

### State transitions

```
previewing → awaiting-confirmation → processing → completed
                                               ↘ failed
[any state] → deleted (triggered by client-side navigation away from summary)```

- `previewing`: CSV has been received and is being parsed (transient; resolves quickly).
- `awaiting-confirmation`: Parse and validation complete; preview data available; waiting for rider to confirm or cancel.
- `processing`: Rider confirmed; expenses are being written.
- `completed`: All valid rows processed; summary available.
- `failed`: Unrecoverable parse or infrastructure error.

---

## Entity: ExpenseImportRow

Represents one parsed CSV row and its processing state.

| Column | Type | Nullable | Constraints / Notes |
|--------|------|----------|----------------------|
| `Id` | `long` | No | PK, auto-increment |
| `ImportJobId` | `long` | No | FK → `ExpenseImportJob.Id` |
| `RowNumber` | `int` | No | 1-based CSV row index (excluding header) |
| `ExpenseDateLocal` | `DateOnly` | Yes | Null if date is unparseable |
| `Amount` | `decimal(10,2)` | Yes | Null if amount is invalid |
| `Notes` | `string` | Yes | MaxLength(500); raw value from CSV |
| `ValidationStatus` | `string` | No | Enum: `valid`, `invalid` |
| `ValidationErrorsJson` | `string` | Yes | Structured error array; set when `ValidationStatus = invalid` |
| `DuplicateStatus` | `string` | No | Enum: `none`, `duplicate` |
| `DuplicateResolution` | `string` | Yes | Enum: `keep-existing`, `replace-with-import`, `override-all`; null until rider resolves |
| `ProcessingStatus` | `string` | No | Enum: `pending`, `processed`, `skipped`, `failed` |
| `ExistingExpenseIdsJson` | `string` | Yes | JSON array of matching existing expense IDs for duplicate dialog context |
| `CreatedExpenseId` | `long` | Yes | Expense ID created or updated when `ProcessingStatus = processed` |

### Validation invariants

- `ValidationStatus = invalid` implies `ValidationErrorsJson` is not null
- `DuplicateStatus = duplicate` implies `ExistingExpenseIdsJson` is not null and contains at least one ID
- `ProcessingStatus = processed` implies `ValidationStatus = valid`

---

## Derived model: DuplicateKey

Duplicate detection key per incoming row.

| Component | Source |
|-----------|--------|
| `Date` | `ExpenseImportRow.ExpenseDateLocal` |
| `Amount` | `ExpenseImportRow.Amount` (rounded to 2 decimal places) |

A row is a duplicate when an existing active (non-deleted) rider expense matches both the date and the amount (to 2 decimal places). Intra-file rows are never compared against each other — only against existing history records.

## Derived model: AmountNormalizationPipeline

Applied in `CsvExpenseParser.NormalizeAmount` before decimal parsing:

1. Trim leading/trailing whitespace
2. Strip leading currency symbol: `$`, `£`, `€`, `¥`
3. Remove commas (thousands separators)
4. Strip trailing ISO currency code via regex `\s*[A-Z]{3}$` (e.g., ` USD`, ` GBP`, ` EUR`)
5. Parse result as `decimal`; must be > 0 or row is invalid

---

## Derived model: ImportPreviewSummary

Returned to the client after preview completes.

| Field | Type | Notes |
|-------|------|-------|
| `JobId` | `long` | Correlates with the persisted import job |
| `FileName` | `string` | Original uploaded file name |
| `TotalRows` | `int` | Total non-blank rows parsed |
| `ValidRows` | `int` | Rows that passed all validation rules |
| `InvalidRows` | `int` | Rows that failed validation |
| `DuplicateCount` | `int` | Count of valid rows flagged as duplicates |
| `Errors` | `ImportRowError[]` | Field-level error details per invalid row |
| `Duplicates` | `ExpenseDuplicateConflict[]` | Duplicate details per flagged row |
| `CanConfirmImport` | `bool` | `true` when `ValidRows > 0` |

---

## Derived model: ImportCompletionSummary

Returned to the client after confirm + execute completes.

| Field | Type | Notes |
|-------|------|-------|
| `JobId` | `long` | Correlates with the import job |
| `TotalRows` | `int` | Total non-blank rows processed |
| `ImportedRows` | `int` | Rows successfully created as expenses |
| `SkippedRows` | `int` | Rows skipped (duplicate kept) |
| `FailedRows` | `int` | Rows that could not be imported (validation or write error) |

---

## Relationship map

- One rider has many `ExpenseImportJob` records (session-scoped; deleted after summary is dismissed).
- One `ExpenseImportJob` has many `ExpenseImportRow` records (cascade-deleted with the job).
- One `ExpenseImportRow` may create one `ExpenseEntity` through the existing expense write service.

---

## Database Indexes

`ExpenseImportJob`:
- `IX_ExpenseImportJobs_RiderId` — (RiderId) for rider-scoped job queries

`ExpenseImportRow`:
- `IX_ExpenseImportRows_ImportJobId` — (ImportJobId) for row lookup per job; cascade delete when job is deleted

---

## EF Core notes

- Both entities are added to `BikeTrackingDbContext` under `DbSet<ExpenseImportJobEntity>` and `DbSet<ExpenseImportRowEntity>`.
- A single EF Core migration (`AddExpenseImportTables`) creates both tables.
- Cascade delete: deleting an `ExpenseImportJob` deletes its `ExpenseImportRow` children.
- JSON columns (`ValidationErrorsJson`, `ExistingExpenseIdsJson`) are stored as `TEXT` in SQLite and serialized/deserialized in the application layer (no EF JSON column mapping required for SQLite compatibility).
