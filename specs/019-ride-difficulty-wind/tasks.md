# Tasks: Ride Difficulty & Wind Resistance Rating

**Feature**: `019-ride-difficulty-wind`  
**Branch**: `019-ride-difficulty-wind`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Generated**: 2026-04-24  
**Design inputs**: spec.md (27 FRs, 3 user stories), plan.md, research.md, data-model.md, contracts/rides-api.md, contracts/dashboard-api.md, contracts/csv-import-format.md, quickstart.md

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Parallelisable — touches different files, no blocking in-flight dependency
- **[US1/US2/US3]**: User Story label (maps to spec.md priorities P1/P1/P2)
- Tests follow **red → green** TDD gate: write failing test, confirm failure, implement, confirm green

---

## Phase 1: Setup

**Purpose**: Confirm baseline is clean before any changes land. One pre-flight task; all remaining phases build on it.

- [x] T001 Verify feature branch `019-ride-difficulty-wind` is checked out, `dotnet build` compiles the full solution with zero warnings, `dotnet test` passes all existing tests, and `npm install` is current in `src/BikeTracking.Frontend/`

---

## Phase 2: Foundational — F# Domain Module + Database Migration

**Purpose**: The wind resistance formula and the three new DB columns are blocking prerequisites for every user story. No service, import, or dashboard work can proceed until both are in place.

**⚠️ CRITICAL**: No user story phase may begin until this phase is complete.

### F# Domain Module — TDD Cycle

> **RED first**: Write the tests so they compile but fail before the module exists.

- [x] T002 [P] Write failing unit tests (RED) covering all WindResistance functions — `degreesToCompass` boundary cases (0°, 22°, 23°, 45°, 337°, 360°), `calculateResistance` (20 mph headwind → +4; 20 mph tailwind → −4; crosswind → 0; clamp at ±4; negative speed → `Error`), `calculateDifficulty` (null/zero wind → `(0, 1)`; full headwind → `(4, 5)`; full tailwind → `(−4, 1)`), and `resistanceToDifficulty` for all nine inputs −4 to +4 — in `src/BikeTracking.Api.Tests/Application/Rides/WindResistanceCalculationTests.cs`
- [x] T003 Create `src/BikeTracking.Domain.FSharp/WindResistance.fs` with module `BikeTracking.Domain.FSharp.WindResistance` — types `CompassDirection` (8 values) and `WindResistanceError`; pure functions `degreesToCompass`, `compassToDegrees`, `shorterArc`, `calculateResistance`, `resistanceToDifficulty`, `calculateDifficulty`, `tryParseCompassDirection`, and `validDirectionNames` exactly as specified in `data-model.md §2.1`
- [x] T004 Add `<Compile Include="WindResistance.fs" />` to `src/BikeTracking.Domain.FSharp/BikeTracking.Domain.FSharp.fsproj` in the `<ItemGroup>` immediately before `AdvancedDashboardCalculations.fs` per `data-model.md §2.2`
- [x] T005 Verify `WindResistanceCalculationTests` are GREEN — run `dotnet test --filter "WindResistanceCalculation"` and confirm all boundary cases pass including the 20 mph direct headwind → +4 spec target and the zero-speed FR-012 rule

### Database Migration — TDD Cycle

> **RED first**: Write persistence tests against the new columns before the migration exists.

- [x] T006 [P] Add three nullable properties to `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs`: `public int? Difficulty { get; set; }`, `public string? PrimaryTravelDirection { get; set; }`, `public int? WindResistanceRating { get; set; }` per `data-model.md §1.1`
- [x] T007 [P] Add EF Core model configuration to `OnModelCreating` in `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`: `HasMaxLength(5)` for `PrimaryTravelDirection`; `HasCheckConstraint("CK_Rides_Difficulty", "Difficulty IS NULL OR (Difficulty >= 1 AND Difficulty <= 5)")` and `HasCheckConstraint("CK_Rides_WindResistanceRating", "WindResistanceRating IS NULL OR (WindResistanceRating >= -4 AND WindResistanceRating <= 4)")` on the Rides entity per `data-model.md §1.1`
- [x] T008 [P] Write failing persistence tests (RED) for the three new columns — save a `RideEntity` with each field set; read it back; assert round-trip fidelity; assert `PrimaryTravelDirection` max-length enforcement — in `src/BikeTracking.Api.Tests/Infrastructure/RidesPersistenceTests.cs`
- [x] T009 Generate EF Core migration via `dotnet ef migrations add AddRideDifficultyAndWindRating --project src/BikeTracking.Api --output-dir Infrastructure/Persistence/Migrations` from the repository root; verify the generated `.cs` file contains three `AddColumn` calls for `Difficulty`, `PrimaryTravelDirection`, and `WindResistanceRating` per `data-model.md §1.2`
- [x] T010 Inspect the migration SQL for CHECK constraint compatibility; if the SQLite EF provider generates unsupported syntax (compare with existing entries), add the new migration ID to `UnsupportedConstraintMigrations` in `src/BikeTracking.Api/Infrastructure/Persistence/SqliteMigrationBootstrapper.cs`
- [x] T011 Verify `RidesPersistenceTests` are GREEN — run `dotnet test --filter "RidesPersistence"` after the migration is applied; confirm all three columns persist and round-trip correctly

**Checkpoint — Foundation ready**: WindResistance.fs module tested and green; three new DB columns migrated and tested. User story phases may now begin.

---

## Phase 3: User Story 1 — Record Ride Difficulty Fields (Priority: P1) 🎯 MVP

**Goal**: Riders can record a ride with an optional Difficulty (1–5) and Primary Travel Direction (8-point compass). When direction and wind data are both present, the Difficulty field auto-fills with a suggestion. The suggestion is overridable. The server persists `WindResistanceRating` computed via the F# formula. Edit Ride recomputes `WindResistanceRating` on direction change and pre-fills Difficulty as a suggestion only (FR-027).

**Independent Test**: Check out the feature branch, start the app, record a ride in a location with wind data — select a travel direction and verify Difficulty auto-fills within 1 second, change the direction and verify it recalculates, override the value, save, and confirm the ride appears in history with the manually entered Difficulty and a non-null `WindResistanceRating`. Then edit the same ride, change direction, and confirm `WindResistanceRating` updates on save.

### Tests for User Story 1 ⚠️ Write RED first — all must fail before implementation

- [x] T012 [P] [US1] Write failing integration tests (RED) for RecordRide with difficulty fields — record with direction + wind data → `WindResistanceRating` computed and persisted; record without direction → `WindResistanceRating` null; record with zero wind speed → `WindResistanceRating = 0`; invalid `Difficulty` value (6) → 400; invalid direction string → 400 with accepted-values message — in `src/BikeTracking.Api.Tests/Endpoints/Rides/RecordRideWithDifficultyTests.cs`
- [x] T013 [P] [US1] Write failing integration tests (RED) for EditRide with direction-change behaviour — direction unchanged → `WindResistanceRating` unchanged; direction changed → `WindResistanceRating` recomputed and stored; direction cleared (null) → `WindResistanceRating` set to null; `Difficulty` in request stored as-is with no server-side override (FR-027) — in `src/BikeTracking.Api.Tests/Application/Rides/EditRideWithDifficultyTests.cs`

### Implementation for User Story 1 — Contracts & Events

- [x] T014 [P] [US1] Extend `src/BikeTracking.Api/Contracts/RidesContracts.cs` — add `[Range(1,5)] int? Difficulty = null` and `[MaxLength(5)] string? PrimaryTravelDirection = null` to `RecordRideRequest` and `EditRideRequest`; add `int? Difficulty`, `string? PrimaryTravelDirection`, `int? WindResistanceRating` to `RideHistoryRow` per `contracts/rides-api.md §1, §3, §4`
- [x] T015 [P] [US1] Extend `src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs` and `src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs` — add `int? Difficulty`, `string? PrimaryTravelDirection`, `int? WindResistanceRating` fields and update the `Create` factory methods per `contracts/rides-api.md §7`

### Implementation for User Story 1 — Service Layer

- [x] T016 [US1] Extend `src/BikeTracking.Api/Application/Rides/RecordRideService.cs` — after weather merge, call `WindResistance.tryParseCompassDirection` on `request.PrimaryTravelDirection`; if valid and `WindSpeedMph` + `WindDirectionDeg` are present, call `WindResistance.calculateDifficulty` via F# interop and persist the rating; assign `Difficulty`, `PrimaryTravelDirection`, and computed `WindResistanceRating` to the new `RideEntity` columns; propagate all three to `RideRecordedEventPayload` per `quickstart.md Step 3`
- [x] T017 [US1] Extend `src/BikeTracking.Api/Application/Rides/EditRideService.cs` — compare incoming `PrimaryTravelDirection` against the stored value; if changed, recompute `WindResistanceRating` using current `WindSpeedMph` and `WindDirectionDeg`; if direction cleared, set `WindResistanceRating = null`; always store `request.Difficulty` as the rider's final choice without server-side override; propagate all three fields in `RideEditedEventPayload` per `quickstart.md Step 4` and FR-026/FR-027

### Verify User Story 1 Backend — GREEN

- [x] T018 [P] [US1] Verify `RecordRideWithDifficultyTests` are GREEN — run `dotnet test --filter "RecordRideWithDifficulty"` and confirm all scenarios pass
- [x] T019 [P] [US1] Verify `EditRideWithDifficultyTests` are GREEN — run `dotnet test --filter "EditRideWithDifficulty"` and confirm direction-change, direction-clear, and difficulty-as-rider-choice scenarios all pass

### Implementation for User Story 1 — Frontend

- [x] T020 [P] [US1] Create `src/BikeTracking.Frontend/src/utils/windResistance.ts` — implement `calculateWindResistance`, `resistanceToDifficulty`, and `suggestDifficulty` as the TypeScript formula mirror; export `COMPASS_DEGREES` lookup; match the F# logic exactly (shorter-arc, cosine, ÷5, clamp ±4, FR-012 zero-speed rule) per `data-model.md §6.2`
- [x] T021 [P] [US1] Extend `src/BikeTracking.Frontend/src/services/ridesService.ts` — add `CompassDirection` string literal union type, `COMPASS_DIRECTIONS` constant array, and optional `difficulty?: number`, `primaryTravelDirection?: CompassDirection`, `windResistanceRating?: number` fields to `RecordRideRequest`, `EditRideRequest`, and `RideHistoryRow` interfaces per `data-model.md §6.1`
- [x] T022 [US1] Update `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx` — add `primaryTravelDirection` and `difficulty` state variables; add `isDifficultyAutoFilled` boolean state; add `useEffect` that calls `suggestDifficulty` whenever direction or wind data changes and sets the difficulty field + `isDifficultyAutoFilled = true`; add `<select>` for PrimaryTravelDirection (8 compass options, empty default) with info icon and tooltip ("Your primary direction of travel helps us calculate wind resistance…" — FR-003); add `<select>` for Difficulty (options 1 Very Easy … 5 Very Hard, empty default) showing "(suggested)" label when `isDifficultyAutoFilled`; clear auto-filled difficulty when direction is cleared; set `isDifficultyAutoFilled = false` on manual Difficulty change; include both fields in submit payload; add CSS classes to `RecordRidePage.css` (no inline styles) per `quickstart.md Step 7`
- [x] T023 [US1] Update the Edit Ride form — add direction and difficulty `<select>` fields pre-populated from the stored `RideHistoryRow` values; on direction change, call `suggestDifficulty` and update the Difficulty field as a suggestion only (FR-027); include `difficulty` and `primaryTravelDirection` in the `EditRideRequest` payload per `quickstart.md Step 8`
- [x] T024 [P] [US1] Update `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx` — add `Difficulty`, `Primary Direction`, and `Wind Resistance` columns to the ride history table; render `WindResistanceRating` as a signed badge (e.g. "+3" / "−2") when present

**Checkpoint — User Story 1 complete**: Record ride and edit ride both support direction + difficulty fields. WindResistanceRating is computed and persisted by the server. Auto-suggest fires client-side within 1 second (SC-002). History shows all three new columns. Test independently before proceeding.

---

## Phase 4: User Story 2 — CSV Import with Difficulty & Direction (Priority: P1)

**Goal**: Riders can import historical rides with optional `Difficulty` and `Direction` CSV columns. Invalid values are rejected per-row with specific error codes. A sample CSV download is available at `GET /api/rides/csv-sample` showing all supported columns with a legend.

**Independent Test**: Download the sample CSV from the import page, add rows with valid and invalid `Difficulty`/`Direction` values, import, and verify: valid rows create rides with the correct field values; rows with `Difficulty=6` are rejected with `INVALID_DIFFICULTY`; rows with `Direction=Northeast` are rejected with `INVALID_DIRECTION` listing the eight accepted values; rows with absent columns import without error; the downloaded sample contains the legend header and all seven columns.

### Tests for User Story 2 ⚠️ Write RED first — all must fail before implementation

- [x] T025 [P] [US2] Write failing unit tests (RED) for CSV import validation — valid `Difficulty` 1–5 passes; `Difficulty` 0, 6, "hard" → `INVALID_DIFFICULTY` error with range message; all 8 valid direction strings (case-insensitive, e.g. "north", "NE", "SW") pass; "Northeast", "E/W", empty-direction → `INVALID_DIRECTION` error listing accepted values; row with both columns absent → no error; row with only `Difficulty` present → valid — in `src/BikeTracking.Api.Tests/Application/Imports/CsvImportDifficultyTests.cs`
- [x] T026 [P] [US2] Write failing endpoint tests (RED) for the sample CSV download — `GET /api/rides/csv-sample` returns `200`; `Content-Disposition: attachment; filename="ride-import-sample.csv"`; `Content-Type: text/csv`; body contains `Difficulty` and `Direction` column headers; body contains at least one example data row; body contains legend `#` comment lines — in `src/BikeTracking.Api.Tests/Endpoints/Rides/SampleCsvDownloadTests.cs`

### Implementation for User Story 2

- [x] T027 [US2] Extend `src/BikeTracking.Api/Application/Imports/CsvParser.cs` — add `string? Difficulty` and `string? PrimaryTravelDirection` to the `ParsedCsvRow` record; add case-insensitive header detection mapping `"difficulty"` → `Difficulty`, `"direction"` → `PrimaryTravelDirection` and `"primarytraveldirection"` → `PrimaryTravelDirection` per `contracts/csv-import-format.md §3`
- [x] T028 [US2] Add `INVALID_DIFFICULTY` and `INVALID_DIRECTION` validation rules to `CsvValidationRules.ValidateRow` in `src/BikeTracking.Api/Application/Imports/CsvValidationRules.cs` — `INVALID_DIFFICULTY`: optional; if present must parse as int in [1,5]; use `WindResistance.validDirectionNames` for `INVALID_DIRECTION` list; case-insensitive match accepted per `contracts/csv-import-format.md §2`
- [x] T029 [US2] Update the import row → entity mapping in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs` — parse `Difficulty` as `int?`; canonicalise `Direction` via `WindResistance.tryParseCompassDirection` to get canonical casing; if direction and wind data are present, call `WindResistance.calculateResistance` to compute `WindResistanceRating`; assign all three fields to the `RideEntity` per `contracts/csv-import-format.md §4`
- [x] T030 [US2] Create `src/BikeTracking.Api/Application/Imports/SampleCsvGenerator.cs` — static class with `Generate()` method returning an in-memory CSV string with legend comment lines (all 7 columns explained with valid values) followed by the `Date,Miles,Time,Temp,Notes,Difficulty,PrimaryTravelDirection` header row and 5 realistic example rows per `contracts/csv-import-format.md §5`. The generator should favour the canonical `PrimaryTravelDirection` header but note that import accepts `Direction` as an alias.
- [x] T031 [US2] Register `GET /api/rides/csv-sample` endpoint in `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs` — call `SampleCsvGenerator.Generate()`, return `Results.Text(csv, "text/csv")` with `Content-Disposition: attachment; filename="ride-import-sample.csv"` header; require authorisation per `contracts/rides-api.md §5`

### Verify User Story 2 — GREEN

- [x] T032 [P] [US2] Verify `CsvImportDifficultyTests` are GREEN — run `dotnet test --filter "CsvImportDifficulty"` and confirm all valid/invalid/absent-column scenarios pass
- [x] T033 [P] [US2] Verify `SampleCsvDownloadTests` are GREEN — run `dotnet test --filter "SampleCsvDownload"` and confirm headers, content-type, and body shape are correct

**Checkpoint — User Story 2 complete**: CSV import accepts `Difficulty` and `Direction` columns; invalid rows are rejected with specific error codes; sample CSV is downloadable. Test independently before proceeding.

---

## Phase 5: User Story 3 — Advanced Dashboard Difficulty Analytics (Priority: P2)

**Goal**: The Advanced Dashboard shows a Difficulty section with: overall average difficulty (1 decimal), average difficulty by calendar month (all years combined, max 12 groups), a ranked "Most Difficult Months" list, and a Wind Resistance Rating distribution chart (bars −4 to +4 with tailwind/headwind colour distinction). Uses the FR-022 derivation chain (stored difficulty → stored rating → raw recompute). Renders a descriptive empty state when no qualifying data exists (FR-025).

**Independent Test**: Seed several rides with known `Difficulty` values and `WindResistanceRating` values across different calendar months. Navigate to the Advanced Dashboard. Confirm the overall average matches an independent calculation, monthly averages group correctly across years, `MostDifficultMonths` is sorted descending, and the wind resistance chart shows the correct bin counts with negative bars visually distinct. Then test with rides that have no difficulty data and confirm the empty state message appears.

### Tests for User Story 3 ⚠️ Write RED first — all must fail before implementation

- [x] T034 [P] [US3] Write failing unit tests (RED) for difficulty analytics calculation functions — overall average of rides with stored difficulty (1 decimal place); monthly grouping aggregates all Januaries across years together; `MostDifficultMonths` is sorted descending by average; FR-022 derivation chain resolves stored difficulty first, then stored `WindResistanceRating` mapped through `resistanceToDifficulty`, then raw recompute, then excludes ride; empty state when no qualifying data returns `None` for overall average and empty lists; wind resistance distribution returns all 9 bins (−4 to +4) including zero-count bins — in `src/BikeTracking.Api.Tests/Application/Dashboard/DifficultyAnalyticsTests.cs`

### Implementation for User Story 3 — F# Calculation Layer

- [x] T035 [P] [US3] Add `RideDifficultySnapshot` type and the four calculation functions — `resolveDifficulty`, `calculateDifficultyByMonth`, `calculateOverallAverageDifficulty`, `calculateWindResistanceDistribution` — to `src/BikeTracking.Domain.FSharp/AdvancedDashboardCalculations.fs`; `resolveDifficulty` must implement the full FR-022 chain; `calculateDifficultyByMonth` groups by `RideDate.Month` (1–12) across all years; `calculateWindResistanceDistribution` returns all 9 bins including zero-count entries per `data-model.md §3.1` and `§3.2`

### Implementation for User Story 3 — API Contracts & Service

- [x] T036 [P] [US3] Add `AdvancedDashboardDifficultySection`, `DifficultyByMonth`, and `WindResistanceBin` record types to `src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs`; extend `AdvancedDashboardResponse` with `AdvancedDashboardDifficultySection? DifficultySection = null` per `contracts/dashboard-api.md §1` and `§2`
- [x] T037 [US3] Extend `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs` — project ride entities to `RideDifficultySnapshot` list; call `calculateOverallAverageDifficulty`, `calculateDifficultyByMonth`, and `calculateWindResistanceDistribution`; build `MostDifficultMonths` by sorting `DifficultyByMonth` descending; build `WindResistanceBin` list with `Label` and `IsAssisted` per `contracts/dashboard-api.md §2`; set `IsEmpty = true` and return empty lists when no qualifying rides exist per FR-025 per `quickstart.md Step 6`

### Verify User Story 3 Backend — GREEN

- [x] T038 [US3] Verify `DifficultyAnalyticsTests` are GREEN — run `dotnet test --filter "DifficultyAnalytics"` and confirm all scenarios including derivation chain, monthly grouping, ranked sort, empty state, and distribution counts pass

### Implementation for User Story 3 — Frontend

- [x] T039 [P] [US3] Extend `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts` — add `DifficultyByMonth`, `WindResistanceBin`, and `AdvancedDashboardDifficultySection` TypeScript interfaces; extend `AdvancedDashboardResponse` with `difficultySection: AdvancedDashboardDifficultySection | null` per `contracts/dashboard-api.md §4`
- [x] [US3] Create `src/BikeTracking.Frontend/src/pages/advanced-dashboard/DifficultyAnalyticsSection.tsx` — renders empty state `<p>Record rides with travel direction to see difficulty trends.</p>` when `section.isEmpty`; otherwise renders: overall average difficulty display; a `Recharts BarChart` with month names on X-axis and `averageDifficulty` on Y-axis for monthly breakdown; a ranked `<ol>` of `mostDifficultMonths` sorted descending; a `Recharts BarChart` of wind resistance bins −4 to +4 with `fill` CSS class `bar--assisted` for `isAssisted: true` bins and `bar--headwind` for `isAssisted: false` bins (FR-024); all colours via CSS custom properties matching the existing `advanced-dashboard-page.css` chart pattern per `quickstart.md Step 9`
- [x] [US3] Extend `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.tsx` — conditionally render `<DifficultyAnalyticsSection section={data.difficultySection} />` when `data.difficultySection` is not `null`; import and integrate the component per `quickstart.md Step 9`

**Checkpoint — User Story 3 complete**: Advanced Dashboard shows difficulty analytics section with all four sub-components. Empty state renders correctly. Wind resistance chart visually distinguishes assisted (negative) from headwind (positive) bars. Test independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification pass, build hygiene, and end-to-end smoke test confirming all three user stories integrate cleanly.

- [x] [P] Run `dotnet build` from the repository root — confirm the full solution compiles with zero warnings (C# warnings-as-errors and F# warnings must all be clean)
- [x] [P] Run `dotnet test` from the repository root — confirm all pre-existing tests continue to pass and the new test count is ≥ 40 additional tests across `WindResistanceCalculationTests`, `RidesPersistenceTests`, `RecordRideWithDifficultyTests`, `EditRideWithDifficultyTests`, `CsvImportDifficultyTests`, `SampleCsvDownloadTests`, and `DifficultyAnalyticsTests`
- [x] [P] Run `npm run build` in `src/BikeTracking.Frontend/` — confirm TypeScript strict-mode compilation succeeds with zero errors and zero `any`-type violations
- [ ] T045 Execute the `quickstart.md` verification checklist end-to-end: start `dotnet run --project src/BikeTracking.AppHost`; record a ride with direction + wind and confirm difficulty auto-fills within 1 second (SC-002); save and inspect the DB to confirm `WindResistanceRating` is persisted; edit the ride, change direction, and confirm `WindResistanceRating` updates; import a CSV with `Difficulty` and `Direction` columns and confirm rows import correctly; attempt to import `Difficulty=6` and confirm `INVALID_DIFFICULTY` rejection; download `GET /api/rides/csv-sample` and confirm the file opens in a spreadsheet application; navigate to Advanced Dashboard and confirm difficulty section renders with correct averages and the wind resistance chart distinguishes tailwind/headwind bars

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1) + Phase 4 (US2)**: Both P1; both depend on Phase 2 only; may proceed in parallel if staffed
- **Phase 5 (US3)**: P2; depends on Phase 2; benefits from US1 data existing but is independently testable against seeded data
- **Phase 6 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start immediately after Phase 2. No dependency on US2 or US3.
- **User Story 2 (P1)**: Can start immediately after Phase 2. No dependency on US1 or US3. (CSV import is an independent data-entry path.)
- **User Story 3 (P2)**: Can start after Phase 2. Depends on US1/US2 data for end-to-end validation but the analytics logic is independently testable with seeded data.

### Within Each Phase

1. TDD RED gate — write failing tests before implementation (non-negotiable)
2. F# types and domain functions before C# service layer
3. DB migration before service layer
4. Contracts before services
5. Service layer before endpoint wiring
6. Backend GREEN gate — confirm tests pass before frontend
7. Frontend TypeScript types before components

### Parallel Opportunities by Phase

**Phase 2**:
- T002 (write WindResistance tests) and T006+T007 (extend RideEntity + DbContext) and T008 (write persistence tests) can all start simultaneously — different files
- T003+T004 (create WindResistance.fs + register in .fsproj) can proceed while persistence tests are being written
- T009 (generate migration) must wait for T006+T007

**Phase 3 (US1)**:
- T012 + T013 (write integration tests) can start in parallel
- T014 + T015 (contracts + event payloads) can proceed in parallel while tests are being written
- T020 + T021 (TypeScript utility + ridesService types) can proceed in parallel with all backend work
- T022 + T023 + T024 (frontend form + edit form + history page) can proceed in parallel after T020+T021 are done

**Phase 4 (US2)**:
- T025 + T026 (write import tests + sample CSV tests) can start in parallel
- T027 + T028 (CsvParser + CsvValidationRules) are different files — can proceed in parallel
- T030 + T031 (SampleCsvGenerator + endpoint registration) are different files — can proceed in parallel

**Phase 5 (US3)**:
- T034 (write analytics tests) + T035 (F# calc functions) + T036 (contracts) can all start simultaneously — different files
- T039 + T040 + T041 (frontend types + section component + page integration) can proceed in parallel with backend after F# layer is done

---

## Parallel Execution Examples

### Phase 2 Parallel Kickoff

```
Simultaneously start:
  Task T002 — Write WindResistanceCalculationTests.cs (RED)
  Task T006 — Extend RideEntity.cs
  Task T007 — Update BikeTrackingDbContext.cs
Then:
  Task T003 — Create WindResistance.fs
  Task T004 — Register in .fsproj
  Task T008 — Write RidesPersistenceTests.cs (RED)
Then:
  Task T005 — Verify WindResistance tests GREEN
  Task T009 — Generate migration
  Task T010 — SqliteMigrationBootstrapper check
Then:
  Task T011 — Verify persistence tests GREEN
```

### Phase 3 (US1) Parallel Kickoff

```
Simultaneously start:
  Task T012 — Write RecordRideWithDifficultyTests.cs (RED)
  Task T013 — Write EditRideWithDifficultyTests.cs (RED)
  Task T014 — Update RidesContracts.cs (requests + history row)
  Task T015 — Extend event payloads
  Task T020 — Create windResistance.ts
  Task T021 — Extend ridesService.ts types
Then:
  Task T016 — Extend RecordRideService.cs
  Task T017 — Extend EditRideService.cs
  Task T022 — Update RecordRidePage.tsx
  Task T023 — Update Edit Ride form
  Task T024 — Update HistoryPage.tsx
Then:
  Task T018 — Verify RecordRide tests GREEN
  Task T019 — Verify EditRide tests GREEN
```

### Phase 4 (US2) Parallel Kickoff

```
Simultaneously start:
  Task T025 — Write CsvImportDifficultyTests.cs (RED)
  Task T026 — Write SampleCsvDownloadTests.cs (RED)
  Task T027 — Extend CsvParser.cs
  Task T028 — Extend CsvValidationRules.cs
Then:
  Task T029 — Update ImportJobProcessor.cs
  Task T030 — Create SampleCsvGenerator.cs
  Task T031 — Register csv-sample endpoint
Then:
  Task T032 — Verify CsvImportDifficulty tests GREEN
  Task T033 — Verify SampleCsvDownload tests GREEN
```

### Phase 5 (US3) Parallel Kickoff

```
Simultaneously start:
  Task T034 — Write DifficultyAnalyticsTests.cs (RED)
  Task T035 — Add F# calculation functions to AdvancedDashboardCalculations.fs
  Task T036 — Add contracts to AdvancedDashboardContracts.cs
  Task T039 — Extend advanced-dashboard-api.ts
Then:
  Task T037 — Extend GetAdvancedDashboardService.cs
  Task T040 — Create DifficultyAnalyticsSection.tsx
Then:
  Task T038 — Verify DifficultyAnalytics tests GREEN
  Task T041 — Extend advanced-dashboard-page.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (F# module + DB migration — **BLOCKS everything**)
3. Complete Phase 3: User Story 1 (Record + Edit Ride with direction/difficulty)
4. **STOP and VALIDATE**: Record a real ride, select a direction, confirm auto-suggest, save, inspect DB
5. Deploy/demo if ready — this is the minimum viable feature; all data collection begins here

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready (2 test suites green)
2. Phase 3 (US1) → ride recording enhanced → **deploy MVP** (data collection starts)
3. Phase 4 (US2) → bulk historical import enabled → deploy (data backfill unlocked)
4. Phase 5 (US3) → analytics visible → deploy (analytics payoff)
5. Phase 6 → end-to-end verified → merge PR

### Parallel Team Strategy (2 developers after Phase 2)

- **Developer A**: Phase 3 (US1) — record/edit ride service + frontend form + history page
- **Developer B**: Phase 4 (US2) — CSV parser + validation + sample download endpoint

Both complete independently; Phase 5 (US3) starts once either developer is free or as a third stream.

---

## Notes

- All `[P]` tasks touch different files with no write-write conflict; safe to execute in parallel
- `[US1]`, `[US2]`, `[US3]` labels map directly to the user stories in `spec.md`
- **TDD is non-negotiable**: each RED checkpoint must produce failing tests before the corresponding implementation task begins; commit the RED baseline before implementing
- `WindResistanceRating` is system-computed — it is never in a request body; it is always set server-side in `RecordRideService` and `EditRideService` (and `ImportJobProcessor`)
- The TypeScript formula in `windResistance.ts` is a display-only suggestion mirror; the F# `WindResistance.fs` is authoritative at write time — both must produce identical results for the same inputs
- `PrimaryTravelDirection` is stored as canonical casing (`"North"`, `"NE"`, etc.) — normalise on write in both API and CSV import paths using `WindResistance.tryParseCompassDirection`
- `MostDifficultMonths` is the same data as `DifficultyByMonth` sorted descending — no separate DB query needed
- Calendar-month aggregation uses month number 1–12 regardless of year (all Januaries together) per spec clarification 2026-04-24
- Months with zero qualifying rides are **excluded** from averages and the ranked list; the wind resistance distribution always returns all 9 bins including zero-count bins
- Stop at each **Checkpoint** to validate the user story independently before proceeding to the next phase
