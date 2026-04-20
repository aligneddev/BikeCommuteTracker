# Developer Quickstart: CSV Expense Import

**Feature**: 016-csv-expense-import
**Branch**: `016-csv-expense-import`
**Date**: 2026-04-20

## Overview

This feature adds an Expenses-page-linked CSV import flow that supports upload, validation preview, duplicate conflict resolution, and synchronous confirm+import. Unlike the ride import (spec 013), there is no enrichment, no SignalR, and no background processing — the import completes synchronously in two HTTP requests.

## Prerequisites

- DevContainer running
- App launch: `dotnet run --project src/BikeTracking.AppHost`
- Spec 015 (Bike Expense Tracking) must be fully implemented — `RecordExpenseService`, `EditExpenseService`, `ExpenseEntity`, and `Expenses` table are required dependencies
- Follow strict TDD gate: write failing tests first, confirm failures before writing implementation

## Implementation Order

### Step 1: Define contracts first

Create backend DTOs before any service code.

```text
src/BikeTracking.Api/Contracts/
  ExpenseImportContracts.cs
```

Define all request and response types:
- `ExpenseImportPreviewResponse`
- `ExpenseImportRowErrorView`
- `ExpenseImportDuplicateView`
- `ExistingExpenseMatchView`
- `ConfirmExpenseImportRequest`
- `ExpenseImportDuplicateResolutionChoice`
- `ExpenseImportSummaryResponse`

### Step 2: Persistence and migration

Add import job/row entities and EF mappings.

```text
src/BikeTracking.Api/Infrastructure/Persistence/Entities/
  ExpenseImportJobEntity.cs
  ExpenseImportRowEntity.cs
src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
  # Add DbSet<ExpenseImportJobEntity>
  # Add DbSet<ExpenseImportRowEntity>
  # Configure cascade delete, indexes
src/BikeTracking.Api/Infrastructure/Persistence/Migrations/
  {timestamp}_AddExpenseImportTables.cs
```

Update migration policy test in `MigrationTestCoveragePolicyTests.cs`.

### Step 3: CSV parser

Build CSV parse/normalize/validate helpers. **Write tests before implementation (TDD gate).**

```text
src/BikeTracking.Api.Tests/Application/ExpenseImports/CsvExpenseParserTests.cs  ← WRITE FIRST
src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseParser.cs
```

Parsing rules to implement:
- Case-insensitive header matching for Date, Amount, Note
- Skip fully blank rows
- Amount normalization pipeline: trim → strip leading `$£€¥` → remove commas → strip trailing ISO code (`USD`, `GBP`, `EUR`, etc.) via regex `\s*[A-Z]{3}$` → parse decimal
- Accept common date formats: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, DD-MMM-YYYY, MMM DD YYYY
- Validate: Amount > 0, parseable date, Note ≤ 500 chars when present
- Extra columns silently ignored
- BOM-aware UTF-8/UTF-16 reading

### Step 4: Duplicate detector

**Write tests before implementation (TDD gate).**

```text
src/BikeTracking.Api.Tests/Application/ExpenseImports/ExpenseDuplicateDetectorTests.cs  ← WRITE FIRST
src/BikeTracking.Api/Application/ExpenseImports/ExpenseDuplicateDetector.cs
```

Key behavior:
- Duplicate key: `(ExpenseDateLocal, Math.Round(Amount, 2))`
- Load active (non-deleted) rider expenses from DB; build lookup dictionary keyed by `(date, amount)`
- Return matching existing expense IDs for each duplicate row
- Deleted expenses are excluded from duplicate matching
- **Intra-file rows are never compared against each other** — only against existing history records; two identical rows in the same CSV are both treated as independent import candidates

### Step 5: Import orchestration service

**Write tests before implementation (TDD gate).**

```text
src/BikeTracking.Api.Tests/Application/ExpenseImports/CsvExpenseImportServiceTests.cs  ← WRITE FIRST
src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs
```

`CsvExpenseImportService` responsibilities:
- **Preview**: Parse CSV, validate rows, detect duplicates, persist `ExpenseImportJob` + `ExpenseImportRow` entities, return `ExpenseImportPreviewResponse`
- **Confirm**: Load persisted job + rows, apply duplicate resolutions, create expenses via `RecordExpenseService` (or update via `EditExpenseService` for `replace-with-import`), update job status to `completed`, return `ExpenseImportSummaryResponse`
- **Replace-with-Import partial note update**: when `EditExpenseService` is called for a `replace-with-import` row, pass the incoming note only when it is non-blank; omit the note field from the update payload when CSV note is blank so the existing note is preserved unchanged.

### Step 6: Minimal API endpoints

```text
src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs
```

Four endpoints:
- `POST /api/expense-imports/preview` — multipart form-data, returns preview
- `POST /api/expense-imports/{jobId}/confirm` — JSON body, returns summary
- `GET /api/expense-imports/{jobId}/status` — returns current job status (for page reload recovery)
- `DELETE /api/expense-imports/{jobId}` — deletes job + rows (called client-side on navigation away from summary)

Register in `Program.cs`.

### Step 7: Frontend API service

```text
src/BikeTracking.Frontend/src/services/expense-import-api.ts
```

Typed functions:
- `previewExpenseImport(file: File): Promise<ExpenseImportPreviewResponse>`
- `confirmExpenseImport(jobId: number, request: ConfirmExpenseImportRequest): Promise<ExpenseImportSummaryResponse>`
- `getExpenseImportStatus(jobId: number): Promise<ExpenseImportStatusResponse>`
- `deleteExpenseImport(jobId: number): Promise<void>` — called on summary page unmount and beforeunload

### Step 8: Frontend import page

```text
src/BikeTracking.Frontend/src/pages/expenses/
  ExpenseImportPage.tsx
  ExpenseImportPage.css
```

UI states:
1. **Upload** — file picker, receipts-excluded notice, upload button
2. **Preview** — row counts (valid, invalid, duplicates), error table, duplicate resolution panel, confirm/cancel buttons
3. **Processing** — brief loading indicator (synchronous, typically < 1s)
4. **Summary** — imported/skipped/failed counts, link to expense history

> **Session cleanup**: On the Summary state, wire a `useEffect` cleanup function and a `beforeunload` listener that call `deleteExpenseImport(jobId)` so the import job is removed from the database when the rider navigates away or closes the tab.

Add `ExpenseDuplicateResolutionPanel` component:

```text
src/BikeTracking.Frontend/src/components/expense-import/
  ExpenseDuplicateResolutionPanel.tsx
  ExpenseDuplicateResolutionPanel.test.tsx
```

Shows each duplicate conflict with:
- Existing expense: date, amount, note
- Incoming row: date, amount, note
- Resolution options: "Keep Existing" | "Replace with Import"
- Global "Override All Duplicates" checkbox

### Step 9: Wire route and navigation link

```text
src/BikeTracking.Frontend/src/App.tsx
  # Add route: /expenses/import → ExpenseImportPage

src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.tsx
  # Add "Import Expenses" button near existing expense entry controls
```

---

## TDD Red-Green Gate (mandatory)

For each implementation step involving tests:

1. **Write the test(s)** — target the specific behavior; tests must be meaningful
2. **Run tests** — confirm they fail (`dotnet test` or `npm run test:unit`)
3. **Show failure output to user** — confirm tests fail for the right reason
4. **Implement the code** — minimal code to make tests pass
5. **Run tests again** — confirm all pass
6. **Proceed to next step**

Never write implementation before the corresponding test is red.

---

## Key Validation Rules (implement in CsvExpenseParser)

| Field | Rule | Error Message |
|-------|------|---------------|
| Date | Required; parseable date | "Date is required" / "Date is not a valid date" |
| Amount | Required; > 0 after full normalization | "Amount is required" / "Amount must be greater than zero" |
| Note | Optional; ≤ 500 characters | "Note must be 500 characters or fewer" |
| Amount format | Strip leading `$£€¥`, commas, trailing ISO code, then parse | "Amount is not a valid number" |

---

## Sample Test CSV

```csv
Date,Amount,Note
2026-01-10,25.00,Tube replacement
2026-01-15,$12.50,Lube
2026-01-15,$12.50,Second lube (same date+amount as above; both imported)
2026-02-01,0,Zero amount should fail
2026-02-05,-5.00,Negative should fail
bad-date,10.00,Bad date row
2026-03-01,"1,250.00","Wheel rebuild, labor"
2026-03-15,"15.00 USD",Trailing currency code stripped
2026-03-20,,Existing note preserved when blank (only relevant in replace-with-import flow)
```

Expected preview: 5 valid rows, 3 invalid rows (zero amount, negative amount, bad date). The two identical rows (2026-01-15, $12.50) are both valid import candidates with no intra-file duplicate flagging.

---

## File Size and Format Notes

- Maximum file size: 5 MB
- Accepted extension: `.csv` only (validate both extension and MIME type `text/csv`, `application/csv`, `text/plain`)
- Encoding: BOM-aware (UTF-8, UTF-16); default UTF-8 without BOM

---

## Receipts Notice (UI copy)

> Receipts cannot be imported from CSV. To attach a receipt to an imported expense, find the expense in your Expense History and use the edit option.

This notice MUST appear on the import page regardless of import state (upload, preview, summary).
