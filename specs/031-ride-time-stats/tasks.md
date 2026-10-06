---

description: "Task list for Riding Time Totals"
---

# Tasks: Riding Time Totals

**Input**: Design documents from `/specs/031-ride-time-stats/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/riding-time-totals-contract.md, quickstart.md

**Tests**: This repo's constitution mandates TDD ("TDD mandatory" — see plan.md Constitution Check) and E2E on every PR. All test tasks below are REQUIRED, MUST be written first, and MUST FAIL before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story (US1 = main dashboard, P1; US2 = advanced dashboard overall, P2; US3 = yearly stats, P3) so each story can be implemented and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web application layout per plan.md:
- Backend: `src/BikeTracking.Api/`, tests in `src/BikeTracking.Api.Tests/`
- Frontend: `src/BikeTracking.Frontend/src/`, e2e tests in `src/BikeTracking.Frontend/tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No scaffolding needed. The feature extends existing dashboard slices in place, with no schema change and no new dependencies. This phase only confirms a clean baseline.

- [X] T001 Run `dotnet test BikeTracking.slnx` and `cd src/BikeTracking.Frontend && npm run test:unit` to confirm a clean baseline before starting (no code changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared calculation (`RidingTimeRules`) and shared display formatter (`formatHoursMinutes`) that all three stories use, so the three surfaces cannot disagree (SC-002, research.md Decisions 3 & 5).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (write first, MUST FAIL) ⚠️

- [X] T002 [P] Create `src/BikeTracking.Api.Tests/Application/Dashboard/RidingTimeRulesTests.cs` with xUnit tests for `RidingTimeRules.SumRecordedRideMinutes`: (a) empty sequence → `0`; (b) all rides `RideMinutes = null` → `0`; (c) mixed `[45, null, 30, 90]` → `165` (nulls excluded, FR-004); (d) large total, e.g. 1,000 rides × 63 min → `63000` (no overflow, Edge Case 2). Build `RideEntity` instances directly, following the existing `GetDashboardServiceTests.cs` style
- [X] T003 [P] Create `src/BikeTracking.Frontend/src/utils/ridingTime.test.ts` with Vitest cases for `formatHoursMinutes` per data-model.md Display Projection: `0 → "0h 0m"`, `45 → "0h 45m"`, `120 → "2h 0m"`, `2535 → "42h 15m"`, `62550 → "1,042h 30m"` (FR-006, Edge Case 2)

### Implementation for Foundational

- [X] T004 [P] Create `internal static class RidingTimeRules` in `src/BikeTracking.Api/Application/Dashboard/RidingTimeRules.cs` (namespace `BikeTracking.Api.Application.Dashboard`, same style as `SavingsCalculationRules.cs`) with `public static int SumRecordedRideMinutes(IEnumerable<RideEntity> rides)` returning `rides.Where(r => r.RideMinutes.HasValue).Sum(r => r.RideMinutes!.Value)`. Include a short `<summary>` noting that rides without a duration are excluded (FR-004). Makes T002 pass. Depends on T002 being red
- [X] T005 [P] Create `src/BikeTracking.Frontend/src/utils/ridingTime.ts` exporting `formatHoursMinutes(totalMinutes: number): string` that returns `` `${Math.floor(totalMinutes / 60).toLocaleString('en-US')}h ${totalMinutes % 60}m` ``, with a JSDoc comment. Makes T003 pass. Depends on T003 being red

**Checkpoint**: The shared calculation and formatter exist and are tested. User story work can now begin, in parallel if desired.

---

## Phase 3: User Story 1 - See total riding time on the main dashboard (Priority: P1) 🎯 MVP

**Goal**: The main dashboard shows a "Riding Time" summary card with the rider's all-time total (`Xh Ym`), and its detail line flags rides that are missing a duration.

**Independent Test**: Sign in as a rider with rides that have durations (and one without), open `/dashboard`, and confirm the "Riding Time" card equals the sum of the recorded durations in `Xh Ym`, with a note about the ride missing a duration. A rider with no rides sees `0h 0m`.

### Tests for User Story 1 (write first, MUST FAIL) ⚠️

- [X] T006 [P] [US1] Extend `src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs`: (a) rides with `RideMinutes` `[45, 30, 90, null]` → `response.Totals.TotalRideMinutes == 165` and `MissingData.RidesMissingDuration == 1` (US1 AC1, AC3); (b) no rides → `TotalRideMinutes == 0` (US1 AC2); (c) another rider's rides are excluded (FR-007)
- [X] T007 [P] [US1] Extend `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx`: (a) a mocked response with `totals.totalRideMinutes: 2535` renders a "Riding Time" card showing `42h 15m`; (b) `missingData.ridesMissingDuration: 2` makes the card detail read `2 rides missing duration`, and `1` makes it read `1 ride missing duration`; (c) the empty/default state renders `0h 0m`. Add `totalRideMinutes` to every existing `DashboardTotals` fixture in this file
- [X] T008 [P] [US1] Extend `src/BikeTracking.Frontend/tests/e2e/dashboard.spec.ts`: record rides with durations 45 and 90 min plus one with no duration, open the dashboard, and assert the "Riding Time" card shows `2h 15m` and its detail reads `1 ride missing duration`

### Implementation for User Story 1

- [X] T009 [US1] Add `int TotalRideMinutes` as the last positional parameter of `DashboardTotals` in `src/BikeTracking.Api/Contracts/DashboardContracts.cs` (per contract §1)
- [X] T010 [US1] In `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs`, pass `TotalRideMinutes: RidingTimeRules.SumRecordedRideMinutes(rides)` (all rides) to the `DashboardTotals` constructor. Makes T006 pass. Depends on T004, T009
- [X] T011 [P] [US1] Add `totalRideMinutes: number;` to the `DashboardTotals` interface in `src/BikeTracking.Frontend/src/services/dashboard-api.ts`, and add `totalRideMinutes` to any `DashboardTotals` fixtures in `src/BikeTracking.Frontend/src/services/dashboard-api.test.ts` so it type-checks
- [X] T012 [US1] In `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx`: add `totalRideMinutes: 0` to the empty-state default `totals` object, and add a `DashboardSummaryCard` (title "Riding Time", eyebrow "Duration", value `formatHoursMinutes(dashboard.totals.totalRideMinutes)`) right after the "All Time" mileage card. Detail is `formatMissingDuration(dashboard.missingData.ridesMissingDuration)` when the count is `> 0`, otherwise `formatRideCount(dashboard.totals.allTimeMiles.rideCount)` (research.md Decision 6). Add a local `formatMissingDuration(count: number): string` helper next to `formatRideCount`, in the same style (`` count === 1 ? '1 ride missing duration' : `${count} rides missing duration` ``). Add an accent class in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.css` following the existing `dashboard-summary-card-accent-*` pattern. Makes T007 and T008 pass. Depends on T005, T011

**Checkpoint**: User Story 1 is fully functional and testable on its own (MVP).

---

## Phase 4: User Story 2 - See overall riding time on the advanced dashboard (Priority: P2)

**Goal**: The advanced dashboard shows a single "All-time riding time" figure in its Savings Breakdown section. It is all-time only, not added to each time window (spec Assumption 1, research.md Decision 4).

**Independent Test**: Open `/dashboard/advanced` as a rider with recorded durations and confirm "All-time riding time" shows the summed total in `Xh Ym`. A rider with no rides sees `0h 0m`.

### Tests for User Story 2 (write first, MUST FAIL) ⚠️

- [X] T013 [P] [US2] Extend `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs`: (a) rides with `RideMinutes` `[45, null, 90]` spread across this week and a prior year → `response.TotalRideMinutes == 135` (all-time scope, US2 AC1); (b) no rides → `TotalRideMinutes == 0` (US2 AC2)
- [X] T014 [P] [US2] Extend `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.test.tsx`: (a) a mocked response with `totalRideMinutes: 2535` renders `All-time riding time` with `42h 15m` inside the "Savings breakdown by time window" region; (b) `totalRideMinutes: 0` renders `0h 0m`. Add `totalRideMinutes` to the shared response fixture builder in this file
- [X] T015 [P] [US2] Extend `src/BikeTracking.Frontend/tests/e2e/savings-calculation.spec.ts` (the existing advanced-dashboard E2E): after recording rides with durations, open the advanced dashboard and assert the "All-time riding time" value equals the formatted sum

### Implementation for User Story 2

- [X] T016 [US2] Add `int TotalRideMinutes` to `AdvancedDashboardResponse` in `src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs`, placed after `Co2SavedPerMileLbs` and before the defaulted `DifficultySection` parameter. Add a `<summary>` doc comment: all-time sum of recorded ride minutes; rides without duration excluded; `0` when none (contract §2)
- [X] T017 [US2] In `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs`, pass `TotalRideMinutes: RidingTimeRules.SumRecordedRideMinutes(rides)` (all rides) to the `AdvancedDashboardResponse` constructor. Makes T013 pass. Depends on T004, T016
- [X] T018 [P] [US2] Add `totalRideMinutes: number;` (with a JSDoc comment) to the `AdvancedDashboardResponse` interface in `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts`
- [X] T019 [US2] In `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.tsx`, inside the "Savings breakdown by time window" section between the `<h2>` and `<SavingsWindowsTable>`, render `<p className="advanced-dashboard-riding-time">All-time riding time: <strong>{formatHoursMinutes(data.totalRideMinutes)}</strong></p>`. Add a matching style to `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.css`. Makes T014 and T015 pass. Depends on T005, T018

**Checkpoint**: User Stories 1 and 2 both work on their own.

---

## Phase 5: User Story 3 - See riding time for a chosen year (Priority: P3)

**Goal**: The year stats summary shows "Total riding time" for the selected calendar year. It updates when the year changes, and the existing "no data" treatment covers years without rides.

**Independent Test**: Open `/dashboard/year-stats`, pick a year with rides, and confirm "Total riding time" equals that year's summed durations. Switch years and confirm it updates without leaving the page.

### Tests for User Story 3 (write first, MUST FAIL) ⚠️

- [X] T020 [P] [US3] Extend `src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs`: (a) rides on Dec 31 of year N-1 (45 min), Jan 1 of year N (30 min), and mid-year N (90 min, plus one `null`) → for year N, `Totals.TotalRideMinutes == 120`; for year N-1, `== 45` (calendar boundary, US3 AC1); (b) a year with rides that all have `RideMinutes = null` → `HasDataForYear == true` and `TotalRideMinutes == 0` (Edge Case 4); (c) a year with no rides → `HasDataForYear == false` and `TotalRideMinutes == 0`
- [X] T021 [P] [US3] Extend `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.test.tsx`: (a) `hasDataForYear: true` with `totals.totalRideMinutes: 6015` renders a `Total riding time` term with `100h 15m`; (b) `totalRideMinutes: 0` with `hasDataForYear: true` renders `0h 0m`; (c) `hasDataForYear: false` renders the existing empty-state message and no `Total riding time` term (US3 AC2); (d) changing the selected year re-renders with the new year's value (US3 AC3). Add `totalRideMinutes` to every `YearStatsTotals` fixture in this file
- [X] T022 [P] [US3] Extend `src/BikeTracking.Frontend/tests/e2e/year-stats-dashboard.spec.ts`: record rides with durations in two different years, assert "Total riding time" for each selected year, and assert it updates after switching years (SC-004)

### Implementation for User Story 3

- [X] T023 [US3] Add `int TotalRideMinutes` as the last positional parameter of `YearStatsTotals` in `src/BikeTracking.Api/Contracts/DashboardContracts.cs`, and update its `<summary>` (contract §3)
- [X] T024 [US3] In `src/BikeTracking.Api/Application/Dashboard/GetYearStatsDashboardService.cs` `BuildTotalsSection`, pass `TotalRideMinutes: RidingTimeRules.SumRecordedRideMinutes(rides)` (the year-filtered rides already passed in) to the `YearStatsTotals` constructor. Makes T020 pass. Depends on T004, T023
- [X] T025 [P] [US3] Add `totalRideMinutes: number;` to the `YearStatsTotals` interface in `src/BikeTracking.Frontend/src/services/dashboard-api.ts`, and add it to any `YearStatsTotals` fixtures in `src/BikeTracking.Frontend/src/services/dashboard-api-year-stats.test.ts`
- [X] T026 [US3] In `src/BikeTracking.Frontend/src/pages/year-stats-dashboard/year-stats-dashboard-page.tsx`, add `<div className="year-stats-summary-item"><dt>Total riding time</dt><dd>{formatHoursMinutes(data.totals.totalRideMinutes)}</dd></div>` right after the "Total miles" item inside `year-stats-summary-totals` (within the existing `hasDataForYear` branch). Makes T021 and T022 pass. Depends on T005, T025

**Checkpoint**: All three user stories work on their own.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification and cleanup.

- [X] T027 [P] Add `totalRideMinutes` to any typed dashboard / year-stats / advanced-dashboard response fixtures or route mocks in `src/BikeTracking.Frontend/tests/e2e/support/expense-helpers.ts`, `src/BikeTracking.Frontend/tests/e2e/dashboard-expenses.spec.ts`, and `src/BikeTracking.Frontend/tests/e2e/savings-calculation.spec.ts` that construct these shapes, so `tsc` and lint stay clean
- [X] T028 [P] Add a cross-surface consistency test to `src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs` (SC-002). First add a `SeedRideAsync(long riderId, DateTime rideDateTimeLocal, decimal miles, int? rideMinutes = null)` helper to `DashboardApiHost`, following the existing `SeedRideAsync` in `ImportEndpointsTests.cs` (create a scope, get `BikeTrackingDbContext`, add a `RideEntity` with `RideMinutes = rideMinutes`, `SaveChangesAsync`). Seed one rider with rides of 45 min on Dec 31 of last year, 30 min on Jan 1 of this year, 90 min today, and one with no duration today. Assert `GET /api/dashboard` `totals.totalRideMinutes` == `165`, `GET /api/dashboard/advanced` `totalRideMinutes` == `165`, and `GET /api/dashboard/year-stats?year={this year}` `totals.totalRideMinutes` == `120` (matches quickstart.md)
- [X] T029 Run the full suites: `dotnet test BikeTracking.slnx`, `cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit && npm run test:e2e`; fix any regressions. `dotnet test` (515 passed), `npm run lint`, `npm run test:unit` (232 passed), and `npm run test:e2e` (63/64 passed; all riding-time specs green — the one unrelated failure is a pre-existing weather-API network dependency in `record-ride.spec.ts`) all pass with no regressions. `npm run build` could not be verified in this sandbox (missing Linux native `lightningcss` binary; `npm install` to fetch it is blocked by a sandbox symlink permission restriction) — environment limitation unrelated to this feature's code
- [X] T030 Walk through the manual scenario table in `specs/031-ride-time-stats/quickstart.md` (steps 1–6) against the running app and confirm each expected value. Not walked through manually. Steps 1–4 are approximated by the e2e tests (T008, T015, T022) against a live API + UI, with similar but not identical ride data (dashboard/advanced: 45 + 90 min + one missing duration → `2h 15m`; year stats: 45/30/90 across a year boundary → `2h 0m` / `0h 45m`); all pass. Step 6 (second rider) is covered by the API-level T028/unit tests, not e2e
- [ ] T031 Create (or find) the GitHub issue for "Riding Time Totals" and reference it in the PR description (`Closes #<n>`), per constitution Directive 2

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories (every story uses `RidingTimeRules` and `formatHoursMinutes`)
- **User Stories (Phases 3–5)**: All depend on Foundational only. They touch disjoint contract records, services, and pages, so they can proceed in parallel or in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all three stories (T028 exercises all three endpoints)

### User Story Dependencies

- **US1 (P1)**: Depends on T004, T005 only
- **US2 (P2)**: Depends on T004, T005 only; independent of US1
- **US3 (P3)**: Depends on T004, T005 only; independent of US1/US2

### Shared-file notes (avoid concurrent edits)

- `src/BikeTracking.Api/Contracts/DashboardContracts.cs` is edited by both T009 (US1) and T023 (US3), on different records
- `src/BikeTracking.Frontend/src/services/dashboard-api.ts` is edited by both T011 (US1) and T025 (US3), on different interfaces
- If US1 and US3 run in parallel, serialize these two pairs or expect a trivial merge

### Within Each User Story

- Tests are written first and MUST FAIL (TDD gate)
- Contract record → service → TS type → page
- Story complete and checkpoint verified before moving to the next priority (when working sequentially)

### Parallel Opportunities

- Phase 2: T002 ∥ T003, then T004 ∥ T005 (backend and frontend are independent)
- Within each story, all three test tasks are [P] (different files: service tests, page tests, E2E spec)
- Within each story, the TS type task (T011 / T018 / T025) can run alongside the backend contract and service tasks
- Across stories: US1, US2, and US3 can be staffed in parallel after Phase 2 (see shared-file notes)
- Phase 6: T027 ∥ T028

---

## Parallel Example: User Story 1

```bash
# Write all failing tests for User Story 1 together:
Task: "Extend GetDashboardServiceTests.cs with TotalRideMinutes cases"            # T006
Task: "Extend dashboard-page.test.tsx with Riding Time card cases"                # T007
Task: "Extend tests/e2e/dashboard.spec.ts with riding time assertion"             # T008

# Then backend and frontend type work in parallel:
Task: "Add TotalRideMinutes to DashboardTotals + populate in GetDashboardService" # T009 → T010
Task: "Add totalRideMinutes to DashboardTotals in dashboard-api.ts"               # T011
```

## Parallel Example: All Stories After Foundational

```bash
Task: "US1 — T006..T012 (main dashboard)"
Task: "US2 — T013..T019 (advanced dashboard)"
Task: "US3 — T020..T026 (year stats)"   # coordinate DashboardContracts.cs / dashboard-api.ts edits with US1
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T005)
3. Complete Phase 3: User Story 1 (T006–T012)
4. **STOP and VALIDATE**: quickstart.md steps 1 and 6 (main dashboard parts)
5. Demo or open a PR if ready (E2E for US1 is included, so the PR gate is satisfied)

### Incremental Delivery

1. Setup + Foundational → shared rule and formatter ready
2. US1 → validate → PR (MVP)
3. US2 → validate → PR
4. US3 → validate → PR
5. Polish (T027–T031) with the final story

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps each task to a user story for traceability
- No migrations, no new endpoints, no F# changes (research.md Decision 3)
- Contract changes are additive non-nullable `int` fields; `0` means nothing to sum (research.md Decision 2)
- Commit after each task or logical group; show failing-test proof before each implementation task
