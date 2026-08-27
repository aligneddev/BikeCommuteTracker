---

description: "Task list for CO2 Savings on Advanced Dashboard"
---

# Tasks: CO2 Savings on Advanced Dashboard

**Input**: Design documents from `/specs/029-co2-savings-dashboard/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/advanced-dashboard-co2-contract.md, quickstart.md

**Tests**: Included — the constitution mandates TDD, and plan.md/quickstart.md both require failing F# calculation tests, backend service tests, and frontend component tests before implementation.

**Organization**: Tasks are grouped by user story (US1, US2) to enable independent implementation and testing. A shared Foundational phase holds the pure CO2 calculation function both stories depend on, since it is not itself independently user-facing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in each description

## Path Conventions (Web app: F# domain → C# API → React frontend)

- Domain: `src/BikeTracking.Domain.FSharp/`
- Backend: `src/BikeTracking.Api/`, tests in `src/BikeTracking.Api.Tests/`
- Frontend: `src/BikeTracking.Frontend/src/`, e2e in `src/BikeTracking.Frontend/tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the working tree builds cleanly before making changes (no new projects/dependencies needed — this feature only touches existing files).

- [ ] T001 Confirm baseline build/test health: run `dotnet test BikeTracking.slnx` and `cd src/BikeTracking.Frontend && npm run test:unit`, confirming both pass before any CO2 changes are made (no code changes in this task)

**Checkpoint**: Baseline green — safe to start foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the fixed CO2-per-mile constant and the pure CO2 calculation function that both User Story 1 (per-window totals) and User Story 2 (per-mile figure) depend on. Per research.md Decision 2, this must be a pure, unit-testable F# function following the existing `calculateGallonsSaved`/`calculateMileageRateSavings` pattern.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Write failing F# calculation tests for `calculateCo2Saved` and `Co2PerMileLbs` in `src/BikeTracking.Api.Tests/Application/Dashboard/AdvancedDashboardCalculationsTests.cs` (new file), asserting: `calculateCo2Saved` returns `totalMiles * 0.90m` rounded to 2 decimal places (`MidpointRounding.AwayFromZero`); zero miles returns `0.00m` (not an exception, null, or NaN); `Co2PerMileLbs` equals `0.90m`
- [ ] T003 Add `Co2PerMileLbs = 0.90m` constant and `calculateCo2Saved (totalMiles: decimal) : decimal` pure function to `src/BikeTracking.Domain.FSharp/AdvancedDashboardCalculations.fs`, computing `Math.Round(totalMiles * Co2PerMileLbs, 2, MidpointRounding.AwayFromZero)`; run T002's tests and confirm they now pass

**Checkpoint**: Pure CO2 calculation exists and is unit-tested — User Story 1 and User Story 2 implementation can now begin.

---

## Phase 3: User Story 1 - View Total CO2 Saved for the Current Year (Priority: P1) 🎯 MVP

**Goal**: Every one of the four savings windows (weekly, monthly, yearly, all-time) displays a CO2-saved total computed on demand from that window's total miles, rendered alongside the existing gas/money/mileage-rate figures on the advanced dashboard.

**Independent Test**: Navigate to the advanced dashboard with ride history for the selected year; verify the yearly window (and weekly/monthly/all-time windows) each display a CO2 saved value computed from that window's total miles, with zero-mile windows showing `0.00 lb` rather than blank/error.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [ ] T004 [P] [US1] Write failing test in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` asserting `co2Saved`/`Co2Saved` is present and non-null on all four windows (weekly, monthly, yearly, allTime) and equals `totalMiles * 0.90` (within 0.01) for a rider with rides across multiple windows
- [ ] T005 [P] [US1] Write failing test in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` asserting a window with zero ride miles returns `Co2Saved == 0.00m` (not null, exception, or NaN)
- [ ] T006 [P] [US1] Write failing test in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` asserting `Co2Saved` does not change when a rider's `AverageCarMpg`/`MileageRateCents` settings change (only ride miles affect it)
- [ ] T007 [P] [US1] Write failing test in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.test.tsx` asserting a "CO2 Saved" value renders for each of the four window rows, formatted to 2 decimal places with a unit label (e.g., `"22.05 lb"`), including `"0.00 lb"` for a zero-mile window (not blank/`"—"`)

### Implementation for User Story 1

- [ ] T008 [US1] Add `Co2Saved: decimal` (non-nullable) field to the `AdvancedSavingsWindow` record in `src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs`, documented as always-present (never null, unlike `GallonsSaved`/`FuelCostAvoided`) per FR-006/data-model.md
- [ ] T009 [US1] Wire `AdvancedDashboardCalculations.calculateCo2Saved` into `BuildWindow` in `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs`, passing `totalMiles` and setting the new `Co2Saved` field on the returned `AdvancedSavingsWindow` for all four windows (weekly, monthly, yearly, allTime) — depends on T008
- [ ] T010 [US1] Add `co2Saved: number` (non-nullable) field to the `AdvancedSavingsWindow` TypeScript interface in `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts`
- [ ] T011 [US1] Add a `formatCo2` helper (formats to `"{value.toFixed(2)} lb"`, never `"—"`) and a new "CO2 Saved" column (header + per-row cell) to `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.tsx`, rendering `co2Saved` for all four window rows — depends on T010
- [ ] T012 [US1] Run T004–T007 and confirm they now pass; run `dotnet test BikeTracking.slnx` and `cd src/BikeTracking.Frontend && npm run test:unit` to confirm no regressions

**Checkpoint**: User Story 1 is fully functional and independently testable — CO2 totals visible on all four savings windows.

---

## Phase 4: User Story 2 - View CO2 Saved Per Mile (Priority: P1)

**Goal**: A fixed CO2-saved-per-mile figure ("0.90 lb CO2/mile") is displayed once near the CO2 totals, independent of ride count, so users can relate per-window totals to an individual-mile impact.

**Independent Test**: Verify a fixed "CO2 saved per mile" figure is displayed near the total CO2 saved figures (including for a rider with zero rides), and that multiplying it by any window's total miles reproduces that window's total CO2 saved value within 0.01 lb.

### Tests for User Story 2 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation

- [ ] T013 [P] [US2] Write failing test in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` asserting `Co2SavedPerMileLbs` is present on the response and equals `0.90m`, including for a rider with zero rides across all windows
- [ ] T014 [P] [US2] Write failing test in `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` asserting, for each of the four windows, `window.Co2Saved == Round(response.Co2SavedPerMileLbs * window.TotalMiles, 2)` within 0.01 (SC-003 cross-check)
- [ ] T015 [P] [US2] Write failing test in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.test.tsx` (or a new `advanced-dashboard-page.test.tsx` case, whichever component ends up owning the caption) asserting the per-mile figure ("0.90 lb CO2/mile") renders once, not per row, including when all windows have zero rides

### Implementation for User Story 2

- [ ] T016 [US2] Add `Co2SavedPerMileLbs: decimal` field to `AdvancedDashboardResponse` in `src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs`, documented as a fixed response-level constant (not per-window)
- [ ] T017 [US2] Set `Co2SavedPerMileLbs: AdvancedDashboardCalculations.Co2PerMileLbs` on the `AdvancedDashboardResponse` returned from `GetAsync` in `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs` — depends on T016
- [ ] T018 [US2] Add `co2SavedPerMileLbs: number` field to the `AdvancedDashboardResponse` TypeScript interface in `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts`
- [ ] T019 [US2] Render the per-mile figure once (e.g., `"0.90 lb CO2/mile"`) near the CO2 totals — add a `co2SavedPerMile` prop to `SavingsWindowsTable` (or a caption in `advanced-dashboard-page.tsx`, whichever fits the existing layout best) in `src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.tsx` and wire it from `src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.tsx` — depends on T018
- [ ] T020 [US2] Run T013–T015 and confirm they now pass; run `dotnet test BikeTracking.slnx` and `cd src/BikeTracking.Frontend && npm run test:unit` to confirm no regressions

**Checkpoint**: User Stories 1 AND 2 both work independently — CO2 totals per window and the per-mile figure are both visible and cross-validated.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and final consistency checks across both stories.

- [ ] T021 [P] Extend `src/BikeTracking.Frontend/tests/e2e/savings-calculation.spec.ts` (or add a CO2-focused e2e spec in the same directory) to assert: CO2 totals render on the advanced dashboard for all four windows, the per-mile figure ("0.90 lb CO2/mile") is visible, and a zero-ride rider sees `"0.00 lb"` per window while the per-mile figure still displays
- [ ] T022 Run the full quickstart.md validation matrix: `dotnet test BikeTracking.slnx`, `cd src/BikeTracking.Frontend && npm run test:unit`, `cd src/BikeTracking.Frontend && npm run test:e2e`, and the manual dashboard check described in `specs/029-co2-savings-dashboard/quickstart.md`
- [ ] T023 Re-verify the Constitution Check post-implementation gates in `specs/029-co2-savings-dashboard/plan.md` still hold (no new persistence, CO2 not cached/stored, pure F# calculation, TDD followed) and update `plan.md`'s Post-Design re-check notes if anything changed during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS both user stories (both need `calculateCo2Saved`/`Co2PerMileLbs`)
- **User Story 1 (Phase 3)**: Depends on Foundational completion only — independently testable once done
- **User Story 2 (Phase 4)**: Depends on Foundational completion; touches the same contract/service/frontend files as US1 (`AdvancedDashboardContracts.cs`, `GetAdvancedDashboardService.cs`, `advanced-dashboard-api.ts`, `SavingsWindowsTable.tsx`) so is best done sequentially after US1 to avoid merge conflicts, though it does not functionally depend on US1's `Co2Saved` field
- **Polish (Phase 5)**: Depends on both User Story 1 and User Story 2 being complete (SC-003 cross-check needs both `Co2Saved` and `Co2SavedPerMileLbs`)

### Within Each User Story

- Tests (T004–T007, T013–T015) MUST be written and FAIL before their corresponding implementation tasks
- Contract change before service wiring before frontend type before frontend rendering
- Story complete before moving to the next phase

### Parallel Opportunities

- T002 (foundational tests) can be written in parallel with T001 (baseline check), though T003 must wait for T002
- Within US1: T004, T005, T006, T007 (all test-writing tasks) can run in parallel — different files/independent assertions
- Within US2: T013, T014, T015 can run in parallel
- T021 (e2e) can be drafted in parallel with T022 (running the validation matrix) once US1 and US2 implementation is merged

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write failing test asserting co2Saved present and correct on all four windows in GetAdvancedDashboardServiceTests.cs"
Task: "Write failing test asserting zero-mile window returns Co2Saved == 0.00m in GetAdvancedDashboardServiceTests.cs"
Task: "Write failing test asserting Co2Saved unaffected by MPG/mileage-rate settings in GetAdvancedDashboardServiceTests.cs"
Task: "Write failing test asserting CO2 Saved column renders per row with correct formatting in SavingsWindowsTable.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks both stories)
3. Complete Phase 3: User Story 1 (CO2 totals per window)
4. **STOP and VALIDATE**: Confirm CO2 totals render correctly for all four windows, including the zero-mile case
5. This alone satisfies FR-001–FR-003 and FR-006 and is demoable as the MVP

### Incremental Delivery

1. Complete Setup + Foundational → pure CO2 calculation ready and unit-tested
2. Add User Story 1 → test independently → CO2 totals visible (MVP)
3. Add User Story 2 → test independently → per-mile figure visible, SC-003 cross-check passes
4. Add Polish → e2e coverage + full quickstart validation

### Notes

- Both user stories are P1 in spec.md — there is no P2/P3 phase for this feature
- [P] tasks = different files/assertions, no dependencies
- [Story] label maps each task to US1 or US2 for traceability
- Verify tests fail before implementing (TDD is constitution-mandated for this repo)
- No new persistence, migrations, or storage schema are introduced by any task
- Commit after each task or logical group; stop at either checkpoint to validate independently
