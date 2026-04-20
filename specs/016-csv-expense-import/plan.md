# Implementation Plan: CSV Expense Import

**Branch**: `016-csv-expense-import` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/016-csv-expense-import/spec.md`

---

## Summary

Add a CSV expense import workflow linked from the Expenses history page. Riders upload a CSV containing Date, Amount, and Note, review a validation preview with duplicate detection, resolve any conflicts, then confirm to import expense records. The import is synchronous (no enrichment, no real-time progress). Receipts cannot be imported — a UI note directs riders to attach receipts individually via the expense history edit flow.

**Technical approach**: Two-phase synchronous import (preview → confirm). Lightweight `ExpenseImportJob` and `ExpenseImportRow` EF entities persist the import state between phases. New `CsvExpenseParser`, `ExpenseDuplicateDetector`, and `CsvExpenseImportService` application-layer classes. Three new Minimal API endpoints under `/api/expense-imports`. New frontend page at `/expenses/import` with upload, preview, duplicate resolution, and summary views. Link added to the Expenses history page.

---

## Technical Context

**Language/Version**: C# 13 / .NET 10 (API), F# (domain unchanged), TypeScript 5 / React 19 (frontend)
**Primary Dependencies**: ASP.NET Core Minimal API, EF Core 9 (SQLite), xUnit, Vitest, Playwright, React Router v7, Vite
**Storage**: SQLite local file; additive `ExpenseImportJob` and `ExpenseImportRow` tables; existing `Expenses` table from spec 015
**Testing**: xUnit (backend unit + integration), Vitest (frontend unit), Playwright (E2E)
**Target Platform**: Local user machine (Windows/macOS/Linux); devcontainer for development
**Project Type**: Local-first desktop web application (Aspire-orchestrated)
**Performance Goals**: Preview response < 2s for typical files (< 500 rows); confirm response < 2s; no background processing required
**Constraints**: No receipts in import; no SignalR; no enrichment; synchronous confirm+execute; existing spec 015 expense write path reused for creating imported expenses
**Scale/Scope**: Single-user local deployment; import files expected in tens to low hundreds of rows for typical use

---

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I — Clean Architecture / Ports-and-Adapters | Import application services isolated from endpoints; no file I/O in domain layer | PASS |
| I — No god services | Three focused services: parser, duplicate detector, import orchestrator | PASS |
| II — Pure/Impure Sandwich | CSV parsing and duplicate key computation are pure helpers; DB writes remain at application service edges | PASS |
| III — Event Sourcing | Imported expenses created via existing `RecordExpenseService` which emits `ExpenseRecorded` events | PASS |
| IV — TDD | Red-Green-Refactor mandatory; test plan in quickstart.md; failing tests before implementation | PASS |
| V — UX Consistency | Import page follows existing page/component structure; preview/error states follow ride import (spec 013) patterns | PASS |
| VI — Performance | Preview and confirm both synchronous and < 2s for expected data volumes | PASS |
| VII — Three-layer validation | React form + DataAnnotations DTOs + DB check constraints on Amount (from spec 015) | PASS |
| VIII — Security | Uploaded CSV content is parsed as data only; file name is sanitized; rider ownership validated on all endpoints | PASS |
| IX — Contract-first | API contracts in `contracts/api-contracts.md` defined before implementation | PASS |
| X — Additive | New import page, new endpoints, two new tables; no breaking changes to spec 015 expense API | PASS |
| TDD mandatory gate | PASS | Plan requires user confirmation on failing tests before code implementation |
| Migration test coverage policy | PASS | New EF migration must include migration policy test entry |
| Spec completion gate | PASS | Completion requires migration apply + backend tests + frontend lint/build/unit + E2E |

---

## Project Structure

### Documentation (this feature)

```text
specs/016-csv-expense-import/
├── plan.md              ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-contracts.md
└── tasks.md
```

### Source Code — New Files

```text
src/BikeTracking.Api/
├── Application/
│   └── ExpenseImports/
│       ├── CsvExpenseParser.cs                    ← NEW: CSV parsing, header normalization, row validation
│       ├── ExpenseDuplicateDetector.cs            ← NEW: duplicate key computation, match lookup
│       └── CsvExpenseImportService.cs             ← NEW: orchestrates preview and confirm flows
├── Contracts/
│   └── ExpenseImportContracts.cs                  ← NEW: all import request/response DTOs
├── Endpoints/
│   └── ExpenseImportEndpoints.cs                  ← NEW: POST preview, POST confirm, GET status
└── Infrastructure/
    └── Persistence/
        ├── Entities/
        │   ├── ExpenseImportJobEntity.cs          ← NEW
        │   └── ExpenseImportRowEntity.cs          ← NEW
        └── Migrations/
            └── {timestamp}_AddExpenseImportTables.cs  ← NEW

src/BikeTracking.Api.Tests/
└── Application/
    └── ExpenseImports/
        ├── CsvExpenseParserTests.cs               ← NEW
        ├── ExpenseDuplicateDetectorTests.cs       ← NEW
        └── CsvExpenseImportServiceTests.cs        ← NEW

src/BikeTracking.Frontend/src/
├── pages/
│   └── expenses/
│       ├── ExpenseImportPage.tsx                  ← NEW
│       └── ExpenseImportPage.css                  ← NEW
├── components/
│   └── expense-import/
│       ├── ExpenseDuplicateResolutionPanel.tsx    ← NEW: inline duplicate conflict UI
│       └── ExpenseDuplicateResolutionPanel.test.tsx  ← NEW
└── services/
    └── expense-import-api.ts                      ← NEW: preview and confirm API calls
```

### Source Code — Modified Files

```text
src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
    # Add DbSet<ExpenseImportJobEntity> + DbSet<ExpenseImportRowEntity> + model config

src/BikeTracking.Api/Program.cs
    # Register CsvExpenseImportService, ExpenseDuplicateDetector, CsvExpenseParser
    # Map ExpenseImportEndpoints

src/BikeTracking.Frontend/src/App.tsx
    # Add route: /expenses/import → ExpenseImportPage

src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.tsx
    # Add "Import Expenses" button/link to header area

src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs
    # Add AddExpenseImportTables migration entry
```

---

## Architecture Decisions

### 1. Two-Phase Synchronous Import (No Background Job)

Preview (phase 1) parses the CSV and detects duplicates, persisting results as `ExpenseImportJob` + `ExpenseImportRow` records in `awaiting-confirmation` status. Confirm (phase 2) reads the persisted rows, applies duplicate resolutions, and creates expenses via `RecordExpenseService`. Both phases return in < 2s for expected data volumes. No background threads, no polling, no SignalR required.

### 2. Reuse Existing Expense Write Path

Confirmed import rows are created via the existing `RecordExpenseService` from spec 015 — the same application service used by the manual expense entry form. This ensures all domain validation, event sourcing, and outbox publishing apply equally to imported expenses. No separate import-only write path.

### 3. Duplicate Key: Date + Amount (2dp)

Duplicate detection compares `(ExpenseDateLocal, Amount)` against active (non-deleted) rider expenses. Amount comparison uses 2 decimal places (`Math.Round(amount, 2)`) to avoid floating-point drift. This is a low-false-positive key for typical personal expense imports.

### 4. Receipt Exclusion

Imported expenses are created with `ReceiptPath = null`. The import UI shows a persistent informational note: "Receipts cannot be imported. To add a receipt, find the expense in your history and use the edit option." No UI surface for receipt upload exists on the import page.

### 5. Currency Symbol Stripping

Before decimal parsing, the `CsvExpenseParser` removes leading/trailing whitespace, then strips known currency prefix symbols (`$`, `£`, `€`, `¥`) and removes commas used as thousands separators. If the resulting string does not parse to a positive decimal, the row is flagged as invalid.

---

## Test Plan (TDD Gates)

### Backend Unit Tests

**CsvExpenseParserTests**
- Valid CSV with Date, Amount, Note → returns 1 valid row
- Header matching case-insensitive ("AMOUNT" → Amount)
- Missing Date column → returns parse error
- Missing Amount column → returns parse error
- Amount with `$` prefix stripped and parsed correctly
- Amount with comma thousands separator (1,250.00) parsed correctly
- Amount of 0 → row invalid
- Amount of -5 → row invalid
- Note exceeding 500 chars → row invalid
- Unparseable date → row invalid
- Blank row → row skipped
- Extra columns beyond Date/Amount/Note → silently ignored
- CSV with BOM prefix → parsed correctly

**ExpenseDuplicateDetectorTests**
- Row with date+amount matching existing expense → flagged as duplicate
- Row with same date but different amount → not a duplicate
- Row with same amount but different date → not a duplicate
- Row matching a deleted expense → not a duplicate (IsDeleted=true excluded)
- Multiple rows with same date+amount → each flagged independently

**CsvExpenseImportServiceTests**
- Preview with all valid rows → returns correct `ValidRows`, `InvalidRows`, `DuplicateCount`
- Preview with mixed valid/invalid → only valid rows in import candidates
- Confirm with `KeepExisting` resolution → duplicate row skipped, `SkippedRows` incremented
- Confirm with `ReplaceWithImport` resolution → existing expense updated via edit service
- Confirm with `OverrideAllDuplicates=true` → all valid rows imported including duplicates
- Confirm happy path (no duplicates) → `ImportedRows` matches `ValidRows`

### API Endpoint Integration Tests (xUnit)

- `POST /api/expense-imports/preview` with valid CSV → 200 with preview response
- `POST /api/expense-imports/preview` with non-CSV file → 400
- `POST /api/expense-imports/preview` with file > 5 MB → 400
- `POST /api/expense-imports/preview` with missing required column → 400
- `POST /api/expense-imports/{jobId}/confirm` with valid job ID → 200 with summary
- `POST /api/expense-imports/{jobId}/confirm` with wrong rider → 403
- `POST /api/expense-imports/{jobId}/confirm` with expired/completed job → 409

### Frontend Unit Tests (Vitest)

- `ExpenseImportPage` renders file upload control
- `ExpenseImportPage` shows preview table after upload
- `ExpenseImportPage` shows receipt-exclusion note
- `ExpenseImportPage` shows completion summary after confirm
- `ExpenseDuplicateResolutionPanel` renders both existing and incoming expense details
- `ExpenseDuplicateResolutionPanel` emits correct resolution choice on selection
- `ExpenseHistoryPage` renders "Import Expenses" button/link

### E2E Tests (Playwright)

- Upload valid CSV → preview shows correct row count → confirm → expenses appear in history
- Upload CSV with duplicate → preview shows conflict → choose Keep Existing → duplicate row absent from history
- Upload CSV with duplicate → preview shows conflict → choose Replace → expense updated in history
- Upload CSV with Override All Duplicates → all rows imported including duplicates
- Upload non-CSV → error message shown
- Navigate to import page without authentication → redirect to login
