# Tasks: Bike Expense Tracking (Spec 015)

**Feature**: Bike Expense Tracking  
**Branch**: `015-bike-expense-tracking`  
**Date Generated**: 2026-04-17  
**Total Tasks**: 86 | **Phases**: 7 | **Parallel Opportunities**: 12+

---

## Overview

This implementation follows Test-Driven Development (TDD) — each task is preceded by failing tests to validate the requirement before implementation. Tasks marked `[CONFIRM RED TESTS]` require the failing test output to be reviewed and confirmed before implementation begins, matching the constitution's TDD gate. Tasks are organized by user story (US1–US4) to enable independent, incremental delivery. The suggested MVP scope includes **Phases 1–3** (Setup + Foundational + US1), which delivers the core "record expense" feature end-to-end.

---

## Phase 1: Setup

**Goal**: Initialize project structure and register dependencies.

### Independent Test Criteria
- [ ] Solution builds without errors after migrations and new project references added
- [ ] DevContainer environment includes all required tooling (dotnet, npm, F# compiler)
- [ ] New files are registered in correct project files (.csproj, .fsproj)

### Tasks

- [X] T001 Create new F# module file `src/BikeTracking.Domain.FSharp/Expenses/ExpenseEvents.fs` with empty module declaration
- [X] T002 Register `ExpenseEvents.fs` in `src/BikeTracking.Domain.FSharp/BikeTracking.Domain.FSharp.fsproj` compilation order
- [X] T003 Create new EF Core entity file `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ExpenseEntity.cs` with table mapping
- [X] T004 Create new folder structure `src/BikeTracking.Api/Application/Expenses/` for application services
- [X] T005 Create new folder structure `src/BikeTracking.Api/Infrastructure/Receipts/` for receipt storage adapter
- [X] T006 Create new folder structure `src/BikeTracking.Api/Endpoints/` (reuse if exists) ready for endpoints
- [X] T007 Create new frontend folder `src/BikeTracking.Frontend/src/pages/expenses/` for entry and history pages
- [X] T008 Create new frontend service file `src/BikeTracking.Frontend/src/services/expenses-api.ts` (placeholder with imports)

---

## Phase 2: Foundational

**Goal**: Implement core domain logic, data model, and receipt storage port/adapter before any user story work.

**Blocking**: All user stories depend on completion of this phase.

### Independent Test Criteria
- [ ] F# domain unit tests validate amount/note/date constraints with 100% pass rate
- [ ] EF Core entity compiles and migration can be generated without errors
- [ ] Receipt storage port interface is implemented and `FileSystemReceiptStorage` adapter passes unit tests (in-memory stubs)
- [ ] Database migration applies successfully in test environment

### Sub-Phase 2.1: F# Domain (TDD)

- [X] T009 [P] [CONFIRM RED TESTS] Write failing F# unit tests for `validateAmount`: reject ≤ 0 decimals; accept > 0 (decimal amount) in `src/BikeTracking.Api.Tests/Expenses/ExpenseDomainTests.fs`, run them, and capture user confirmation that the failures are behavioral rather than setup issues
- [X] T010 [P] Implement `validateAmount` function in `src/BikeTracking.Domain.FSharp/Expenses/ExpenseEvents.fs` returning `Result<decimal, string>`
- [X] T011 [P] Write failing F# unit tests for `validateNotes`: reject strings > 500 chars; accept None; accept short valid strings in `src/BikeTracking.Api.Tests/Expenses/ExpenseDomainTests.fs`
- [X] T012 [P] Implement `validateNotes` function in `src/BikeTracking.Domain.FSharp/Expenses/ExpenseEvents.fs` returning `Result<string option, string>`
- [X] T013 [P] Write failing F# unit tests for `validateDate`: reject DateTime.MinValue; accept valid dates in `src/BikeTracking.Api.Tests/Expenses/ExpenseDomainTests.fs`
- [X] T014 [P] Implement `validateDate` function in `src/BikeTracking.Domain.FSharp/Expenses/ExpenseEvents.fs` returning `Result<DateTime, string>`
- [X] T015 [P] Define F# discriminated union types `ExpenseEvent` (ExpenseRecorded | ExpenseEdited | ExpenseDeleted) in `src/BikeTracking.Domain.FSharp/Expenses/ExpenseEvents.fs`

### Sub-Phase 2.2: Data Model (EF Core)

- [X] T016 [P] Implement `ExpenseEntity.cs` with columns: Id, RiderId, ExpenseDate, Amount, Notes, ReceiptPath, IsDeleted, Version, CreatedAtUtc, UpdatedAtUtc in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ExpenseEntity.cs`
- [X] T017 [P] Add `DbSet<ExpenseEntity> Expenses { get; set; }` to `BikeTrackingDbContext.cs`
- [X] T018 [P] Add EF Core model configuration for ExpenseEntity in `BikeTrackingDbContext.OnModelCreating()`: primary key, foreign key (RiderId → Users), check constraint (Amount > 0), indexes (RiderId ASC + ExpenseDate DESC, RiderId + IsDeleted)
- [X] T019 [P] Generate EF Core migration via `dotnet ef migrations add AddExpensesTable --project src/BikeTracking.Api` from repository root
- [X] T020 [P] Verify migration compiles and applies to test database without errors

### Sub-Phase 2.3: Receipt Storage Port/Adapter (TDD)

- [X] T021 [P] Define `IReceiptStorage` port interface in `src/BikeTracking.Api/Application/Expenses/IReceiptStorage.cs` with methods: `SaveAsync(riderId, expenseId, filename, stream)` → Task<string> (relative path), `DeleteAsync(relativePath)` → Task, `GetAsync(relativePath)` → Task<Stream>
- [X] T022 [P] Implement `FileSystemReceiptStorage.cs` in `src/BikeTracking.Api/Infrastructure/Receipts/FileSystemReceiptStorage.cs` with local filesystem storage (receipts/ subfolder strategy)
- [X] T023 [P] Write unit tests for `FileSystemReceiptStorage` using temporary directories (in-memory stubs for fast feedback) in `src/BikeTracking.Api.Tests/Expenses/ReceiptStorageTests.cs`
- [X] T024 [P] Register `IReceiptStorage` → `FileSystemReceiptStorage` in `src/BikeTracking.Api/Program.cs` dependency injection

---

## Phase 3: User Story 1 — Enter Manual Expense (P1)

**Goal**: Enable riders to record a manual expense with required date/amount and optional note/receipt.

**Acceptance**: Expense entry page accessible from menu; form validates and saves expense; rider sees success confirmation.

### Independent Test Criteria
- [ ] Rider navigates to expense entry page and sees form with date, amount, note, and receipt fields
- [ ] Submitting with missing date or negative/zero amount shows validation error on that field
- [ ] Submitting with valid date + positive amount saves the expense and shows success message
- [ ] Submitting without note or receipt succeeds (both optional)
- [ ] Submitted expense appears in the database with correct RiderId, date, amount, notes, and receipt status

### Sub-Phase 3.1: Backend Services (TDD)

- [ ] T025 [US1] [CONFIRM RED TESTS] Write failing unit tests for `RecordExpenseService` in `src/BikeTracking.Api.Tests/Expenses/RecordExpenseServiceTests.cs`: validates amount > 0, validates notes ≤ 500 chars, saves to DB, calls receipt storage; run them and capture user confirmation before implementing the service
- [ ] T026 [US1] Implement `RecordExpenseService` in `src/BikeTracking.Api/Application/Expenses/RecordExpenseService.cs`: accepts `RecordExpenseRequest` (date, amount, notes), calls domain validators, creates `ExpenseEntity`, saves to context, returns success with expenseId
- [ ] T027 [US1] Define `RecordExpenseRequest` and `RecordExpenseResponse` DTOs in `src/BikeTracking.Api/Contracts/ExpenseContracts.cs`

### Sub-Phase 3.2: API Endpoints (TDD)

- [ ] T028 [US1] Write failing integration tests for `POST /api/expenses` in `src/BikeTracking.Api.Tests/Expenses/ExpensesEndpointsTests.cs`: 201 with valid expense, 400 with validation error, 422 with invalid receipt
- [ ] T029 [US1] Implement `POST /api/expenses` endpoint in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs` accepting `multipart/form-data` (expenseDate, amount, notes, receipt file), calling `RecordExpenseService`, returning 201 with response
- [ ] T030 [US1] Implement `GET /api/expenses` endpoint in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs` accepting optional `startDate` + `endDate` query params, returning list of non-deleted expenses for authenticated rider with total amount
- [ ] T031 [US1] Register `/api/expenses` endpoints in `src/BikeTracking.Api/Program.cs`
- [ ] T031A [US1] Write failing integration security tests proving unauthenticated requests to expense endpoints are rejected in `src/BikeTracking.Api.Tests/Expenses/ExpensesEndpointsSecurityTests.cs`
- [ ] T031B [US1] Write failing integration security tests proving rider A cannot read, edit, delete, or fetch receipts for rider B's expenses in `src/BikeTracking.Api.Tests/Expenses/ExpensesEndpointsSecurityTests.cs`
- [ ] T031C [US1] Write failing integration security tests proving receipt file access ignores user-supplied paths and blocks path traversal or direct file access attempts in `src/BikeTracking.Api.Tests/Expenses/ExpensesEndpointsSecurityTests.cs`

### Sub-Phase 3.3: Frontend Entry Page (TDD)

- [ ] T032 [US1] Write failing Vitest unit tests for `ExpenseEntryPage` component in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseEntryPage.test.tsx`: renders form fields, validates client-side, calls API on submit
- [ ] T033 [US1] Implement `ExpenseEntryPage.tsx` in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseEntryPage.tsx` with form (date, amount, note, receipt file input), client-side validation, POST to `/api/expenses`, success/error states
- [ ] T034 [US1] Implement `ExpenseEntryPage.css` styling for form layout and responsive design in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseEntryPage.css`
- [ ] T035 [US1] Implement `expenses-api.ts` functions: `recordExpense(formData)` → Promise<RecordExpenseResponse> in `src/BikeTracking.Frontend/src/services/expenses-api.ts`
- [ ] T036 [US1] Add route `/expenses/entry` → `ExpenseEntryPage` in `src/BikeTracking.Frontend/src/App.tsx`
- [ ] T037 [US1] Add navigation menu link "Record Expense" → `/expenses/entry` in `src/BikeTracking.Frontend/src/[nav component]`

### Sub-Phase 3.4: E2E Tests (Optional; TDD if included)

- [ ] T038 [US1] Write Playwright E2E test: navigate to expense entry, fill form, submit, verify expense appears in list in `src/BikeTracking.Frontend/tests/e2e/record-expense.spec.ts`

---

## Phase 4: User Story 2 — View & Edit Expense History (P2)

**Goal**: Enable riders to view, inline-edit, and delete expenses following the existing ride history pattern.

**Acceptance**: History page shows list of expenses sorted by date (newest first) with date-range filter; inline editing with save/cancel; deletion with tombstone.

### Independent Test Criteria
- [ ] History page displays all rider's non-deleted expenses sorted by date (newest first)
- [ ] Date-range filter applied updates both list and visible total
- [ ] Inline edit on a row allows changing amount/note; save persists changes and increments version
- [ ] Edit with version conflict shows error; edit with invalid data blocks save
- [ ] Delete on a row removes expense from list and database (tombstone)
- [ ] Rider cannot access or edit another rider's expenses

### Sub-Phase 4.1: Backend Services (TDD)

- [ ] T039 [US2] [CONFIRM RED TESTS] Write failing unit tests for `EditExpenseService` in `src/BikeTracking.Api.Tests/Expenses/EditExpenseServiceTests.cs`: optimistic concurrency check, version increment, validation; run them and capture user confirmation before implementing the service
- [ ] T040 [US2] Implement `EditExpenseService` in `src/BikeTracking.Api/Application/Expenses/EditExpenseService.cs`: accepts `EditExpenseRequest` (id, date, amount, notes, expectedVersion), validates concurrency, updates entity, increments version
- [ ] T041 [US2] [CONFIRM RED TESTS] Write failing unit tests for `DeleteExpenseService` in `src/BikeTracking.Api.Tests/Expenses/DeleteExpenseServiceTests.cs`: sets IsDeleted, removes receipt file; run them and capture user confirmation before implementing the service
- [ ] T042 [US2] Implement `DeleteExpenseService` in `src/BikeTracking.Api/Application/Expenses/DeleteExpenseService.cs`: accepts `DeleteExpenseRequest` (id), sets IsDeleted=true, calls receipt storage delete
- [ ] T043 [US2] Define `EditExpenseRequest`, `EditExpenseResponse`, `DeleteExpenseRequest` DTOs in `src/BikeTracking.Api/Contracts/ExpenseContracts.cs`

### Sub-Phase 4.2: API Endpoints

- [ ] T044 [US2] Write failing integration tests for `PUT /api/expenses/{id}`, `DELETE /api/expenses/{id}` in `src/BikeTracking.Api.Tests/Expenses/ExpensesEndpointsTests.cs`
- [ ] T045 [US2] Implement `PUT /api/expenses/{id}` endpoint in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs` accepting JSON (date, amount, notes, expectedVersion), calling `EditExpenseService`, returning 200 with success or 409 conflict
- [ ] T046 [US2] Implement `DELETE /api/expenses/{id}` endpoint in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs` calling `DeleteExpenseService`, returning 204
- [ ] T047 [US2] Implement `PUT /api/expenses/{id}/receipt` endpoint for receipt upload in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs`
- [ ] T048 [US2] Implement `DELETE /api/expenses/{id}/receipt` endpoint for receipt removal in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs`

### Sub-Phase 4.3: Frontend History Page (TDD)

- [ ] T049 [US2] Write failing Vitest unit tests for `ExpenseHistoryPage` in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.test.tsx`: renders list, filters by date, inline edit, delete
- [ ] T050 [US2] Implement `ExpenseHistoryPage.tsx` in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.tsx` following `HistoryPage.tsx` pattern: fetch expenses, render table, support inline edit with save/cancel, delete action, date-range filter
- [ ] T051 [US2] Implement `ExpenseHistoryPage.css` styling in `src/BikeTracking.Frontend/src/pages/expenses/ExpenseHistoryPage.css`
- [ ] T052 [US2] Implement `expense-page.helpers.ts` utility functions in `src/BikeTracking.Frontend/src/pages/expenses/expense-page.helpers.ts`: format helpers, validation helpers
- [ ] T053 [US2] Add functions to `expenses-api.ts`: `getExpenseHistory(startDate?, endDate?)`, `editExpense(id, request)`, `deleteExpense(id)`, `uploadReceipt(id, file)`, `deleteReceipt(id)`
- [ ] T054 [US2] Add route `/expenses/history` → `ExpenseHistoryPage` in `src/BikeTracking.Frontend/src/App.tsx`
- [ ] T055 [US2] Add navigation menu link "Expense History" → `/expenses/history` in `src/BikeTracking.Frontend/src/[nav component]`

### Sub-Phase 4.4: E2E Tests (Optional; TDD if included)

- [ ] T056 [US2] Write Playwright E2E test: navigate to history, view expenses, filter by date, inline edit, delete in `src/BikeTracking.Frontend/tests/e2e/manage-expenses.spec.ts`

---

## Phase 5: User Story 3 — View Expense Totals on Dashboard (P3)

**Goal**: Display total manual expenses and automatic oil-change savings on the dashboard.

**Acceptance**: Dashboard shows expense summary card with total manual expenses, oil-change savings (if applicable), and net total.

### Independent Test Criteria
- [ ] Dashboard loads and includes `ExpenseSummary` in response with `TotalManualExpenses`, `OilChangeSavings`, `NetExpenses`
- [ ] Total manual expenses equals sum of all non-deleted expense amounts
- [ ] Oil-change savings calculated as `floor(totalMiles / 3000) × oilChangePrice` or null if price not set
- [ ] Net total equals manual expenses minus oil-change savings (or null if price not set)
- [ ] Dashboard UI displays expense card alongside existing gas-saved and mileage-saved cards

### Sub-Phase 5.1: Backend Service Extension

- [ ] T057 [US3] [CONFIRM RED TESTS] Write failing unit tests for expense calculation in `GetDashboardService` in `src/BikeTracking.Api.Tests/Dashboard/GetDashboardServiceTests.cs`, run them, and capture user confirmation before implementation
- [ ] T058 [US3] Extend `GetDashboardService` in `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs` to query `Expenses` table (non-deleted), sum amounts, calculate oil-change savings
- [ ] T059 [US3] Define `DashboardExpenseSummary` record in `src/BikeTracking.Api/Contracts/DashboardContracts.cs` with fields: TotalManualExpenses, OilChangeSavings?, NetExpenses?, OilChangeIntervalCount
- [ ] T060 [US3] Add `ExpenseSummary` property to `DashboardTotals` record in `src/BikeTracking.Api/Contracts/DashboardContracts.cs`

### Sub-Phase 5.2: Frontend Dashboard Update

- [ ] T061 [US3] Write failing Vitest unit tests for expense summary display in `src/BikeTracking.Frontend/src/pages/dashboard/DashboardPage.test.tsx`
- [ ] T062 [US3] Update `DashboardPage.tsx` in `src/BikeTracking.Frontend/src/pages/dashboard/DashboardPage.tsx` to render `ExpenseSummary` card from dashboard response
- [ ] T063 [US3] Create new component `ExpenseSummaryCard.tsx` in `src/BikeTracking.Frontend/src/pages/dashboard/ExpenseSummaryCard.tsx` displaying TotalManualExpenses, OilChangeSavings, NetExpenses
- [ ] T064 [US3] Add CSS styling for `ExpenseSummaryCard` in `src/BikeTracking.Frontend/src/pages/dashboard/ExpenseSummaryCard.css`

### Sub-Phase 5.3: E2E Tests (Optional; TDD if included)

- [ ] T065 [US3] Write Playwright E2E test: record expense, view dashboard, verify totals updated in `src/BikeTracking.Frontend/tests/e2e/dashboard-expenses.spec.ts`

---

## Phase 6: User Story 4 — Automatic Oil-Change Savings Reduce Expense Total (P4)

**Goal**: Ensure automatic oil-change savings are subtracted from total expenses to show net financial position.

**Acceptance**: Net expense total displayed and calculated correctly; negative net (savings) clearly shown; calculation updates when rides or settings change.

### Independent Test Criteria
- [ ] Dashboard net expense total = manual expenses - oil-change savings
- [ ] Net total can be negative (net savings)
- [ ] Net total recalculates when new expenses added, rides recorded, or oil change price updated
- [ ] UI clearly indicates when net position is savings vs. expenses

### Sub-Phase 6.1: Calculation & Display Logic

- [ ] T066 [US4] [CONFIRM RED TESTS] Write failing unit tests for net expense calculation in `GetDashboardService` tests, run them, and capture user confirmation before implementation
- [ ] T067 [US4] Verify `GetDashboardService` correctly computes `NetExpenses = TotalManualExpenses - OilChangeSavings` (null if oil price not set)
- [ ] T068 [US4] Update `ExpenseSummaryCard.tsx` to display net total with visual indicator (e.g., green for savings, red for expense)
- [ ] T069 [US4] Add CSS styling for net total indicator in `ExpenseSummaryCard.css`

### Sub-Phase 6.2: Integration Validation

- [ ] T070 [US4] Write failing E2E test covering: record expense + ride combo, update oil price, verify dashboard recalculation in `src/BikeTracking.Frontend/tests/e2e/savings-calculation.spec.ts`
- [ ] T071 [US4] Verify all integration tests pass: expense recording, editing, deletion, dashboard updates

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Add final validation, error handling, accessibility, and prepare for production.

### Tasks

- [ ] T072 [P] Add comprehensive error handling and logging for receipt upload failures in `FileSystemReceiptStorage.cs` and endpoints, covering disk-full, permission-denied, and non-writable-path scenarios; preserve other form data, save the expense without a receipt when allowed by the spec, and show a clear user-facing message that the receipt was not attached while logging riderId, expenseId, and the failure reason
- [ ] T073 [P] Add request/response logging for expense endpoints in `src/BikeTracking.Api/Endpoints/ExpensesEndpoints.cs`
- [ ] T074 [P] Validate receipt file types and sizes on both client (browser) and server (API); reject unsupported formats with clear messages that explicitly name the accepted formats (JPEG, PNG, WEBP, PDF) and the 5 MB maximum, without clearing the other entered form fields
- [ ] T075 [P] Add accessibility attributes (aria-labels, role hints) to form fields in `ExpenseEntryPage.tsx` and `ExpenseHistoryPage.tsx`
- [ ] T076 [P] Add responsive design breakpoints for mobile/tablet in `ExpenseEntryPage.css`, `ExpenseHistoryPage.css`, `ExpenseSummaryCard.css`
- [ ] T077 [P] Run code formatting via `csharpier format .` and ESLint/Stylelint on all new files
- [ ] T078 [P] Verify `dotnet test BikeTracking.slnx` and `npm run test:unit` all pass with >85% code coverage
- [ ] T079 [P] Run full E2E test suite `npm run test:e2e` against live API/DB and verify all pass
- [ ] T080 [P] Create feature documentation in `README.md` (if needed) or project wiki describing the new expense tracking feature
- [ ] T080A [P] Document platform-specific receipt storage paths and configuration expectations for Windows, macOS, and Linux so the app-data / `receipts/` location is explicit for support and troubleshooting
- [ ] T080B [P] Document local backup and restore guidance for the SQLite database and `receipts/` folder so end users can preserve expense history and attachments together
- [ ] T081 [P] Clean up any temporary test files or commented-out code before final commit

---

## Dependency Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational: F# Domain + EF Core + Receipt Storage)
    ↓
Phase 3 (US1: Record Expense) ← Must complete before US2, US3, US4
    ↓
Phase 4 (US2: View & Edit History) ← Can run parallel with Phase 5 & 6 after US1 complete
Phase 5 (US3: Dashboard Totals)    ← Can run parallel with Phase 4 & 6 after US1 complete
Phase 6 (US4: Oil-Change Savings)  ← Depends on Phase 5 complete
    ↓
Phase 7 (Polish)
```

---

## Parallel Execution Opportunities

### After Phase 2 Completes (Foundational)
- **Backend (T025-T048)** and **Frontend (T032-T055)** for US1 can proceed in parallel on separate machines/branches.
- Unit tests (T025, T039, T041) can be written simultaneously while service implementation happens in parallel.

### During Phase 4 & 5
- **Backend service extension (T057-T060)** and **frontend dashboard update (T062-T064)** can run in parallel once Phase 3 is complete.

### Test Layers
- **Unit tests** (F#, C# services, React components) can run in parallel and are unblocking for implementation.
- **Integration tests** (API endpoints) are unblocking for E2E tests but can start before full implementation.
- **E2E tests** (Playwright) require live API + DB and run last but provide full-stack validation.

---

## Summary

- **Total Tasks**: 86 (including optional E2E tests)
- **Non-Optional Tasks**: 82
- **Optional E2E Tasks**: 4 (T038, T056, T065, T070)
- **Phase 1 (Setup)**: 8 tasks
- **Phase 2 (Foundational)**: 16 tasks
- **Phase 3 (US1)**: 17 tasks
- **Phase 4 (US2)**: 18 tasks
- **Phase 5 (US3)**: 9 tasks
- **Phase 6 (US4)**: 6 tasks
- **Phase 7 (Polish)**: 12 tasks

**Suggested MVP Scope**: Phases 1–3 (41 tasks), delivering end-to-end expense recording with API persistence, basic frontend form, and the critical security tests for expense isolation.

**Estimated Timeline (Full Feature)**: 
- 1–2 weeks (one developer, full-time) with existing BikeTracking codebase familiarity.
- Parallelization can reduce to 1 week with 2+ developers on independent backend/frontend streams.

---

## Implementation Strategy

### Red-Green-Refactor Cycle (TDD)
1. For each task with tests, write **failing** test(s) first, verify failure, and pause for user confirmation on tasks marked `[CONFIRM RED TESTS]`.
2. Implement minimal code to make tests pass (**green**).
3. Refactor for clarity/performance while keeping tests passing.
4. Move to next task.

### Code Patterns Reference
- **Optimistic Concurrency**: See `EditRideService.cs` pattern for expense edits.
- **Tombstone Delete**: See `DeleteRideHandler.cs` pattern for expense deletion.
- **Ports-and-Adapters**: `IReceiptStorage` port + `FileSystemReceiptStorage` adapter.
- **Frontend History Page**: See `HistoryPage.tsx` for inline edit + date filter pattern.
- **Dashboard Extensions**: See `GetDashboardService.cs` for service extension pattern.

### Key Files to Reference
- `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs` — entity template
- `src/BikeTracking.Api/Application/Rides/EditRideService.cs` — concurrency pattern
- `src/BikeTracking.Api/Application/Rides/DeleteRideHandler.cs` — tombstone pattern
- `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs` — dashboard extension
- `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx` — frontend history pattern
- `src/BikeTracking.Domain.FSharp/Users/UserEvents.fs` — F# domain pattern

