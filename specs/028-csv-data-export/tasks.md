---
description: "Task list for CSV Data Export feature implementation"
---

# Tasks: CSV Data Export

**Input**: Design documents from `specs/028-csv-data-export/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [data-model.md](./data-model.md) · [contracts/export-endpoints.md](./contracts/export-endpoints.md) · [research.md](./research.md) · [quickstart.md](./quickstart.md)

**Branch**: `028-csv-data-export`

**Constitution gate**: TDD is mandatory — failing-test proof required before every implementation task. E2E required on every PR.

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no conflicting dependencies)
- **[US1]** / **[US2]**: Which user story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Implement the shared `CsvRowBuilder` RFC 4180 helper used by both export services. Neither export service can be implemented until this is in place.

**⚠️ CRITICAL**: Complete both tasks before starting any user story phase.

- [X] T001 Write failing unit tests for `CsvRowBuilder` RFC 4180 quoting rules (null → blank, comma/quote/newline → quoted, embedded `"` → `""`, bool → `true`/`false`) in `src/BikeTracking.Api.Tests/Application/Export/CsvRowBuilderTests.cs` **[RED — tests must fail]**
- [X] T002 Implement `CsvRowBuilder` static class with `BuildRow(IEnumerable<string?> fields)` and `BuildHeader(IEnumerable<string> columnNames)` methods in `src/BikeTracking.Api/Application/Export/CsvRowBuilder.cs` (passes T001)

**Checkpoint**: `CsvRowBuilder` unit tests pass — both export services can now be implemented.

---

## Phase 2: User Story 1 — Export Expenses to CSV (Priority: P1) 🎯 MVP

**Goal**: A user clicks "Export Expenses" on the Settings page and receives a single UTF-8 CSV file (`expenses-export.csv`) containing all their raw expense records, correctly quoted per RFC 4180, with no totals or summary rows.

**Independent Test**: Navigate to Settings, click "Export Expenses", verify `expenses-export.csv` downloads with header `ExpenseId,Date,Amount,Notes,CreatedAtUtc`, one data row per expense, proper quoting, and no total rows. Also verify empty-dataset case returns header-only CSV.

### Tests for User Story 1 (write first — RED before implementation)

- [X] T003 [P] [US1] Write failing backend integration tests covering: 200 OK with correct `Content-Disposition` / `Content-Type`, header row, data rows (multi-record), empty dataset (header-only), RFC 4180 quoting of Notes field, user-scoping (no cross-user data), and 401 for missing auth header in `src/BikeTracking.Api.Tests/Endpoints/Export/ExpenseExportEndpointTests.cs` **[RED — tests must fail]**
- [X] T004 [P] [US1] Write failing frontend unit tests asserting "Export Expenses" button renders on `SettingsPage`, is clickable, calls `fetchExpensesCsv`, and triggers a blob download in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx` **[RED — tests must fail]**

### Implementation for User Story 1

- [X] T005 [P] [US1] Implement `ExpenseCsvExportService` that queries `Expenses` WHERE `RiderId = @riderId AND IsDeleted = false ORDER BY ExpenseDate DESC`, maps to CSV rows using `CsvRowBuilder`, and returns the UTF-8 CSV string with header `ExpenseId,Date,Amount,Notes,CreatedAtUtc` (Date as `yyyy-MM-dd`, CreatedAtUtc as ISO 8601, decimal as raw, null Notes as blank) in `src/BikeTracking.Api/Application/Export/ExpenseCsvExportService.cs`
- [X] T006 [US1] Create `ExportEndpoints` route group `/api/exports`, register `GET /api/exports/expenses` delegating to `ExpenseCsvExportService` and returning `Results.File(...)` with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="expenses-export.csv"`, then register `ExportEndpoints` in `src/BikeTracking.Api/Endpoints/ExportEndpoints.cs` and `src/BikeTracking.Api/Program.cs`
- [X] T007 [P] [US1] Add `fetchExpensesCsv()` async function that calls `GET /api/exports/expenses` with `X-User-Id` header, receives the response as a `Blob`, creates an object URL, injects a transient `<a download="expenses-export.csv">` element, clicks it, then revokes the URL — mirroring the existing `downloadExpenseReceipt` pattern in `src/BikeTracking.Frontend/src/services/export-api.ts`
- [X] T008 [US1] Add "Export Expenses" button and per-button loading/error state to `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx` (button calls `fetchExpensesCsv` from `export-api.ts`; depends on T006 and T007)
- [X] T009 [US1] Write Playwright E2E test covering: expense CSV downloads with correct filename, header row present, at least one data row, empty-dataset header-only, and buttons operate independently in `src/BikeTracking.Frontend/tests/e2e/export.spec.ts`

**Checkpoint**: User Story 1 fully functional and independently testable — expense CSV export works end-to-end.

---

## Phase 3: User Story 2 — Export Ride History to CSV (Priority: P2)

**Goal**: A user clicks "Export Ride History" on the Settings page and receives `ride-history-export.zip` containing one CSV per calendar year (`2024.csv`, `2025.csv`, etc.), each with all rides for that year as raw data rows, correctly quoted, and no totals.

**Independent Test**: Navigate to Settings, click "Export Ride History", verify `ride-history-export.zip` downloads, unzip reveals one `{year}.csv` per year in the data, each CSV has header `RideId,Date,Miles,…,CreatedAtUtc` with one data row per ride, proper RFC 4180 quoting, and no total rows. Also verify empty-dataset case returns ZIP containing header-only `{currentYear}.csv`.

### Tests for User Story 2 (write first — RED before implementation)

- [X] T010 [P] [US2] Write failing backend integration tests covering: 200 OK with `Content-Type: application/zip` and correct `Content-Disposition`, ZIP contains one CSV per year, each CSV has correct header and data rows, rides grouped by `RideDateTimeLocal.Year`, empty dataset returns ZIP with single header-only `{currentYear}.csv`, user-scoping, RFC 4180 quoting of Notes/PrecipitationType, null optional fields render as blank cells, and 401 for missing auth header in `src/BikeTracking.Api.Tests/Endpoints/Export/RideExportEndpointTests.cs` **[RED — tests must fail]**
- [X] T011 [P] [US2] Write failing frontend unit tests asserting "Export Ride History" button renders on `SettingsPage`, is clickable, calls `fetchRideHistoryZip`, triggers a blob download, and operates independently from the "Export Expenses" button — extend `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx` **[RED — tests must fail]**

### Implementation for User Story 2

- [X] T012 [P] [US2] Implement `RideHistoryCsvExportService` that queries `Rides` WHERE `RiderId = @riderId ORDER BY RideDateTimeLocal DESC`, groups rides by `RideDateTimeLocal.Year`, creates a `MemoryStream`-backed `ZipArchive` via `System.IO.Compression`, writes one `ZipArchiveEntry` named `{year}.csv` per year using `CsvRowBuilder` with the full 23-column ride header (RideId, Date, Miles, RideMinutes, …, CreatedAtUtc), handles the empty-dataset case by writing a header-only entry for the current year, and returns the sealed `MemoryStream` in `src/BikeTracking.Api/Application/Export/RideHistoryCsvExportService.cs`
- [X] T013 [US2] Add `GET /api/exports/rides` route to the existing `ExportEndpoints` route group, delegating to `RideHistoryCsvExportService` and returning `Results.File(stream, "application/zip", "ride-history-export.zip")` in `src/BikeTracking.Api/Endpoints/ExportEndpoints.cs`
- [X] T014 [P] [US2] Add `fetchRideHistoryZip()` async function that calls `GET /api/exports/rides` with `X-User-Id` header, receives the response as a `Blob`, creates an object URL, injects a transient `<a download="ride-history-export.zip">` element, clicks it, then revokes the URL — extend `src/BikeTracking.Frontend/src/services/export-api.ts`
- [X] T015 [US2] Add "Export Ride History" button and per-button loading/error state to `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx` (button calls `fetchRideHistoryZip` from `export-api.ts`; depends on T013 and T014)
- [X] T016 [US2] Extend Playwright E2E test to cover: ride history ZIP downloads with correct filename, ZIP contains expected per-year CSVs, each CSV has full ride header, multi-year split is correct, empty-dataset ZIP contains header-only CSV, and both export buttons operate independently in `src/BikeTracking.Frontend/tests/e2e/export.spec.ts`

**Checkpoint**: User Stories 1 AND 2 fully functional and independently testable.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, smoke-test tooling, and documentation alignment.

- [X] T017 Run all quickstart.md validation scenarios: Scenario 1 (expense CSV), Scenario 2 (ride history ZIP), Scenario 3 (user isolation), and Scenario 4 (independent button operation) against the running Aspire stack as described in `specs/028-csv-data-export/quickstart.md`
- [X] T018 [P] Add `.http` request file with `GET /api/exports/expenses` and `GET /api/exports/rides` examples (with `X-User-Id` header) for manual API-level smoke testing at `src/BikeTracking.Api/export.http`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Foundational (T001 → T002)
    └─ must complete before Phases 2 and 3

Phase 2: User Story 1 (T003–T009)
    └─ depends on Phase 1 completion
    └─ can proceed in parallel with Phase 3 if team capacity allows

Phase 3: User Story 2 (T010–T016)
    └─ depends on Phase 1 completion
    └─ T013 also depends on T006 (ExportEndpoints created in US1)
    └─ can proceed in parallel with Phase 2 if team capacity allows

Phase 4: Polish (T017–T018)
    └─ depends on Phase 2 + Phase 3 completion
```

### User Story Dependencies

| Story | Depends on | Can be independent? |
|-------|-----------|---------------------|
| US1 (P1) | Phase 1 only | ✅ Yes |
| US2 (P2) | Phase 1 + T006 (ExportEndpoints created by US1) | Mostly — add ride route after US1 creates the route group |

### Within Each Story (strict ordering)

1. **RED tests first** (T003/T004 for US1, T010/T011 for US2) — must fail before implementation begins
2. **Service before endpoint** (T005 before T006; T012 before T013)
3. **Frontend helper before UI** (T007 before T008; T014 before T015)
4. **E2E last** (T009 after T006+T008; T016 after T013+T015)

### Parallel Opportunities Within Each Phase

**Phase 1 (Foundational)**:
```
T001 (CsvRowBuilder tests) → T002 (implement CsvRowBuilder)   [sequential]
```

**Phase 2 (US1)**:
```
T003 (backend tests [P]) ─┐
T004 (frontend tests [P]) ─┘  both RED in parallel

T005 (ExpenseCsvExportService [P]) ─┐
T007 (export-api.ts fetchExpensesCsv [P]) ─┘  both in parallel after T002

T006 (ExportEndpoints expense route) → T008 (SettingsPage button) → T009 (E2E)  [sequential]
```

**Phase 3 (US2)**:
```
T010 (backend tests [P]) ─┐
T011 (frontend tests [P]) ─┘  both RED in parallel

T012 (RideHistoryCsvExportService [P]) ─┐
T014 (export-api.ts fetchRideHistoryZip [P]) ─┘  both in parallel after T002

T013 (ExportEndpoints rides route) → T015 (SettingsPage button) → T016 (E2E)  [sequential]
```

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)

1. Complete Phase 1: Foundational (T001 → T002)
2. Complete Phase 2: User Story 1 (T003 → T009)
3. **STOP and validate**: run expense CSV export end-to-end using quickstart Scenario 1 and Scenario 3
4. Merge MVP — delivers immediate user value with expenses export

### Incremental Delivery

1. **Foundation** (Phase 1) → `CsvRowBuilder` ready
2. **US1** (Phase 2) → Expense export works → MVP demo / merge
3. **US2** (Phase 3) → Ride history ZIP works → Full feature demo / merge
4. **Polish** (Phase 4) → Final validation pass

### Parallel Team Strategy

With two developers after Phase 1:
- **Developer A**: Phase 2 (User Story 1) — `ExpenseCsvExportService`, expense endpoint, `fetchExpensesCsv`, Settings button
- **Developer B**: Phase 3 (User Story 2) — `RideHistoryCsvExportService`, wait for T006, then ride endpoint, `fetchRideHistoryZip`, Settings button

---

## New Files Summary

| File | Status | Story |
|------|--------|-------|
| `src/BikeTracking.Api/Application/Export/CsvRowBuilder.cs` | NEW | Foundational |
| `src/BikeTracking.Api.Tests/Application/Export/CsvRowBuilderTests.cs` | NEW | Foundational |
| `src/BikeTracking.Api/Application/Export/ExpenseCsvExportService.cs` | NEW | US1 |
| `src/BikeTracking.Api/Endpoints/ExportEndpoints.cs` | NEW | US1 |
| `src/BikeTracking.Api.Tests/Endpoints/Export/ExpenseExportEndpointTests.cs` | NEW | US1 |
| `src/BikeTracking.Frontend/src/services/export-api.ts` | NEW | US1 + US2 |
| `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx` | MODIFIED | US1 + US2 |
| `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx` | MODIFIED | US1 + US2 |
| `src/BikeTracking.Frontend/tests/e2e/export.spec.ts` | NEW | US1 + US2 |
| `src/BikeTracking.Api/Application/Export/RideHistoryCsvExportService.cs` | NEW | US2 |
| `src/BikeTracking.Api.Tests/Endpoints/Export/RideExportEndpointTests.cs` | NEW | US2 |
| `src/BikeTracking.Api/Program.cs` | MODIFIED | US1 |
| `src/BikeTracking.Api/export.http` | NEW | Polish |
