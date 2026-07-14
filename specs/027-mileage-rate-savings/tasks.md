# Tasks: Split Savings Display Metrics

**Feature Branch**: `027-mileage-rate-savings`  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md) | **Contracts**: [contracts/dashboard-split-savings-contract.md](contracts/dashboard-split-savings-contract.md) | **Research**: [research.md](research.md) | **Quickstart**: [quickstart.md](quickstart.md)

---

## Phase 1: Setup

**Purpose**: Prepare deterministic test fixtures for split-savings work.

- [X] T001 [P] Add deterministic backend ride fixture setup for split-savings scenarios in src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs
- [X] T002 [P] Add deterministic dashboard payload fixture helper for savings-card tests in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test/contract scaffolding that blocks all user-story implementation.

- [X] T003 [P] Add split `moneySaved` contract fixture coverage for `mileageRateSavings` and `fuelCostAvoided` in src/BikeTracking.Frontend/src/services/dashboard-api.test.ts
- [X] T004 [P] Add reusable savings-row locator helper for dashboard E2E assertions in src/BikeTracking.Frontend/tests/e2e/support/expense-helpers.ts

**Checkpoint**: Foundational scaffolding complete; user story work can proceed.

---

## Phase 3: User Story 1 - View two separate savings metrics (Priority: P1) 🎯 MVP

**Goal**: Show two explicit savings lines using the defined formulas and labels, with no merged display line.

**Independent Test**: Open dashboard/results with valid ride data and verify both labels render with values from their respective formulas.

### Tests for User Story 1

- [X] T005 [P] [US1] Write failing backend tests for `configuredMileageRate * periodMiles` (settings-based) and `gallonsSaved * miles` formulas in src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs
- [X] T006 [P] [US1] Write failing dashboard rendering tests for labels "Mileage rate savings" and "Gallons-based savings" with no merged display line in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx

### Implementation for User Story 1

- [X] T007 [US1] Implement split-savings totals aggregation with spec formulas in src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs
- [X] T025 [US1] Align year-stats monthly/year totals mileage-rate math to settings-based period formula in src/BikeTracking.Api/Application/Dashboard/GetYearStatsDashboardService.cs and src/BikeTracking.Api.Tests/Application/Dashboard/GetYearStatsDashboardServiceTests.cs
- [X] T008 [US1] Render split savings rows and remove merged savings line from the target summary card in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx
- [X] T009 [US1] Align dashboard response consumption for split savings fields in src/BikeTracking.Frontend/src/services/dashboard-api.ts

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Preserve existing presentation behavior (Priority: P2)

**Goal**: Keep currency/unit formatting and rounding behavior unchanged while split metrics are displayed.

**Independent Test**: Compare dashboard output for the same ride data and confirm only metric separation changed, not formatting/rounding.

### Tests for User Story 2

- [X] T010 [P] [US2] Add failing frontend regression tests for currency formatting, rounding, and zero-value visibility on both split lines in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx
- [X] T011 [P] [US2] Add failing backend regression tests for existing rounding/null behavior on split savings totals in src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs
- [X] T021 [P] [US2] Add failing ride-entry regression coverage proving create/edit ride flow behavior and persisted ride shape are unchanged by split-savings work in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs and src/BikeTracking.Frontend/tests/e2e/record-ride.spec.ts
- [X] T023 [P] [US2] Add failing frontend edit-flow invariant coverage proving edit ride history behavior/validation is unchanged by split-savings work in src/BikeTracking.Frontend/tests/e2e/edit-ride-history.spec.ts

### Implementation for User Story 2

- [X] T012 [US2] Ensure split rows reuse existing currency formatting and render zero values in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx
- [X] T013 [US2] Preserve existing money-rounding/null-handling behavior for split fields in src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs
- [X] T022 [US2] Keep create/edit ride-entry contracts/entities/migrations unchanged and satisfy T021/T023 without adding ride-entry schema changes in src/BikeTracking.Api/Contracts and src/BikeTracking.Api/Infrastructure/Persistence/Migrations

**Checkpoint**: US2 formatting behavior is independently verified.

---

## Phase 5: User Story 3 - Keep backend/frontend validation aligned (Priority: P3)

**Goal**: Keep backend contract, frontend types, and automated tests synchronized for split-savings behavior.

**Independent Test**: Run backend, frontend, and E2E suites and confirm explicit assertions for both formulas and both labels.

### Tests for User Story 3

- [X] T014 [P] [US3] Add failing endpoint-level contract assertions for split `moneySaved` fields and explicit absence of `combinedSavings` in src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs
- [X] T015 [P] [US3] Add failing API client sync tests that remove `combinedSavings` typing/fixtures and validate split fields in src/BikeTracking.Frontend/src/services/dashboard-api.test.ts
- [X] T016 [P] [US3] Add failing E2E assertions that both split lines render together and merged savings is absent in src/BikeTracking.Frontend/tests/e2e/savings-calculation.spec.ts

### Implementation for User Story 3

- [X] T017 [US3] Update split-savings contract notes to document removal of `combinedSavings` and retain `mileageRateSavings`/`fuelCostAvoided` mapping in specs/027-mileage-rate-savings/contracts/dashboard-split-savings-contract.md
- [X] T018 [US3] Remove `combinedSavings` from frontend `DashboardMoneySaved` typing/fixtures and sync with backend contract in src/BikeTracking.Frontend/src/services/dashboard-api.ts and src/BikeTracking.Frontend/src/services/dashboard-api.test.ts
- [X] T024 [US3] Remove `combinedSavings` from backend dashboard contracts/projections and synchronize endpoint payload shape in src/BikeTracking.Api/Contracts/DashboardContracts.cs and src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs

**Checkpoint**: US3 cross-layer alignment is independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and implementation-ready handoff notes for this narrow scope.

- [X] T019 [P] Add final split-savings validation matrix and command checklist in specs/027-mileage-rate-savings/quickstart.md
- [X] T020 [P] Record post-implementation split-savings decisions and non-goals in specs/027-mileage-rate-savings/research.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2; MVP delivery phase.
- **Phase 4 (US2)**: Depends on US1 split-line implementation (Phase 3).
- **Phase 5 (US3)**: Depends on US1 contract behavior; can run in parallel with late US2 hardening once split fields are stable.
- **Phase 6 (Polish)**: Depends on completed stories.

### User Story Dependencies

- **US1 (P1)**: Starts immediately after foundational phase.
- **US2 (P2)**: Depends on US1 rendering path being in place.
- **US3 (P3)**: Depends on US1 contract/rendering semantics; largely independent of US2 styling details.

### Within Each User Story

- Write tests first and confirm they fail (TDD red).
- Implement backend/frontend updates to satisfy tests.
- Re-run story-specific tests before moving to next priority.

---

## Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel.
- **Phase 2**: T003 and T004 can run in parallel.
- **US1**: T005 and T006 can run in parallel; T007 and T008 can run in parallel after failing tests are in place.
- **US2**: T010 and T011 can run in parallel.
- **US3**: T014, T015, and T016 can run in parallel.
- **Polish**: T019 and T020 can run in parallel.

## Parallel Example: User Story 1

```bash
Task: "T005 [US1] backend formula tests in src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs"
Task: "T006 [US1] frontend label/render tests in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T014 [US3] endpoint contract assertions in src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs"
Task: "T015 [US3] API client sync tests in src/BikeTracking.Frontend/src/services/dashboard-api.test.ts"
Task: "T016 [US3] E2E assertions in src/BikeTracking.Frontend/tests/e2e/savings-calculation.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate labels/formulas and absence of merged display in dashboard/results.

### Incremental Delivery

1. Ship US1 (split metrics visible and correct).
2. Add US2 (format/rounding parity hardening).
3. Add US3 (cross-layer contract/test synchronization).

### Scope Guardrails

- Keep changes limited to split savings display and its direct backend/frontend contracts/tests.
- Do not broaden into unrelated dashboard redesign or ride-entry/storage changes.
