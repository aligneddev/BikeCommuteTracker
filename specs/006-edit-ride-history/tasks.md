# Tasks: Edit Rides in History

**Input**: Design documents from `/specs/006-edit-ride-history/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are required for this feature because plan.md and constitution gates require TDD with explicit red-green-refactor checkpoints.

**Organization**: Tasks are grouped by user story to support independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align contracts and project scaffolding for the ride-edit command slice.

- [X] T001 Finalize edit endpoint contract and response codes in specs/006-edit-ride-history/contracts/ride-edit-api.yaml
- [X] T002 Finalize immutable event contract schema in specs/006-edit-ride-history/contracts/ride-edited-event.schema.json
- [X] T003 Add edit request/response DTO records in src/BikeTracking.Api/Contracts/RidesContracts.cs
- [X] T004 [P] Add frontend edit request/response TypeScript interfaces in src/BikeTracking.Frontend/src/services/ridesService.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend/frontend plumbing required before user-story behavior work.

**⚠️ CRITICAL**: No user-story implementation starts until this phase is complete.

- [X] T005 Add ride version field and configuration for optimistic concurrency in src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs
- [X] T006 Update EF Core model mapping for ride version persistence in src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
- [X] T007 Add RideEdited event payload model for outbox publishing in src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs
- [X] T008 Create edit application service skeleton with ownership/version checks in src/BikeTracking.Api/Application/Rides/EditRideService.cs
- [X] T009 Wire PUT /api/rides/{rideId} endpoint shell and auth requirement in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T010 Register edit service dependencies in src/BikeTracking.Api/Program.cs
- [X] T011 [P] Add ridesService editRide API function and error mapping in src/BikeTracking.Frontend/src/services/ridesService.ts
- [X] T012 [P] Add basic table row action column scaffold for edit entry in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx

**Checkpoint**: Foundation ready. User story work can proceed.

---

## Phase 3: User Story 1 - Edit a Ride from History (Priority: P1) 🎯 MVP

**Goal**: Let riders edit one history row, save it, and cancel unsaved edits.

**Independent Test**: Open history, edit one row, save valid values, verify row updates; repeat and cancel, verify original values remain.

### Tests for User Story 1 (TDD - write and fail first)

- [X] T013 [P] [US1] Add endpoint test for successful PUT /api/rides/{rideId} edit response in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T014 [P] [US1] Add application test for edit persistence and version increment in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T015 [P] [US1] Add frontend history test for entering edit mode and saving row in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T016 [P] [US1] Add frontend history test for canceling row edit and restoring original values in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T017 [US1] Run backend and frontend US1 tests to capture failing baseline in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

### Implementation for User Story 1

- [X] T018 [US1] Implement EditRideService happy-path update and RideEdited event append in src/BikeTracking.Api/Application/Rides/EditRideService.cs
- [X] T019 [US1] Implement PUT /api/rides/{rideId} handler request binding and success mapping in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T020 [US1] Extend rides API contracts with edit DTO validation attributes in src/BikeTracking.Api/Contracts/RidesContracts.cs
- [X] T021 [US1] Implement row edit state machine and single-row edit lock behavior in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T022 [US1] Implement row save/cancel UI controls and handlers in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T023 [US1] Add row edit styles for view/edit mode transitions in src/BikeTracking.Frontend/src/pages/HistoryPage.css
- [X] T024 [US1] Implement frontend editRide invocation and success message handling in src/BikeTracking.Frontend/src/services/ridesService.ts
- [X] T025 [US1] Re-run US1 tests to green and refactor safely in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

**Checkpoint**: User Story 1 is independently functional and demoable.

---

## Phase 4: User Story 2 - Prevent Invalid Ride Updates (Priority: P2)

**Goal**: Block invalid edits with clear validation feedback and conflict-safe error handling.

**Independent Test**: Attempt invalid edits and stale-version edits, verify save is blocked with clear messaging and editable values preserved.

### Tests for User Story 2 (TDD - write and fail first)

- [X] T026 [P] [US2] Add endpoint test for 400 validation errors on invalid edit payload in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T027 [P] [US2] Add endpoint test for 403 when editing another rider's ride in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T028 [P] [US2] Add endpoint test for 409 conflict on stale expectedVersion in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T029 [P] [US2] Add frontend test for inline field validation messages and blocked save in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T030 [P] [US2] Add frontend test for conflict error display and retry path in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T031 [US2] Run backend and frontend US2 tests to capture failing baseline in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs

### Implementation for User Story 2

- [X] T032 [US2] Implement backend validation and domain guard clauses for edit payload in src/BikeTracking.Api/Application/Rides/EditRideService.cs
- [X] T033 [US2] Implement rider ownership enforcement for edit command in src/BikeTracking.Api/Application/Rides/EditRideService.cs
- [X] T034 [US2] Implement 409 conflict response mapping with currentVersion details in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T035 [US2] Implement client-side row validation before edit submit in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T036 [US2] Implement API validation/conflict error rendering while preserving in-progress values in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T037 [US2] Add validation and conflict alert styles for edited rows in src/BikeTracking.Frontend/src/pages/HistoryPage.css
- [X] T038 [US2] Re-run US2 tests to green and refactor safely in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

**Checkpoint**: User Stories 1 and 2 are independently functional and reliable.

---

## Phase 5: User Story 3 - Keep History Totals Accurate After Edits (Priority: P3)

**Goal**: Ensure history summaries and filtered totals stay consistent after saved edits.

**Independent Test**: Edit a ride miles value with and without active date filter and verify row values, filtered total, and summary cards all refresh consistently.

### Tests for User Story 3 (TDD - write and fail first)

- [X] T039 [P] [US3] Add backend service test for summary recalculation after ride edit event in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T040 [P] [US3] Add backend endpoint test for edited values appearing in subsequent history query results in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T041 [P] [US3] Add frontend test for totals refresh after successful row edit with active filter in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
- [X] T042 [US3] Run backend and frontend US3 tests to capture failing baseline in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

### Implementation for User Story 3

- [X] T043 [US3] Apply RideEdited event changes to ride projection read model update flow in src/BikeTracking.Api/Application/Rides/EditRideService.cs
- [X] T044 [US3] Ensure history query aggregates use latest edited values in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T045 [US3] Trigger post-save history refresh preserving active filters and pagination in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T046 [US3] Update visible total and summary card rendering from refreshed server response in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T047 [US3] Re-run US3 tests to green and refactor safely in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete verification matrix, docs alignment, and end-to-end confidence checks.

- [ ] T048 [P] Add API HTTP examples for successful edit, validation error, and conflict in src/BikeTracking.Api/BikeTracking.Api.http
- [ ] T049 [P] Add or update Playwright E2E scenario for edit-from-history journey in src/BikeTracking.Frontend/tests/e2e/edit-ride-history.spec.ts
- [ ] T050 Run backend verification suite in BikeTracking.slnx
- [ ] T051 Run frontend lint/build/unit verification in src/BikeTracking.Frontend/package.json
- [ ] T052 Run frontend E2E verification for ride edit flow in src/BikeTracking.Frontend/tests/e2e/edit-ride-history.spec.ts
- [ ] T053 [P] Update implementation notes and execution guidance in specs/006-edit-ride-history/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user-story work.
- **User Stories (Phase 3-5)**: Depend on Phase 2 completion.
- **Polish (Phase 6)**: Depends on completion of all selected user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on other stories.
- **US2 (P2)**: Starts after Phase 2; builds on US1 edit flow but remains independently testable.
- **US3 (P3)**: Starts after Phase 2; depends on edit-save capability from US1 and uses shared history query behavior.

### Within Each User Story

- Tests must be written first and confirmed failing before implementation.
- Backend command/query behavior must be implemented before frontend integration that depends on it.
- Story-specific tests must pass before advancing to the next priority story.

## Parallel Opportunities

- **Phase 1**: T004 can run in parallel with T001-T003.
- **Phase 2**: T011 and T012 can run in parallel with T005-T010.
- **US1**: T013-T016 can run in parallel; T021 and T023 can run in parallel after backend contract stability.
- **US2**: T026-T030 can run in parallel.
- **US3**: T039-T041 can run in parallel.
- **Phase 6**: T048, T049, and T053 can run in parallel with verification runs.

## Parallel Example: User Story 2

```bash
# Parallel backend/frontend test creation for validation and conflict handling
T026 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
T027 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
T028 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
T029 src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
T030 src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

# Parallel implementation once endpoint error shapes are stable
T035 src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
T037 src/BikeTracking.Frontend/src/pages/HistoryPage.css
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete US1 with red-green-refactor.
3. Validate US1 independently before proceeding.

### Incremental Delivery

1. Deliver US1 (edit/save/cancel) as MVP.
2. Deliver US2 (validation + conflict handling) and validate independently.
3. Deliver US3 (totals consistency refresh) and validate independently.
4. Finish Phase 6 verification matrix and docs updates.

### Parallel Team Strategy

1. One developer owns backend edit command/event/concurrency tasks.
2. One developer owns frontend history row edit UX and validation tasks.
3. One developer owns end-to-end tests and polish tasks once shared contracts stabilize.

## Notes

- Task format follows: `- [ ] T### [P] [US#] Description with file path`.
- `[US#]` labels are used only for user-story phases.
- `[P]` tasks are limited to file-independent work.
- Avoid touching generated output folders (`bin/`, `obj/`, `node_modules/`, `playwright-report/`).
