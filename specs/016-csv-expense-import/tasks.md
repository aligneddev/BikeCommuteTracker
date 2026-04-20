# Tasks: CSV Expense Import

**Input**: Design documents from `/specs/016-csv-expense-import/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/api-contracts.md`, `quickstart.md`
**Dependency**: Spec 015 (Bike Expense Tracking) must be fully implemented — `RecordExpenseService`, `EditExpenseService`, `ExpenseEntity`, and `Expenses` table are required.

**Tests**: Tests are required for this feature. Strict TDD gate applies: write failing tests before each implementation step.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare base folders, service registration scaffolding, and frontend route placeholders.

- [X] T001 Create `src/BikeTracking.Api/Application/ExpenseImports/` folder
- [X] T002 Create `src/BikeTracking.Frontend/src/pages/expenses/` import page placeholder (`ExpenseImportPage.tsx`, `ExpenseImportPage.css`)
- [ ] T003 Create `src/BikeTracking.Frontend/src/components/expense-import/` folder
- [X] T004 Create `src/BikeTracking.Frontend/src/services/expense-import-api.ts` placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define contracts, persistence model, and endpoint wiring that all stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Create import DTO contracts in `src/BikeTracking.Api/Contracts/ExpenseImportContracts.cs`
- [X] T006 [P] Create `ExpenseImportJobEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ExpenseImportJobEntity.cs`
- [X] T007 [P] Create `ExpenseImportRowEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ExpenseImportRowEntity.cs`
- [X] T008 Configure import entity mappings (DbSet, indexes, cascade delete) in `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`
- [X] T009 Create endpoint shell in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [X] T010 Register import services and endpoint mapping in `src/BikeTracking.Api/Program.cs`
- [X] T011 Create EF migration `AddExpenseImportTables` in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T012 Add `AddExpenseImportTables` migration entry to `src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs`

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 — Upload and Import CSV File (Priority: P1)

**Goal**: Allow rider to upload a CSV with Date, Amount, Note; validate rows; preview results; confirm to import valid rows. Receipts excluded.

**Independent Test**: Upload a CSV with valid and invalid rows; confirm preview shows errors and only valid non-skipped rows are imported after confirmation.

### Tests for User Story 1

- [X] T013 [P] [US1] Add parser header/required-column tests in `src/BikeTracking.Api.Tests/Application/ExpenseImports/CsvExpenseParserTests.cs`
- [X] T014 [P] [US1] Add row validation tests (date, amount, note rules; full amount normalization pipeline including trailing ISO currency codes) in `src/BikeTracking.Api.Tests/Application/ExpenseImports/CsvExpenseParserTests.cs`
- [X] T015 [P] [US1] Add preview endpoint contract tests in `src/BikeTracking.Api.Tests/Endpoints/ExpenseImportEndpointsTests.cs`
- [X] T016 [P] [US1] Add frontend preview rendering unit tests in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.test.tsx`
- [ ] T017 [US1] Add E2E happy-path upload-preview-confirm-import test in `src/BikeTracking.Frontend/tests/e2e/expense-import.spec.ts`
- [ ] T018 [US1] Add non-CSV upload rejection integration test in `src/BikeTracking.Api.Tests/Endpoints/ExpenseImportEndpointsTests.cs`
- [ ] T019 [US1] Add frontend non-CSV error rendering unit test in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.test.tsx`
- [ ] T020 [US1] Add oversized upload (> 5 MB) endpoint integration test in `src/BikeTracking.Api.Tests/Endpoints/ExpenseImportEndpointsTests.cs`
- [ ] T021 [US1] Add oversized-file frontend error unit test in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.test.tsx`
- [X] T022 [US1] Add receipts-excluded notice unit test (notice present in all page states) in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.test.tsx`

### Implementation for User Story 1

- [X] T023 [US1] Implement CSV parsing, header normalization, and `NormalizeAmount` pipeline (leading symbol strip → comma removal → trailing ISO code strip → decimal parse) in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseParser.cs`
- [X] T024 [US1] Implement row validation rules (date parsing, amount > 0, currency stripping, note length) in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseParser.cs`
- [X] T025 [US1] Implement preview orchestration (parse → validate → persist job + rows) in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs`
- [X] T026 [US1] Implement confirm + execute orchestration (load rows → apply resolutions → create expenses → update job) in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs`
- [X] T027 [US1] Implement preview endpoint (`POST /api/expense-imports/preview`) in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [X] T028 [US1] Implement confirm endpoint (`POST /api/expense-imports/{jobId}/confirm`) in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [X] T029 [US1] Implement status endpoint (`GET /api/expense-imports/{jobId}/status`) in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [X] T030 [US1] Implement frontend import API service functions in `src/BikeTracking.Frontend/src/services/expense-import-api.ts`
- [X] T031 [US1] Build import page upload and preview UI in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.tsx`
- [X] T032 [US1] Build import page completion summary UI in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.tsx`
- [X] T033 [US1] Add receipts-excluded notice (persistent across all page states) in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.tsx`
- [X] T034 [US1] Add import page styles in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.css`
- [X] T035 [US1] Wire `/expenses/import` route in `src/BikeTracking.Frontend/src/App.tsx`
- [X] T036 [US1] Enforce non-CSV file validation (extension + MIME type) in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [X] T037 [US1] Enforce 5 MB upload limit in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`

**Checkpoint**: User Story 1 is independently functional (upload, validate, preview, confirm, import, summary).

---

## Phase 4: User Story 2 — Duplicate Detection and Resolution (Priority: P1)

**Goal**: Detect duplicates by date+amount; allow keep existing, replace with import, or override-all behavior.

**Independent Test**: Import a CSV containing at least one date+amount duplicate; verify duplicate conflict is shown in preview; verify resolution choice controls final import outcome.

### Tests for User Story 2

- [ ] T038 [P] [US2] Add duplicate key and match tests (including: intra-file rows never compared against each other; deleted expenses not matched) in `src/BikeTracking.Api.Tests/Application/ExpenseImports/ExpenseDuplicateDetectorTests.cs`
- [ ] T039 [P] [US2] Add duplicate resolution orchestration tests (including: `replace-with-import` + blank CSV note → existing note preserved; `replace-with-import` + non-blank note → note updated) in `src/BikeTracking.Api.Tests/Application/ExpenseImports/CsvExpenseImportServiceTests.cs`
- [X] T040 [P] [US2] Add confirm endpoint duplicate resolution tests in `src/BikeTracking.Api.Tests/Endpoints/ExpenseImportEndpointsTests.cs`
- [ ] T041 [P] [US2] Add duplicate resolution panel unit tests in `src/BikeTracking.Frontend/src/components/expense-import/ExpenseDuplicateResolutionPanel.test.tsx`
- [ ] T042 [US2] Add E2E duplicate keep-existing test in `src/BikeTracking.Frontend/tests/e2e/expense-import.spec.ts`
- [ ] T043 [US2] Add E2E duplicate replace-with-import test in `src/BikeTracking.Frontend/tests/e2e/expense-import.spec.ts`
- [ ] T044 [US2] Add E2E override-all-duplicates test in `src/BikeTracking.Frontend/tests/e2e/expense-import.spec.ts`

### Implementation for User Story 2

- [X] T045 [US2] Implement duplicate detection by date+amount in `src/BikeTracking.Api/Application/ExpenseImports/ExpenseDuplicateDetector.cs`
- [X] T046 [US2] Integrate duplicate detection into preview orchestration in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs`
- [X] T047 [US2] Implement `keep-existing` resolution (skip row, increment `SkippedRows`) in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs`
- [X] T048 [US2] Implement `replace-with-import` resolution with **partial-note semantics** via `EditExpenseService`: update date and amount always; update note only when CSV note is non-blank; preserve existing note when CSV note is blank in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs`
- [X] T049 [US2] Implement `override-all-duplicates` bypass (import all valid rows including duplicates) in `src/BikeTracking.Api/Application/ExpenseImports/CsvExpenseImportService.cs`
- [X] T050 [US2] Return duplicate conflict details in preview endpoint response in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [ ] T051 [US2] Build `ExpenseDuplicateResolutionPanel` component with per-row and override-all controls in `src/BikeTracking.Frontend/src/components/expense-import/ExpenseDuplicateResolutionPanel.tsx`
- [ ] T052 [US2] Integrate `ExpenseDuplicateResolutionPanel` into `ExpenseImportPage` preview state in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.tsx`

**Checkpoint**: User Story 2 is independently functional (duplicate detection, resolution, override-all).

---

## Phase 5: User Story 3 — Navigation and Access from Expenses Page (Priority: P2)

**Goal**: "Import Expenses" is discoverable from the Expenses history page; import page is auth-guarded; receipts-excluded notice is visible.

**Independent Test**: Log in, navigate to Expenses history page, click "Import Expenses," confirm import page loads; attempt unauthenticated access, confirm redirect to login.

### Tests for User Story 3

- [X] T053 [P] [US3] Add unit test confirming "Import Expenses" button/link renders in `ExpenseHistoryPage` in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.test.tsx` (or existing test file)
- [X] T054 [P] [US3] Add DELETE endpoint integration tests in `src/BikeTracking.Api.Tests/Endpoints/ExpenseImportEndpointsTests.cs` — valid job → 204 and job+rows deleted; wrong rider → 403; job not found → 404 (idempotent)
- [ ] T055 [US3] Add E2E test: navigation from Expenses page to import page in `src/BikeTracking.Frontend/tests/e2e/expense-import.spec.ts`
- [ ] T056 [US3] Add E2E test: unauthenticated access to `/expenses/import` redirects to login in `src/BikeTracking.Frontend/tests/e2e/expense-import.spec.ts`

### Implementation for User Story 3

- [X] T057 [US3] Implement `DELETE /api/expense-imports/{jobId}` endpoint (ownership check, cascade delete of job + rows, 204 response) in `src/BikeTracking.Api/Endpoints/ExpenseImportEndpoints.cs`
- [X] T058 [US3] Add `deleteExpenseImport(jobId: number): Promise<void>` function to `src/BikeTracking.Frontend/src/services/expense-import-api.ts`
- [X] T059 [US3] Wire `useEffect` cleanup and `beforeunload` listener on summary state to call `deleteExpenseImport(jobId)` in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseImportPage.tsx`
- [X] T060 [US3] Add "Import Expenses" button/link to `ExpenseHistoryPage` header area in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.tsx`
- [X] T061 [US3] Ensure `/expenses/import` route is covered by the existing auth guard in `src/BikeTracking.Frontend/src/App.tsx`

**Checkpoint**: User Story 3 is independently functional (navigation link, auth guard, receipts notice, session cleanup on summary dismiss).

---

## Phase 6: Completion Gate

**Purpose**: Verify all quality gates before the feature branch is considered complete.

- [ ] T062 Run `dotnet test BikeTracking.slnx` and confirm all backend tests pass
- [ ] T063 Run EF migration (`dotnet ef database update`) and confirm schema applies cleanly
- [ ] T064 Run `npm run lint` from `src/BikeTracking.Frontend` and confirm no lint errors
- [ ] T065 Run `npm run build` from `src/BikeTracking.Frontend` and confirm clean build
- [ ] T066 Run `npm run test:unit` from `src/BikeTracking.Frontend` and confirm all unit tests pass
- [ ] T067 Run `npm run test:e2e` from `src/BikeTracking.Frontend` against live Aspire stack and confirm all E2E tests pass
- [ ] T068 Run `csharpier format .` from repo root and confirm no formatting changes required
