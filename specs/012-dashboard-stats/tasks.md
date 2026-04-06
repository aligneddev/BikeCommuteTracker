# Tasks: Rider Dashboard Statistics

**Input**: Design documents from `/specs/012-dashboard-stats/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required for this feature because the plan and quickstart define a strict TDD workflow.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the dashboard-specific frontend dependency and prepare the shared visualization foundation.

- [x] T001 Add the `recharts` dependency in `src/BikeTracking.Frontend/package.json` and `src/BikeTracking.Frontend/package-lock.json`
- [x] T002 Create the shared ShadCN-style chart wrapper in `src/BikeTracking.Frontend/src/components/ui/chart.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the shared contracts and persistence model that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create the dashboard API contracts in `src/BikeTracking.Api/Contracts/DashboardContracts.cs`
- [x] T004 Extend dashboard preference fields in `src/BikeTracking.Api/Contracts/UsersContracts.cs`
- [x] T005 [P] Add ride snapshot fields in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs`
- [x] T006 [P] Add dashboard preference fields in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/UserSettingsEntity.cs`
- [x] T007 Configure snapshot and preference persistence in `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`
- [x] T008 Create the EF Core migration in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [x] T009 Add migration coverage for the new migration in `src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs`

**Checkpoint**: Foundation ready. Core dashboard, historical accuracy, and optional metric work can now proceed.

---

## Phase 3: User Story 1 - View core dashboard statistics (Priority: P1) 🎯 MVP

**Goal**: Replace the current miles landing page with a real dashboard that shows baseline mileage, savings, averages, and trend charts.

**Independent Test**: Sign in as a rider with seeded ride history and verify the main page shows current-month miles, year-to-date miles, all-time miles, average temperature, average miles per ride, average ride duration, and baseline trend charts.

### Tests for User Story 1 ⚠️

> **NOTE**: Write these tests first, ensure they fail, and get user confirmation before implementation.

- [x] T010 [US1] Add dashboard aggregation unit tests in `src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs`
- [x] T011 [US1] Add dashboard endpoint tests in `src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs`
- [x] T012 [US1] Add dashboard API client tests in `src/BikeTracking.Frontend/src/services/dashboard-api.test.ts`
- [x] T013 [US1] Add dashboard page rendering tests in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx`
- [x] T014 [US1] Add dashboard landing and totals E2E coverage in `src/BikeTracking.Frontend/tests/e2e/dashboard.spec.ts`

### Implementation for User Story 1

- [x] T015 [US1] Implement dashboard aggregation logic in `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs`
- [x] T016 [US1] Implement the dashboard endpoint in `src/BikeTracking.Api/Endpoints/DashboardEndpoints.cs`
- [x] T017 [US1] Register dashboard services and endpoint mapping in `src/BikeTracking.Api/Program.cs`
- [x] T018 [US1] Implement the dashboard API client in `src/BikeTracking.Frontend/src/services/dashboard-api.ts`
- [x] T019 [US1] Create dashboard summary card and metric components in `src/BikeTracking.Frontend/src/components/dashboard/dashboard-summary-card.tsx`
- [x] T020 [US1] Create dashboard chart section components in `src/BikeTracking.Frontend/src/components/dashboard/dashboard-chart-section.tsx`
- [x] T021 [US1] Create dashboard empty and partial-data callouts in `src/BikeTracking.Frontend/src/components/dashboard/dashboard-status-panel.tsx`
- [x] T022 [US1] Build the dashboard page layout in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx`
- [x] T023 [US1] Implement dashboard styling in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.css`
- [x] T024 [US1] Make the dashboard the authenticated main page in `src/BikeTracking.Frontend/src/App.tsx`
- [x] T025 [US1] Update the main navigation links for the new dashboard route in `src/BikeTracking.Frontend/src/components/app-header/app-header.tsx`
- [x] T026 [US1] Replace the legacy miles page with a redirect shell in `src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.tsx`

**Checkpoint**: User Story 1 is independently functional when an authenticated rider lands on the dashboard and sees baseline cards, averages, and charts without using ride history.

---

## Phase 4: User Story 2 - Keep historical calculations accurate when settings change (Priority: P2)

**Goal**: Preserve historically accurate savings and progress calculations by snapshotting calculation-relevant settings on every ride and using those snapshots in dashboard aggregation.

**Independent Test**: Record a ride, change savings-related user settings, record or edit another ride, and verify the dashboard keeps older ride savings anchored to the original snapshot while newer rides use the updated values.

### Tests for User Story 2 ⚠️

- [x] T027 [US2] Extend ride write-service tests for snapshot capture in `src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs`
- [x] T028 [US2] Add snapshot persistence coverage in `src/BikeTracking.Api.Tests/Infrastructure/RidesPersistenceTests.cs`
- [x] T029 [US2] Add historical-savings stability E2E coverage in `src/BikeTracking.Frontend/tests/e2e/dashboard.spec.ts`

### Implementation for User Story 2

- [x] T030 [US2] Add snapshot fields to recorded ride events in `src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs`
- [x] T031 [US2] Add snapshot fields to edited ride events in `src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs`
- [x] T032 [US2] Capture calculation snapshots during ride creation in `src/BikeTracking.Api/Application/Rides/RecordRideService.cs`
- [x] T033 [US2] Refresh calculation snapshots during ride edits in `src/BikeTracking.Api/Application/Rides/EditRideService.cs`
- [x] T034 [US2] Apply snapshot-first and legacy fallback rules in `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs`

**Checkpoint**: User Story 2 is independently functional when changing user settings no longer rewrites prior ride savings in the dashboard.

---

## Phase 5: User Story 3 - Review optional metrics before adding them (Priority: P3)

**Goal**: Let riders approve gallons avoided and goal progress before those optional metrics appear on the dashboard.

**Independent Test**: Open settings or the dashboard suggestion flow, approve gallons avoided and goal progress, then reload the dashboard and verify those metrics appear only after approval.

### Tests for User Story 3 ⚠️

- [x] T035 [US3] Extend user settings service tests for dashboard approvals in `src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs`
- [x] T036 [US3] Extend user settings endpoint tests for dashboard approvals in `src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs`
- [x] T037 [US3] Extend settings page approval tests in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx`
- [x] T038 [US3] Add optional-metric approval E2E coverage in `src/BikeTracking.Frontend/tests/e2e/dashboard.spec.ts`

### Implementation for User Story 3

- [x] T039 [US3] Persist dashboard approval fields in `src/BikeTracking.Api/Application/Users/UserSettingsService.cs`
- [x] T040 [US3] Accept and return dashboard approval fields in `src/BikeTracking.Api/Endpoints/UsersEndpoints.cs`
- [x] T041 [US3] Extend frontend user settings DTOs in `src/BikeTracking.Frontend/src/services/users-api.ts`
- [x] T042 [US3] Add gallons avoided and goal progress approval controls in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx`
- [x] T043 [US3] Render optional metric suggestions and approved metrics in `src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx`

**Checkpoint**: User Story 3 is independently functional when optional metrics stay hidden until approved and appear only after rider opt-in.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across stories.

- [x] T044 [P] Update manual API examples for dashboard and settings approvals in `src/BikeTracking.Api/BikeTracking.Api.http`
- [x] T045 Code cleanup and shared helper refactoring in `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs`
- [x] T046 [P] Run full validation from `specs/012-dashboard-stats/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the MVP dashboard.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and integrates with the dashboard introduced in User Story 1.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and integrates with the dashboard/settings surfaces introduced in User Story 1.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No user-story dependency after Foundation. This is the MVP.
- **User Story 2 (P2)**: Uses the dashboard delivered in US1 to prove historical-accuracy behavior, so it should be completed after US1.
- **User Story 3 (P3)**: Uses the dashboard and settings surfaces from US1, so it should be completed after US1.

### Within Each User Story

- Test tasks must be written and run red before implementation.
- Backend contracts and persistence come before service implementation.
- Backend API client work comes before page integration.
- Route/navigation changes happen after the dashboard page can render usable data.

### Parallel Opportunities

- In Phase 2, `T005` and `T006` can run in parallel because they touch different entity files.
- After foundational work, backend and frontend tests for US1 can proceed independently.
- US2 and US3 can be developed in parallel after US1 if team capacity allows, since one focuses on ride/event snapshots and the other on optional metric approvals.
- Polish tasks `T044` and `T046` can run in parallel with final cleanup if the feature code is already stable.

---

## Parallel Example: User Story 1

```bash
# Backend-first red tests:
Task: "Add dashboard aggregation unit tests in src/BikeTracking.Api.Tests/Application/Dashboard/GetDashboardServiceTests.cs"
Task: "Add dashboard endpoint tests in src/BikeTracking.Api.Tests/Endpoints/DashboardEndpointsTests.cs"

# Frontend red tests:
Task: "Add dashboard API client tests in src/BikeTracking.Frontend/src/services/dashboard-api.test.ts"
Task: "Add dashboard page rendering tests in src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.test.tsx"
```

## Parallel Example: User Story 2

```bash
# Historical-accuracy verification work:
Task: "Extend ride write-service tests for snapshot capture in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs"
Task: "Add snapshot persistence coverage in src/BikeTracking.Api.Tests/Infrastructure/RidesPersistenceTests.cs"
```

## Parallel Example: User Story 3

```bash
# Optional-metric approval tests:
Task: "Extend user settings service tests for dashboard approvals in src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs"
Task: "Extend settings page approval tests in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate the dashboard as the new authenticated landing page.

### Incremental Delivery

1. Deliver the baseline dashboard in US1.
2. Add historically accurate savings snapshots in US2.
3. Add optional metric approvals and gated rendering in US3.
4. Finish with polish and full quickstart validation.

### Parallel Team Strategy

1. One developer handles persistence/contracts while another prepares frontend chart infrastructure during Setup/Foundation where possible.
2. After US1 is stable, one developer can implement snapshot accuracy (US2) while another implements optional metric approvals (US3).
3. Merge only after the full validation pass in Phase 6.

---

## Notes

- `[P]` tasks are limited to work that does not touch the same file and does not depend on incomplete prior tasks.
- Each user story remains independently testable at its checkpoint.
- The task order assumes the repository’s strict TDD workflow: red tests, user confirmation, then implementation.
- `T008` intentionally targets the migrations directory path because the timestamped filename is not known until the migration is generated.