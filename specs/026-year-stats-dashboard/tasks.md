# Tasks: Year Stats Dashboard

**Feature Branch**: `026-year-stats-dashboard`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md) | **Contracts**: [contracts/year-stats-dashboard-api.md](contracts/year-stats-dashboard-api.md) | **Research**: [research.md](research.md) | **Quickstart**: [quickstart.md](quickstart.md)
**Generated**: 2026-07-02

---

## Format

```
- [ ] [ID] [P?] [USn?] Description with exact file path
```

- **[P]** — parallelizable (independent file, no blocking dependency on incomplete tasks)
- **[USn]** — maps to a User Story from spec.md (US1–US3)
- TDD enforced per constitution directive 3: all tests in each phase are written and confirmed **failing** before the corresponding implementation task begins

---

## User Stories

| Story | Title | Priority |
|-------|-------|----------|
| US1 | View stats for a chosen year (year-scoped charts) | P1 🎯 MVP |
| US2 | Reuse existing chart components across pages (year-parameterized components) | P2 |
| US3 | Navigate to the year stats dashboard | P3 |

---

## Phase 1: Setup

**Purpose**: Declare new contracts and register route/page stubs so later phases compile against real types. No behavior change to `/api/dashboard` or `/api/dashboard/advanced`.

- [X] T001 [P] Add `YearStatsDashboardResponse`, `YearStatsMileagePoint`, `YearStatsSavingsPoint`, `YearStatsDifficultySection`, `YearStatsDifficultyByMonthPoint`, `YearStatsWindResistanceSection`, `YearStatsWindResistanceBin`, and `AvailableYearsResponse` records to `src/BikeTracking.Api/Contracts/DashboardContracts.cs` — field names/shapes exactly per `data-model.md` (mirrors `DashboardMileagePoint`/`DashboardSavingsPoint` naming)
- [X] T002 [P] Create empty `year-stats-dashboard` page directory scaffolding: `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.tsx` (stub component rendering `<main>Year Stats Dashboard</main>`) and `year-stats-dashboard-page.css` (empty)
- [X] T003 Register stub route `<Route path="/dashboard/year-stats" element={<YearStatsDashboardPage />} />` inside the existing `<ProtectedRoute />` block in `src/BikeTracking.Frontend/src/App.tsx`, importing the stub from T002

**Checkpoint ✅**: `dotnet build BikeTracking.slnx` and `cd src/BikeTracking.Frontend && npm run build` both succeed. No existing endpoint/service/component behavior changed.

---

## Phase 2: Tests (TDD Red Phase)

**Purpose**: Write all tests first per constitution directive 3 ("TDD is mandatory: failing-test proof must be shown before implementation starts"). Confirm every test below **fails**, then proceed to Phase 3.

> ⚠️ **STOP AFTER THIS PHASE. Run `dotnet test BikeTracking.slnx` and `npm run test:unit`. All tests below MUST fail (red) because `GetYearStatsDashboardService`, the endpoints, and the frontend components/page do not exist yet. Do not proceed to Phase 3 until the red checkpoint is confirmed.**

### Backend Service Tests — US1

- [X] T004 [P] [US1] Write `GetYearStatsDashboardService_TypeExists`/`ExposesAsyncReadMethod` smoke tests plus `GetAsync` behavior tests in `src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs` — covers: year with a full 12 months of rides produces correct per-month `MileageByMonth`/`SavingsByMonth` (Jan–Dec of the *requested* year, not a rolling window); in-progress current year with partial data returns zero-filled `Miles`/null savings for elapsed-but-empty and future months (not fabricated); year with zero rides returns `HasDataForYear == false` with all 12 months zero/null-filled and no exception
- [X] T005 [P] [US1] Write savings-snapshot-accuracy regression test in `src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs` — seed a rider with a ride in a past year using an old `SnapshotMileageRateCents`/`SnapshotAverageCarMpg`, then change current `UserSettings`; assert `GetAsync` for that past year still returns savings computed from the ride's own snapshot fields, not current settings (regression-proves FR-006, mirrors `GetDashboardService_UsesRideSnapshotsForSavings_WhenCurrentSettingsChanged`)
- [X] T006 [P] [US1] Write difficulty/wind-resistance year-filtering tests in `src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs` — seed rides with difficulty/wind data across two different years; assert `Difficulty.ByMonth`/`Difficulty.OverallAverageDifficulty`/`WindResistance.Bins` for a requested year reflect only that year's rides; assert a rider with rides that year but none carrying difficulty/wind data yields `Difficulty.HasData == false` and `WindResistance.HasData == false` while `HasDataForYear == true` (partial empty-state per data-model.md)
- [X] T007 [P] [US1] Write `GetAvailableYearsAsync` tests in `src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs` — covers: rider with rides in 2023/2024/2025 returns `[2025, 2024, 2023]` descending, no duplicates; rider with zero rides returns `[currentYear]` (fallback default, FR-002/FR-008)

### Backend Endpoint Tests — US1

- [X] T008 [P] [US1] Write `DashboardEndpointsTests` additions in `src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs` — `GET /api/dashboard/year-stats?year={yyyy}` returns `200` with `YearStatsDashboardResponse` for an authenticated rider; returns `400` for `year=1901` and for `year={currentYear + 2}` (out of `1900 <= year <= currentYear + 1` bound); returns `400` for non-numeric `year`; returns `401` when unauthenticated (missing/invalid `sub` claim)
- [X] T009 [P] [US1] Write `GET /api/dashboard/year-stats/years` endpoint tests in `src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs` — returns `200` with descending distinct years for a seeded rider; returns `[currentYear]` for a rider with no rides; returns `401` when unauthenticated

### Frontend API Client Tests — US1

- [X] T010 [P] [US1] Write `dashboard-api.test.ts` additions (or new co-located test) in `src/BikeTracking.Frontend/src/services/dashboard-api.test.ts` — `getYearStatsDashboard(year)` calls `GET /api/dashboard/year-stats?year={year}` and returns typed `YearStatsDashboardResponse`; throws on non-OK response; `getAvailableYears()` calls `GET /api/dashboard/year-stats/years` and returns typed `AvailableYearsResponse`

### Frontend Component Tests — US1 + US2

- [X] T011 [P] [US2] Write `year-selector.test.tsx` co-located at `src/BikeTracking.Frontend/src/components/dashboard/year-selector.test.tsx` — covers: renders one option per entry in `years` prop; renders `selectedYear` as the selected option; calls `onChange` with the numeric year when a new option is chosen; renders correctly with a single-year list (disabled-looking but still functional, per spec edge case "rides in only one year")
- [X] T012 [P] [US2] Extend `dashboard-chart-section` tests co-located at `src/BikeTracking.Frontend/src/components/dashboard/dashboard-chart-section.test.tsx` (create if it does not exist) — covers: default render (no `year`/`seriesLabel` props) shows "Rolling 12 months" copy exactly as before (regression proof for FR-005/SC-003, asserted against the existing rendered output of `dashboard-page.test.tsx`); passing a `year`/`seriesLabel` prop renders that label (e.g. "Calendar year 2025") instead of "Rolling 12 months"; chart data (`mileageByMonth`/`savingsByMonth`) renders identically regardless of which label prop is used
- [X] T013 [P] [US1] Write `year-stats-dashboard-page.test.tsx` in `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.test.tsx` — covers: on mount, fetches available years then fetches year-stats for the default year (current year, or most recent year with data when current year has none, per FR-008); renders `YearSelector`, year-scoped `DashboardChartSection`, and `DifficultyAnalyticsSection`; changing the year selector re-fetches and re-renders charts in place without a route change (FR-009); selecting/loading a year with `hasDataForYear: false` renders an explicit "no data for this year" empty state instead of blank/errored charts (FR-007)
- [X] T014 [P] [US1] Confirm existing `dashboard-page.test.tsx` in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx` still asserts the main dashboard's rolling-12-month charts render unchanged; add an explicit assertion (if missing) that `DashboardChartSection` is invoked without `year`/`seriesLabel` props on the main dashboard page (regression proof for SC-003)

### E2E Scaffold — Gate

- [X] T015 [US1] [US2] [US3] Write E2E test scaffold (5 failing scenarios) in `src/BikeTracking.Frontend/tests/e2e/year-stats-dashboard.spec.ts`:
  1. Navigate via header nav link "Year Stats" → lands on `/dashboard/year-stats` with a year already selected and charts rendered (US3, FR-001)
  2. Default year is the current year, or the most recent year with data if the current year is empty (FR-008)
  3. Switching the year selector updates mileage, savings, and difficulty/wind charts in place, without a page navigation/reload (FR-009, US1)
  4. Selecting a year with no ride data shows an explicit "no data for this year" state per chart, not an error or blank chart (FR-007, edge case)
  5. Main dashboard (`/dashboard`) still renders its existing rolling 12-month charts unchanged after the refactor — regression check for FR-005/SC-003 (US2)

**Checkpoint 🔴**: `dotnet test BikeTracking.slnx` and `npm run test:unit` — all T004–T014 confirmed **FAILING**. `npm run test:e2e` confirms T015's 5 scenarios fail against the current app. Red checkpoint committed before Phase 3 begins.

---

## Phase 3: Core (Backend — Make Phase 2 Backend Tests Green)

**Purpose**: Implement the year-scoped application service and endpoints. No F# domain changes (per research.md Decision 3 — `AdvancedDashboardCalculations.fs`/`WindResistance.fs` reused unchanged).

- [X] T016 [US1] Implement `GetYearStatsDashboardService.cs` in `src/BikeTracking.Api/Application/Dashboard/GetYearStatsDashboardService.cs` — `GetAsync(riderId, year, cancellationToken)`: loads rides for `riderId` (`dbContext.Rides.Where(...).AsNoTracking()`, same pattern as `GetDashboardService`/`GetAdvancedDashboardService`), filters to `RideDateTimeLocal.Year == year`, enumerates a fixed `new DateTime(year, 1, 1)`-anchored 12-month Jan–Dec series (not `EnumerateRollingMonths`) reusing the same per-ride snapshot math (`SnapshotMileageRateCents`, `SnapshotAverageCarMpg`, `GasPricePerGallon`) as `GetDashboardService.BuildMileageSeries`/`BuildSavingsSeries`; sets `HasDataForYear = rides.Count > 0` (post year-filter)
- [X] T017 [US1] Extend `GetYearStatsDashboardService.cs` in `src/BikeTracking.Api/Application/Dashboard/GetYearStatsDashboardService.cs` — build the difficulty/wind sections by projecting the year-filtered rides to `AdvancedDashboardCalculations.RideDifficultySnapshot` (same projection as `GetAdvancedDashboardService.BuildDifficultySection`) and calling the existing `calculateDifficultyByMonth`, `calculateWindResistanceDistribution`, `calculateOverallAverageDifficulty` F# functions unchanged; map F# `MonthNumber`/`MonthName` results to `MonthKey` (`"{year:D4}-{month:D2}"`) and 3-letter `Label` (not the full month name) to match `YearStatsDifficultyByMonthPoint`; set `Difficulty.HasData`/`WindResistance.HasData` independently per data-model.md's partial-empty-state rule
- [X] T018 [US1] Add `GetAvailableYearsAsync(riderId, cancellationToken)` to `src/BikeTracking.Api/Application/Dashboard/GetYearStatsDashboardService.cs` — query `dbContext.Rides.Where(r => r.RiderId == riderId).Select(r => r.RideDateTimeLocal.Year).Distinct()` (or equivalent `AsNoTracking()` LINQ), sort descending, fall back to `[DateTime.Now.Year]` when the rider has no rides; return `AvailableYearsResponse`
- [X] T019 [US1] Register `GetYearStatsDashboardService` in the DI container in `src/BikeTracking.Api/Program.cs` alongside the existing `GetDashboardService`/`GetAdvancedDashboardService` registrations
- [X] T020 [US1] Extend `src/BikeTracking.Api/Endpoints/DashboardEndpoints.cs` — add `GET /api/dashboard/year-stats?year={yyyy}` handler: resolves `riderId` from the `"sub"` claim (same pattern as `GetDashboardAsync`), validates `year` is a 4-digit int within `1900 <= year <= currentYear + 1` (returns `400` via `Results.BadRequest` otherwise), calls `GetYearStatsDashboardService.GetAsync`; add `GET /api/dashboard/year-stats/years` handler calling `GetAvailableYearsAsync`; both `.RequireAuthorization()`, `.WithName(...)`, `.WithSummary(...)`, `.Produces<YearStatsDashboardResponse>(200)`/`.Produces<AvailableYearsResponse>(200)`, `.Produces<ErrorResponse>(401)`, matching existing endpoint conventions in the same file — no changes to the existing `/api/dashboard` or `/api/dashboard/advanced` handlers

**Checkpoint 🟢**: `dotnet test BikeTracking.slnx` — T004–T009 green. Existing `GetDashboardServiceTests`/`GetAdvancedDashboardServiceTests` still pass unmodified (proves FR-005/SC-003 no backend regression).

---

## Phase 4: User Story 1 - View Stats for a Chosen Year (Priority: P1) 🎯 MVP

**Goal**: A rider can open the year stats dashboard, pick a year, and see mileage/savings/difficulty/wind charts scoped to exactly that calendar year.

**Independent Test**: Navigate to the year stats dashboard page (direct URL is sufficient for this story), select a year from the year selector, and confirm all charts render data limited to that year only, including the explicit empty state for a year with zero rides.

### Frontend API Client — US1

- [X] T021 [US1] Add `getYearStatsDashboard(year: number): Promise<YearStatsDashboardResponse>` and `getAvailableYears(): Promise<AvailableYearsResponse>` to `src/BikeTracking.Frontend/src/services/dashboard-api.ts` — add matching `YearStatsDashboardResponse`, `YearStatsMileagePoint`, `YearStatsSavingsPoint`, `YearStatsDifficultySection`, `YearStatsDifficultyByMonthPoint`, `YearStatsWindResistanceSection`, `YearStatsWindResistanceBin`, `AvailableYearsResponse` TypeScript interfaces mirrored 1:1 from the C# contracts (T001); follow the existing `fetch` + `getAuthHeaders()` + throw-on-non-OK pattern already used by `getDashboard()`, no `ApiResponse<T>` wrapper (matches this file's convention, not the `monthly-import-api.ts` wrapper convention)

### Frontend Components — US1 (depends on Phase 5 for chart reuse)

- [X] T022 [US1] Implement `year-stats-dashboard-page.tsx` in `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.tsx` (replacing the T002 stub) — on mount, calls `getAvailableYears()`, sets `selectedYear` to the current year if present in the list, else the most recent year in the list (FR-008); `useEffect` keyed on `selectedYear` calls `getYearStatsDashboard(selectedYear)` and updates state without navigation (FR-009); renders `YearSelector` (years, selectedYear, onChange), a year-scoped `DashboardChartSection` (passing `year`/`seriesLabel="Calendar year {selectedYear}"`), and `DifficultyAnalyticsSection` fed by an adapter that maps the response's `Difficulty`/`WindResistance` sections into the `AdvancedDashboardDifficultySection` shape `DifficultyAnalyticsSection` already expects (`isEmpty`, `difficultyByMonth[].monthNumber/monthName`, `mostDifficultMonths`, `windResistanceDistribution[].rating/rideCount/label/isAssisted`); when `hasDataForYear` is `false`, renders an explicit "No ride data for {selectedYear}" empty state instead of the chart sections (FR-007)
- [X] T023 [P] [US1] Style `year-stats-dashboard-page.css` in `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.css` — hero/header layout consistent with `advanced-dashboard-page.css`/`dashboard-page.css`; empty-state styling for the no-data-for-year state; mobile-first responsive layout per repo convention

**Checkpoint**: User Story 1 is fully functional via direct URL navigation to `/dashboard/year-stats` — year selection, year-scoped charts, and empty-state all work independently of US2/US3 wiring tasks below (though it depends on the Phase 5 component-reuse tasks being complete).

---

## Phase 5: User Story 2 - Reuse Existing Chart Components (Priority: P2)

**Goal**: The mileage/savings and difficulty/wind chart components are parameterized by year/label so the same rendering code serves both the rolling-window main dashboard (unchanged) and the year-scoped year stats dashboard, with no duplication.

**Independent Test**: Verify the main dashboard still renders identically (same charts, same rolling-window "Rolling 12 months" copy and behavior) after the refactor, and that the year stats dashboard renders using the same underlying `DashboardChartSection`/`DifficultyAnalyticsSection` components with a `year`-scoped data source.

- [X] T024 [US2] Extend `DashboardChartSection` props in `src/BikeTracking.Frontend/src/components/dashboard/dashboard-chart-section.tsx` — add optional `seriesLabel?: string` prop (default `'Rolling 12 months'`) rendered in place of the hardcoded `<p>Rolling 12 months</p>` text in both the mileage and savings chart card headers; no other rendering-logic changes, so the main dashboard's default (unchanged) call sites continue to render identically (FR-005)
- [X] T025 [US2] Create `year-selector.tsx` in `src/BikeTracking.Frontend/src/components/dashboard/year-selector.tsx` — presentational component, props `{ years: number[], selectedYear: number, onChange: (year: number) => void }`; native accessible `<select>` (WCAG 2.1 AA labelled control per repo convention), one `<option>` per year, no `any` types; functions correctly with a single-entry `years` array (spec edge case: rider with rides in only one year)
- [X] T026 [US2] Confirm `DifficultyAnalyticsSection.tsx` in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/DifficultyAnalyticsSection.tsx` requires **no code changes** — it already only consumes an `AdvancedDashboardDifficultySection`-shaped `section` prop with no internal data fetching; the year-stats page adapts its year-scoped response into this shape (T022) rather than modifying this component, per research.md Decision 2

**Checkpoint**: `npm run test:unit` green for T011/T012 (year-selector + dashboard-chart-section tests). Main dashboard (`/dashboard`) renders with zero visual/behavioral change (SC-003) using `DashboardChartSection` without a `seriesLabel` prop.

---

## Phase 6: User Story 3 - Navigate to the Year Stats Dashboard (Priority: P3)

**Goal**: Riders can discover and open the year stats dashboard from the app's primary navigation without needing a direct URL.

**Independent Test**: Check that a "Year Stats" nav entry exists in the app header alongside "Dashboard" and "Advanced Stats", and that clicking it opens the year stats dashboard with a year already selected and charts rendered.

- [X] T027 [US3] Add a `NavLink` to `/dashboard/year-stats` labelled "Year Stats" in `src/BikeTracking.Frontend/src/components/app-header/app-header.tsx`, positioned alongside the existing "Dashboard" and "Advanced Stats" `NavLink`s, using the same `isActive` active-class pattern as the other nav links (FR-001)
- [X] T028 [P] [US3] Confirm the `/dashboard/year-stats` route registered in `src/BikeTracking.Frontend/src/App.tsx` (T003) now renders the completed `YearStatsDashboardPage` from T022 (not the T002 stub)

**Checkpoint**: All three user stories independently functional. Nav → page load → year already selected → charts rendered, with no direct-URL knowledge required (SC-004).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, edge-case hardening, full E2E gate completion, and regression sign-off.

- [X] T029 [P] Add ARIA labels and keyboard navigation for the year selector and empty-state banner across `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.tsx` and `src/BikeTracking.Frontend/src/components/dashboard/year-selector.tsx` — year `<select>` has an associated `<label>`; empty-state uses `role="status"`/`aria-live="polite"` consistent with other empty-state patterns in the app (e.g. `advanced-dashboard-page.tsx` reminder cards)
- [X] T030 [P] Add backend edge-case tests to close any remaining gaps in `src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs` — `year` boundary values `1900` and `currentYear + 1` accepted; `year = 1899` and `year = currentYear + 2` rejected at the endpoint layer; a rider with rides in only one year still returns that single year from `GetAvailableYearsAsync`
- [X] T031 Complete all 5 Playwright E2E scenarios in `src/BikeTracking.Frontend/tests/e2e/year-stats-dashboard.spec.ts` (from T015) — implement full scenario bodies against the running app; confirm each passes (E2E PR gate per constitution directive 4)
- [X] T032 Run `quickstart.md` validation end-to-end — backend curl checks (`/api/dashboard/year-stats/years`, `/api/dashboard/year-stats?year=2025`, `/api/dashboard/year-stats?year=1901` expecting `400`) and the manual exploratory pass steps in `specs/026-year-stats-dashboard/quickstart.md`
- [X] T033 Run full regression suite and confirm zero failures — `dotnet test BikeTracking.slnx` (backend + domain, including unmodified `GetDashboardServiceTests`/`GetAdvancedDashboardServiceTests`); `npm run test:unit` in `src/BikeTracking.Frontend`; `npm run test:e2e` in `src/BikeTracking.Frontend`; confirm `/dashboard` and `/dashboard/advanced` show no behavioral or visual regression (SC-003)

**Checkpoint ✅**: All tests passing. E2E gate green. Feature complete and ready for PR.

---

## Dependency Graph

```
Phase 1 (T001–T003) ────────────► Phase 2 (T004–T015)
  [contracts + route/page stubs must exist before tests compile/run]

T001 ──► T004, T005, T006, T007, T008, T009, T010   (contracts before backend/frontend tests reference them)
T002, T003 ──► T013, T015                            (page stub + route before page/E2E tests can target it)

T004, T005, T006 ──► T016, T017   (service tests red before service impl)
T007             ──► T018         (available-years tests red before impl)
T008, T009       ──► T020         (endpoint tests red before endpoint impl)
T016, T017       ──► T019, T020   (service must exist before DI registration and endpoint wiring)
T019             ──► T020         (DI registration before endpoint can resolve the service)

T010             ──► T021         (API client tests red before client impl)
T011             ──► T025         (year-selector tests red before component impl)
T012             ──► T024         (chart-section tests red before prop extension)
T013             ──► T022         (page tests red before page impl)
T014             ──► T024         (regression test must pass unchanged after T024)

T020             ──► T021         (endpoint must exist before frontend calls it end-to-end)
T021             ──► T022         (API client before page composition)
T024, T025, T026 ──► T022         (reusable components before page composition)
T022             ──► T023         (page markup before styling)
T022             ──► T027, T028   (page complete before nav wiring/route finalization)
T027, T028       ──► T031         (nav entry + route before E2E nav scenario can pass)
T022, T024       ──► T031         (page + chart reuse before full E2E suite passes)
T029, T030, T031, T032 ──► T033   (all polish/validation before final regression)
```

---

## Parallel Execution Groups

| Group | Tasks | Condition |
|-------|-------|-----------|
| A — Phase 1 parallel | T001, T002 | Independent files; T003 depends on T002 |
| B — Phase 2 backend tests | T004, T005, T006, T007, T008, T009 | After T001 (contracts declared) |
| C — Phase 2 frontend tests | T010, T011, T012, T013, T014 | After T001–T003 |
| D — Phase 3 backend core | T016, T017, T018 same file (sequential); T019, T020 after | After Phase 2 backend tests confirmed red |
| E — Phase 4/5 components | T021, T024, T025 | After Phase 3 checkpoint green; independent files |
| F — Phase 7 polish | T029, T030 | After T022 (page) / T020 (endpoint) respectively |

---

## Parallel Example: User Story 1

```bash
# Launch all backend tests for User Story 1 together (Phase 2):
Task: "Write GetYearStatsDashboardServiceTests.cs year-window coverage"
Task: "Write savings-snapshot-accuracy regression test"
Task: "Write difficulty/wind-resistance year-filtering tests"
Task: "Write GetAvailableYearsAsync tests"
Task: "Write DashboardEndpointsTests.cs year-stats endpoint tests"

# Launch independent frontend pieces for User Story 1 together (Phase 4):
Task: "Add getYearStatsDashboard/getAvailableYears to dashboard-api.ts"
Task: "Style year-stats-dashboard-page.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (contracts + stubs)
2. Complete Phase 2: Tests (TDD red — backend + frontend + E2E scaffold)
3. Complete Phase 3: Core backend (`GetYearStatsDashboardService`, endpoints) — green checkpoint
4. Complete Phase 5's component-reuse tasks (T024–T026) since Phase 4's page composition depends on them
5. Complete Phase 4: User Story 1 (API client + page + styling)
6. **STOP and VALIDATE**: Navigate directly to `/dashboard/year-stats`, confirm year selection and year-scoped charts work, including the empty-year state
7. Deploy/demo if ready — this is the MVP (US1, enabled by the US2 refactor)

### Incremental Delivery

1. Setup + Tests (red) + Core backend → Foundation ready, all contracts and services exist
2. Add Phase 5 (US2 reuse) + Phase 4 (US1 page) → Test independently via direct URL → Deploy/Demo (MVP!)
3. Add Phase 6 (US3 nav entry) → Test independently → Deploy/Demo
4. Add Phase 7 (polish, full E2E, regression) → Final PR gate

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup (Phase 1) + Tests (Phase 2) together
2. One developer: Phase 3 backend core (T016–T020)
3. Once Phase 3 checkpoint is green:
   - Developer A: Phase 5 component reuse (T024–T026)
   - Developer B: Phase 4 API client + page (T021–T023, blocked on A for T022)
4. Developer C: Phase 6 nav wiring (T027–T028), once Phase 4's page exists
5. All: Phase 7 polish + regression sign-off together

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
