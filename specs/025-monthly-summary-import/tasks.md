# Tasks: Monthly Summary Import (Auto-Split to Daily Rides)

**Feature Branch**: `025-monthly-summary-import`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md) | **Contracts**: [contracts/monthly-import-api.md](contracts/monthly-import-api.md)
**Generated**: 2026-06-25

---

## Format

```
- [ ] [ID] [P?] [USn?] Description with exact file path
```

- **[P]** — parallelizable (independent file, no blocking dependency on incomplete tasks)
- **[USn]** — maps to User Story n from spec.md (US1–US4)
- TDD enforced: all Phase 2 tests written and confirmed **failing** before Phase 3 implementation begins

---

## User Stories

| Story | Title | Priority |
|-------|-------|----------|
| US1 | Provide Monthly Summary Data | P1 |
| US2 | Weekday Distribution Logic | P1 |
| US3 | Specify the Year | P1 |
| US4 | Duplicate Detection and Resolution | P1 |

---

## Phase 1: Setup

**Purpose**: Schema migrations, entity extensions, contract declarations, and route stub registrations. All tasks must complete before Phase 2 (Tests).

- [X] T001 Generate EF Core migration `AddImportSourceToRides` — adds `ImportSource TEXT NULL` to `Rides` and `ImportRows` tables via `dotnet ef migrations add AddImportSourceToRides` in `src/BikeTracking.Api`; create migration file under `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T002 [P] Generate EF Core migration `AddImportTypeToImportJobs` — adds `ImportType TEXT NOT NULL DEFAULT 'csv'` to `ImportJobs` table via `dotnet ef migrations add AddImportTypeToImportJobs` in `src/BikeTracking.Api`; create migration file under `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T003 [P] Generate EF Core migration `AddMonthlySummaryAuditLogs` — creates `MonthlySummaryAuditLogs` table (all FR-015 columns, all `init` accessors) via `dotnet ef migrations add AddMonthlySummaryAuditLogs` in `src/BikeTracking.Api`; create migration file under `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T004 [P] Add `ImportSource string?` property (max-length 64) to `RideEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs` and configure `HasMaxLength(64)` in `BikeTrackingDbContext`
- [X] T005 [P] Add `ImportType string` property (default `"csv"`) to `ImportJobEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ImportJobEntity.cs`
- [X] T006 [P] Add `ImportSource string?` property to `ImportRowEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ImportRowEntity.cs`
- [X] T007 [P] Create `MonthlySummaryAuditLogEntity.cs` with all `init`-only properties in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/MonthlySummaryAuditLogEntity.cs` and register `DbSet<MonthlySummaryAuditLogEntity>` in `BikeTrackingDbContext`
- [X] T008 [P] Create `MonthlySummaryImportContracts.cs` with all new DTOs — `MonthlyImportPreviewRequest`, `MonthlyImportGeneratedRide`, `MonthlyImportMonthRow`, `MonthlyImportPreviewResponse` — in `src/BikeTracking.Api/Contracts/MonthlySummaryImportContracts.cs`
- [X] T009 [P] Register stub `MonthlyImportEndpoints` route group in `src/BikeTracking.Api/Program.cs` (returns 501 Not Implemented) and add `/import/monthly` route + "Monthly Summary Import" navigation card to `src/BikeTracking.Frontend/src/App.tsx`

**Checkpoint ✅**: All migrations created, entity types and contracts declared, route stubs registered. `dotnet build BikeTracking.slnx` clean.

---

## Phase 2: Tests

**Purpose**: TDD red phase — write all tests first, confirm every one **fails**, then proceed to Phase 3. Constitution directive 3: _"TDD is mandatory: failing-test proof must be shown before implementation starts."_

> ⚠️ **STOP AFTER THIS PHASE. Run `dotnet test BikeTracking.slnx` and `npm run test:unit`. All tests below MUST fail (red). Do not proceed to Phase 3 until red checkpoint is confirmed.**

### Domain Tests — US2: Weekday Distribution

- [X] T010 [P] [US2] Write `getWeekdays` unit tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryDistributorTests.cs` — covers: standard month returns only Mon–Fri sorted ascending; February non-leap returns 20 weekdays; February leap-year correct count; result contains no Saturdays or Sundays (SC-003)
- [X] T011 [P] [US2] Write `selectWeekdays` unit tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryDistributorTests.cs` — covers: days=1 selects stride-th weekday; days=weekdayCount selects all; days>weekdayCount returns `Error`; May 2025 with 8 days verifies even spread (not front-loaded, stride=floor(23/8)=2, first selected = weekdays[1])
- [X] T012 [P] [US2] Write `distributeRides` unit tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryDistributorTests.cs` — covers: per-day miles use `floor(total/days*100)/100`; remainder applied to last ride only; sum of all ride miles equals totalMiles exactly with no floating-point loss (SC-002); all dates are weekdays; May 2025 8-day 96-mile case produces exactly 8 rides summing to 96.00

### Parser Tests — US1: Monthly Summary Data Input

- [X] T013 [P] [US1] Write `MonthlySummaryParser` unit tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryParserTests.cs` — covers: tab-delimited input; whitespace-delimited input; case-insensitive headers ("MONTH", "miles", "Days"); comma thousands-separator stripped from miles ("1,200.5" → 1200.5); no-header row sets `HeaderDetectionWarning=true` and treats first row as data; full English month names (January–December); 3-letter ISO abbreviations (Jan–Dec); empty input returns 0 rows; header-only input returns 0 rows with `HeaderDetectionWarning=false`

### Validation Tests — US1: Row Validation

- [X] T014 [P] [US1] Write `MonthlySummaryValidationRules` unit tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryValidationRulesTests.cs` — covers: `INVALID_MONTH` for unrecognised name ("Jnauary"); `INVALID_MILES` for Miles≤0 and missing; `INVALID_DAYS` for Days<1 and missing; `DAYS_EXCEED_WEEKDAYS` with count of available weekdays in message; `MILES_PER_DAY_EXCEEDS_LIMIT` when floor(miles/days)>200; `DUPLICATE_MONTH` flagged on ALL affected rows when same month appears twice (second-pass cross-row detection); valid row produces empty error list

### Year-Assignment Tests — US3: Year Specification

- [X] T015 [P] [US3] Write year-assignment unit tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryImportServiceTests.cs` — covers: all months within one year assigned startYear; Dec→Jan boundary assigns startYear to Dec, startYear+1 to Jan; Nov→Feb sequence starting 2025 assigns 2025 to Nov/Dec and 2026 to Jan/Feb (spec independent test SC); no-boundary 12-month year stays on startYear throughout

### Service Integration Tests — US1 + US4

- [X] T016 [P] [US1] Write `MonthlySummaryImportService.PreviewAsync` happy-path integration test in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryImportServiceTests.cs` — paste 3-month sample, verify `ImportJobEntity` created with `ImportType="monthly-summary"`, correct number of `ImportRowEntity` rows persisted (one per generated ride), `MonthlyImportPreviewResponse` fields match expected ride counts and mile sums
- [X] T017 [P] [US4] Write duplicate detection integration tests in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryImportServiceTests.cs` — seed existing ride on a target weekday date; call `PreviewAsync`; verify `IsDuplicate=true` and `DuplicateMatches` populated for that ride; verify non-colliding rides have `IsDuplicate=false`

### Frontend Unit Tests — US1 + US3

- [X] T018 [P] [US3] Write `MonthlyYearSelector` unit tests, co-located at `src/BikeTracking.Frontend/src/components/monthly-import/MonthlyYearSelector.test.tsx` (repo convention: co-located tests, not `tests/unit/`) — covers: renders number input; "Confirm Import" button disabled when no year entered; enabled after valid year [2000–2100]; `onChange` fires with correct value; rejects out-of-range year
- [X] T019 [P] [US1] Write `MonthlyPreviewTable` unit tests, co-located at `src/BikeTracking.Frontend/src/components/monthly-import/MonthlyPreviewTable.test.tsx` — covers: renders each month row; shows generated ride count per month; duplicate rides marked with visual indicator; validation error messages rendered per row; empty-state when no rows
- [X] T020 [P] [US1] Write `MonthlyImportSummaryPanel` unit tests, co-located at `src/BikeTracking.Frontend/src/components/monthly-import/MonthlyImportSummaryPanel.test.tsx` — covers: displays months processed, rides created, rides replaced, rides skipped, rows rejected; zero values rendered (not blank); panel replaces preview area after confirmation

### E2E Scaffold — Gate

- [X] T021 [US1] Write E2E test scaffold (6 failing scenarios) in `src/BikeTracking.Frontend/tests/e2e/monthly-import.spec.ts`:
  1. Paste 3-month tab-delimited data → preview shows correct ride count per month
  2. Select year → generated ride dates update to reflect selected year
  3. Year boundary (Nov→Feb starting 2025) → Nov/Dec dates = 2025, Jan/Feb dates = 2026
  4. Confirm import → rides appear in ride history tagged `monthly-import` (SC-006)
  5. Re-import same month → duplicate resolution dialog shown; "Keep Existing" preserves original; "Replace" overwrites (SC-004)
  6. Invalid row (unrecognised month name) → error surfaced before confirmation; no rides written (SC-005)

**Checkpoint 🔴**: `dotnet test BikeTracking.slnx` and `npm run test:unit` — all T010–T021 confirmed **FAILING**. Red checkpoint committed before Phase 3 begins.

---

## Phase 3: Core

**Purpose**: Implement F# domain and C# backend to make Phase 2 backend tests green. No frontend implementation yet.

### F# Domain — US2: Weekday Distribution

- [X] T022 [US2] Implement `MonthlySummaryDistributor.fs` in `src/BikeTracking.Domain.FSharp/MonthlySummaryDistributor.fs` — three exported functions: `getWeekdays (month: int) (year: int) : DateOnly list` (all Mon–Fri in month, ascending); `selectWeekdays (weekdays: DateOnly list) (days: int) : Result<DateOnly list, string>` (stride = `max(1, floor(count/days))`, first selected = `weekdays.[stride-1]`, 1-indexed, returns `Error` if `days > count` or `days < 1`); `distributeRides (month: int) (year: int) (totalMiles: decimal) (days: int) : Result<(DateOnly * decimal) list, string>` (per_day = `floor(totalMiles/days*100M)/100M`, remainder on last ride)

### Parser and Validation — US1

- [X] T023 [P] [US1] Implement `MonthlySummaryParser.cs` in `src/BikeTracking.Api/Application/Imports/MonthlySummaryParser.cs` — delimiter detection (tab preferred, then whitespace-split); case-insensitive header matching for "Month", "Miles", "Days"; no-header positional fallback sets `HeaderDetectionWarning = true` in returned `ParsedMonthlySummaryDocument`; month name normalisation (full English names + 3-letter ISO abbreviations → `int? Month`); comma stripping from miles before `decimal.TryParse`; returns `ParsedMonthlySummaryDocument` record
- [X] T024 [P] [US1] Implement `MonthlySummaryValidationRules.cs` in `src/BikeTracking.Api/Application/Imports/MonthlySummaryValidationRules.cs` — single-pass per-row validation emitting `ImportValidationError` list (INVALID_MONTH, INVALID_MILES, INVALID_DAYS, DAYS_EXCEED_WEEKDAYS with available-weekday count, MILES_PER_DAY_EXCEEDS_LIMIT); second cross-row pass for DUPLICATE_MONTH flagging all affected rows

### Service Layer — US1 + US3 + US4

- [X] T025 Create `IMonthlySummaryImportService.cs` port interface in `src/BikeTracking.Api/Application/Imports/IMonthlySummaryImportService.cs` — declare `PreviewAsync(riderId, MonthlyImportPreviewRequest)`, `StartAsync`, `GetStatusAsync`, `CancelAsync`; register in DI container in `Program.cs`
- [X] T026 [US1] [US3] [US4] Implement `MonthlySummaryImportService.cs` in `src/BikeTracking.Api/Application/Imports/MonthlySummaryImportService.cs` — `PreviewAsync` pipeline: base64-decode → `MonthlySummaryParser.Parse` → `MonthlySummaryValidationRules.Validate` → year-assignment (boundary detection: increment year when parsedMonth < previousMonth) → call `MonthlySummaryDistributor.distributeRides` per valid row → duplicate check against existing `Rides` rows → persist `ImportJobEntity` (`ImportType="monthly-summary"`, `Status="awaiting-confirmation"`) + one `ImportRowEntity` per generated ride (with `ImportSource="monthly-import"`) → return `MonthlyImportPreviewResponse`; `StartAsync`/`GetStatusAsync`/`CancelAsync` delegate to existing import infrastructure
- [X] T027 [US1] Extend `RecordRideRequest` with optional `ImportSource string?` parameter and extend `RecordRideService.ExecuteAsync` to persist it on the created `RideEntity` in `src/BikeTracking.Api/Application/RecordRideService.cs`
- [X] T028 Extend `ImportJobProcessor.BuildRecordRideRequest` in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs` — pass `row.ImportSource` through to `RecordRideRequest` so monthly-import rides receive `ImportSource="monthly-import"` when saved

**Checkpoint 🟢**: `dotnet test BikeTracking.slnx` — T010–T017 green. Domain, parser, validation, and service tests passing.

---

## Phase 4: Integration

**Purpose**: Wire API endpoints, implement frontend service layer, build and assemble all UI components.

### API Endpoints — US1 + US4

- [X] T029 [US1] Implement `MonthlyImportEndpoints.cs` route group in `src/BikeTracking.Api/Endpoints/MonthlyImportEndpoints.cs` — replace T009 stubs with real handlers: `POST /api/monthly-imports/preview` → `IMonthlySummaryImportService.PreviewAsync` (400 on file>5MB, invalid base64, blank content, year out of [2000–2100]); `POST /api/monthly-imports/start` → `StartAsync` (202/400/404/409); `GET /api/monthly-imports/{id}/status` → `GetStatusAsync`; `POST /api/monthly-imports/{id}/cancel` → `CancelAsync`; all require `RequireAuthorization`
- [X] T030 [P] Extend `ImportJobProcessor` in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs` — after setting `Status = "completed"` for jobs where `ImportType = "monthly-summary"`, write `MonthlySummaryAuditLogEntity` (all FR-015 fields) in the same `SaveChangesAsync` transaction; guard: only write for monthly-summary jobs

### Frontend API Layer — US1

- [X] T031 [P] [US1] Implement `monthly-import-api.ts` typed fetch helpers in `src/BikeTracking.Frontend/src/services/monthly-import-api.ts` — `previewMonthlyImport(req: MonthlyImportPreviewRequest): Promise<ApiResponse<MonthlyImportPreviewResponse>>`; `startMonthlyImport(req: ImportStartRequest): Promise<ApiResponse<ImportStartResponse>>`; `getMonthlyImportStatus(id: number): Promise<ApiResponse<ImportStatusResponse>>`; `cancelMonthlyImport(id: number): Promise<ApiResponse<ImportCancelResponse>>`; use same `ApiResponse<T>` wrapper pattern as existing services

### Frontend Components — US1 + US2 + US3

- [X] T032 [P] [US3] Implement `MonthlyYearSelector.tsx` in `src/BikeTracking.Frontend/src/components/monthly-import/MonthlyYearSelector.tsx` — number input for year [2000–2100]; exposes `value`, `onChange`, and `disabled` props; parent page disables "Confirm Import" until valid year entered (FR-004)
- [X] T033 [P] [US1] [US2] Implement `MonthlyPreviewTable.tsx` in `src/BikeTracking.Frontend/src/components/monthly-import/MonthlyPreviewTable.tsx` — renders `MonthlyImportMonthRow[]`; shows per-month generated ride records (date, miles); flags duplicate rides with existing-vs-incoming side-by-side display; renders per-row `ImportValidationError` messages; shows valid/invalid row counts in header summary (FR-009)
- [X] T034 [P] [US1] Implement `MonthlyImportSummaryPanel.tsx` in `src/BikeTracking.Frontend/src/components/monthly-import/MonthlyImportSummaryPanel.tsx` — inline summary panel that replaces preview after completion; displays: months processed, ride records created, ride records replaced, ride records skipped, rows rejected (FR-013)
- [X] T035 [US1] [US2] [US3] [US4] Implement `MonthlyImportPage.tsx` 6-step flow in `src/BikeTracking.Frontend/src/pages/monthly-import/MonthlyImportPage.tsx` and `MonthlyImportPage.css` — Step 1: file upload input + paste textarea, submit calls `previewMonthlyImport`; Step 2: `MonthlyYearSelector` (confirm disabled until year selected); Step 3: `MonthlyPreviewTable` with `HeaderDetectionWarning` banner (requires explicit rider dismissal before confirm enabled); Step 4: duplicate resolution reusing existing `DuplicateResolutionDialog` component; Step 5: progress tracking reusing existing `ImportProgressPanel` component with `getMonthlyImportStatus` polling; Step 6: `MonthlyImportSummaryPanel` replacing preview
- [X] T036 [P] [US1] Add "Monthly Summary Import" entry-point link/card to `src/BikeTracking.Frontend/src/pages/ImportRidesPage.tsx` alongside existing import options (FR-001); confirm `/import/monthly` route registered in `App.tsx` (T009)

**Checkpoint 🟢**: Full flow functional end-to-end. `npm run test:unit` green. Manual smoke test: import `sample-3months.txt` from quickstart.md — preview shows correct ride schedule; confirm — rides appear in ride history tagged `monthly-import`.

---

## Phase 5: Polish

**Purpose**: Edge-case coverage, header-detection UX, accessibility, E2E gate, and full regression sign-off.

- [X] T037 [P] Harden `HeaderDetectionWarning` UX in `src/BikeTracking.Frontend/src/pages/monthly-import/MonthlyImportPage.tsx` — show persistent warning banner when `HeaderDetectionWarning=true`; disable "Confirm Import" until rider explicitly acknowledges the positional column mapping; acknowledgement stored in component state (FR-003)
- [X] T038 [P] Harden intra-file `DUPLICATE_MONTH` UX in `src/BikeTracking.Frontend/src/pages/monthly-import/MonthlyImportPage.tsx` — block confirmation and surface per-row DUPLICATE_MONTH error on all affected rows; "Confirm Import" remains disabled until rider resolves by removing the conflicting row from the input (FR-011)
- [X] T039 [P] Add edge-case unit tests to cover any remaining gaps in `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryValidationRulesTests.cs` and `src/BikeTracking.Api.Tests/Application/Imports/MonthlySummaryParserTests.cs` — Days=0, Miles=0, Miles negative, Days>weekdays with exact available-weekday count in error, comma thousands-separator ("1,200.5" → 1200.5), empty file (0 rows), header-only file (0 rows), unrecognised month name with typo ("Jnauary")
- [X] T040 [P] Add ARIA labels, keyboard navigation, and focus management across `src/BikeTracking.Frontend/src/pages/monthly-import/MonthlyImportPage.tsx` and `src/BikeTracking.Frontend/src/components/monthly-import/` — all interactive controls labelled; tab order logical; duplicate resolution dialog focus-trapped
- [X] T041 Complete all 6 Playwright E2E scenarios in `src/BikeTracking.Frontend/tests/e2e/monthly-import.spec.ts` — implement full scenario bodies against running app; confirm each passes (E2E PR gate per constitution directive 4)
- [X] T042 Run full regression suite and confirm zero failures — `dotnet test BikeTracking.slnx` (backend + domain); `npm run test:unit` in `src/BikeTracking.Frontend`; `npm run test:e2e` in `src/BikeTracking.Frontend`; verify no regressions to existing per-ride CSV import flow

**Checkpoint ✅**: All tests passing. E2E gate green. Feature complete and ready for PR.

---

## Dependency Graph

```
T001 ──► T004, T005, T006, T007   (migration before entity properties)
T002 ──► T005                      (migration before entity property)
T003 ──► T007                      (migration before entity)

Phase 1 (T001–T009) ────────────► Phase 2 (T010–T021)
  [all entity types and contracts must exist before tests compile]

T010, T011, T012 ──► T022         (distributor tests red before F# impl)
T013             ──► T023         (parser tests red before parser impl)
T014             ──► T024         (validation tests red before rules impl)
T015, T016, T017 ──► T026         (service tests red before service impl)
T025             ──► T026, T029   (interface before impl and endpoints)
T022             ──► T026         (F# distributor before service orchestration)
T023, T024       ──► T026         (parser + validation before service)
T027, T028       ──► T029         (RecordRideService + Processor extended before endpoints)
T026             ──► T029         (service before endpoints)
T029             ──► T031         (API endpoints before frontend service layer)
T030 parallel with T029
T031, T032, T033, T034 ──► T035   (components + API helpers before page assembly)
T035             ──► T036, T037, T038   (page before polish passes)
T035, T030       ──► T041         (page + audit log before E2E confirms data integrity)
T037, T038, T039, T040, T041 ──► T042  (all polish before final regression)
```

---

## Parallel Execution Groups

| Group | Tasks | Condition |
|-------|-------|-----------|
| A — Phase 1 parallel | T002, T003, T004, T005, T006, T007, T008, T009 | After T001 migration scaffolding started |
| B — Phase 2 all parallel | T010–T021 | After Phase 1 complete |
| C — Phase 3 partial | T023, T024 | After T022 (F# module done) |
| D — Phase 4 components | T030, T031, T032, T033, T034, T036 | After T029 (endpoints done); T030 parallel with T029 |
| E — Phase 5 all parallel | T037, T038, T039, T040 | After T035 (page assembled) |

---

## Implementation Strategy

**MVP Scope** (deliver US1 + US2 + US3 end-to-end first):

1. Phase 1 (T001–T009) — schema + contracts + stubs
2. T010–T017 — domain + backend tests red
3. T022–T028 — F# domain + C# backend green
4. T029 + T031 + T035 — endpoints + API helpers + page (basic flow)

MVP delivers: paste → preview → year select → confirm → rides in ride history tagged `monthly-import`.

**Increment 2** — US4 + UX hardening:
T030 (audit log), T036 (navigation), T037 (header warning), T038 (intra-file duplicate UX)

**Increment 3** — Polish + PR gate:
T039 (edge cases), T040 (accessibility), T041 (E2E complete), T042 (regression)

---

## Test Commands

```bash
# Backend + domain unit and integration tests
dotnet test BikeTracking.slnx

# Frontend unit tests (Vitest + React Testing Library)
npm run test:unit      # in src/BikeTracking.Frontend

# E2E tests (Playwright) — PR gate
npm run test:e2e       # in src/BikeTracking.Frontend
```
