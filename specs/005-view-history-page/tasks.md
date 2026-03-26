# Tasks: Ride History Page

**Input**: Design documents from `/specs/005-view-history-page/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are required for this feature because the plan and constitution mandate a strict TDD red-green-refactor workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align contracts and scaffolding for history-query vertical slice.

- [X] T001 Verify and finalize ride history query contract in specs/005-view-history-page/contracts/ride-history-api.yaml
- [X] T002 Add API request/response DTO contracts for ride history in src/BikeTracking.Api/Contracts/RidesContracts.cs
- [X] T003 [P] Add frontend ride history API types in src/BikeTracking.Frontend/src/services/ridesService.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that must exist before user-story implementation.

- [X] T004 Add backend query service for paged ride history and summaries in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T005 Add backend date-range validation helper for inclusive bounds and invalid-range handling in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T006 Wire GET /api/rides/history endpoint shell and auth requirement in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T007 [P] Add frontend rides history fetch function and query parameter serializer in src/BikeTracking.Frontend/src/services/ridesService.ts
- [X] T008 [P] Add shared mileage formatting utility for summary cards and totals in src/BikeTracking.Frontend/src/pages/miles/history-page.helpers.ts

**Checkpoint**: Foundation ready. User story development can proceed.

---

## Phase 3: User Story 1 - View Ride History with Summary Stats (Priority: P1) 🎯 MVP

**Goal**: Show authenticated rider history page with this-month, this-year, and all-time summary visuals plus ride grid rows.

**Independent Test**: Navigate to history page with seeded rides and verify three summary tiles and ride rows render; verify no-rides state shows zeros and empty grid message.

### Tests for User Story 1 (TDD - write and fail first)

- [X] T009 [P] [US1] Add endpoint test for GET /api/rides/history success response shape in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T010 [P] [US1] Add application test for month/year/all-time summary aggregation in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T011 [P] [US1] Add frontend page test for summary tiles and initial grid render in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T012 [P] [US1] Add frontend service test for history API result mapping in src/BikeTracking.Frontend/src/services/ridesService.test.ts
- [X] T013 [US1] Run backend and frontend tests to capture failing baseline for US1 in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs

### Implementation for User Story 1

- [X] T014 [US1] Implement GET /api/rides/history endpoint handler and response mapping in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T015 [US1] Implement ride history query and summary computation in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T016 [P] [US1] Add history page route composition in src/BikeTracking.Frontend/src/App.tsx
- [X] T017 [P] [US1] Create reusable summary card component with visual variants in src/BikeTracking.Frontend/src/components/mileage-summary-card/mileage-summary-card.tsx
- [X] T018 [P] [US1] Add summary card styles in src/BikeTracking.Frontend/src/components/mileage-summary-card/mileage-summary-card.css
- [X] T019 [US1] Create history page with summary section and ride grid base rendering in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T020 [US1] Add history page styles including empty-state layout in src/BikeTracking.Frontend/src/pages/HistoryPage.css
- [X] T021 [US1] Integrate history data fetch and initial render state handling in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T022 [US1] Ensure no-rides behavior returns zero summaries and empty rows in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T023 [US1] Re-run US1 tests to green and refactor safely in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

**Checkpoint**: User Story 1 is independently functional as MVP.

---

## Phase 4: User Story 2 - Filter Rides by Date Range and See Filtered Total (Priority: P2)

**Goal**: Allow inclusive date-range filtering of history grid and show filtered total miles.

**Independent Test**: Apply a date range that includes a subset of rides and verify visible rows and filtered total match that subset.

### Tests for User Story 2 (TDD - write and fail first)

- [X] T024 [P] [US2] Add endpoint test for from/to query handling and 400 on invalid range in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T025 [P] [US2] Add application test for filtered total and row selection in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T026 [P] [US2] Add frontend test for date filter controls and filtered total rendering in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T027 [US2] Run backend and frontend tests to capture failing baseline for US2 in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs

### Implementation for User Story 2

- [X] T028 [US2] Implement inclusive from/to filtering and invalid-range response behavior in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T029 [US2] Update rides history endpoint to bind and validate filter query params in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T030 [US2] Add history page date range controls and local validation messaging in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T031 [US2] Implement filtered total section bound to API response in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T032 [US2] Implement clear-filter behavior to restore full history and total in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T033 [US2] Add filter and total styles for mobile and desktop layouts in src/BikeTracking.Frontend/src/pages/HistoryPage.css
- [X] T034 [US2] Re-run US2 tests to green and refactor safely in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 5: User Story 3 - Dashboard Mileage Widgets (Priority: P3)

**Goal**: Reuse summary card components to show all-time and year-to-date mileage on dashboard shell.

**Independent Test**: Open dashboard/miles shell and verify all-time and year-to-date cards render and match history summary values.

### Tests for User Story 3 (TDD - write and fail first)

- [X] T035 [P] [US3] Add frontend test for dashboard summary card reuse and values in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.test.tsx
- [X] T036 [P] [US3] Add frontend service test covering dashboard summary data usage in src/BikeTracking.Frontend/src/services/ridesService.test.ts
- [X] T037 [US3] Run frontend tests to capture failing baseline for US3 in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.test.tsx

### Implementation for User Story 3

- [X] T038 [US3] Integrate reusable summary cards into dashboard shell page in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.tsx
- [X] T039 [US3] Add dashboard summary loading logic using rides history service in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.tsx
- [X] T040 [US3] Add dashboard summary card layout styles in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.css
- [X] T041 [US3] Re-run US3 tests to green and refactor safely in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.test.tsx

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality, verification, and consistency checks across stories.

- [ ] T042 [P] Add API endpoint sample usage and edge-case examples in src/BikeTracking.Api/BikeTracking.Api.http
- [ ] T043 Run backend verification suite in BikeTracking.slnx
- [ ] T044 Run frontend lint/build/unit verification in src/BikeTracking.Frontend/package.json
- [ ] T045 Run frontend e2e verification for history/dashboard flow in src/BikeTracking.Frontend/tests/e2e/record-ride.spec.ts
- [ ] T046 [P] Update quickstart execution notes with any implementation-specific command deltas in specs/005-view-history-page/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup; blocks all user-story work.
- User Story phases (Phase 3-5): Depend on Foundational completion.
- Polish (Phase 6): Depends on completion of all selected user stories.

### User Story Dependencies

- US1 (P1): Starts after Phase 2; no dependency on other stories.
- US2 (P2): Starts after Phase 2; depends functionally on shared history page but remains independently testable.
- US3 (P3): Starts after Phase 2 and reuses summary component from US1.

### Within Each User Story

- Write tests first and run to confirm failure before implementation.
- Implement backend query behavior before UI integration that depends on it.
- Complete story-level test pass before moving to the next story.

## Parallel Opportunities

- Phase 1: T003 can run in parallel with T001-T002.
- Phase 2: T007 and T008 can run in parallel with backend foundational tasks.
- US1: T009-T012 test creation can run in parallel; T017 and T018 can run in parallel.
- US2: T024-T026 can run in parallel.
- US3: T035 and T036 can run in parallel.
- Phase 6: T042 and T046 can run in parallel with verification runs.

## Parallel Example: User Story 1

```bash
# Parallel test creation
T009 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
T010 src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
T011 src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
T012 src/BikeTracking.Frontend/src/services/ridesService.test.ts

# Parallel component work
T017 src/BikeTracking.Frontend/src/components/mileage-summary-card/mileage-summary-card.tsx
T018 src/BikeTracking.Frontend/src/components/mileage-summary-card/mileage-summary-card.css
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phases 1-2.
2. Deliver US1 with tests green.
3. Validate MVP on history page before proceeding.

### Incremental Delivery

1. Add US2 filtering and filtered total; verify independently.
2. Add US3 dashboard card reuse; verify independently.
3. Complete Phase 6 verification and polish.

### Parallel Team Strategy

1. One developer focuses backend query and endpoint tasks.
2. One developer focuses history UI and reusable summary component.
3. One developer focuses dashboard reuse and test automation after shared components stabilize.

## Notes

- All tasks use required checklist format: `- [ ] T### [P] [US#] Description with path`.
- `[P]` indicates file-level independence for parallel execution.
- User story labels are applied only to user-story phases.
- Avoid editing generated binary/output paths (`bin/`, `obj/`, `dist/`, `node_modules/`).
