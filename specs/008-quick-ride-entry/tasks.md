# Tasks: Quick Ride Entry from Past Rides

**Input**: Design documents from `/specs/008-quick-ride-entry/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/quick-ride-options-api.yaml

**Tests**: Tests are included because this feature plan requires a TDD-first workflow.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align feature docs and local API playground artifacts before implementation.

- [X] T001 Update API playground examples for quick options in src/BikeTracking.Api/BikeTracking.Api.http
- [X] T002 Sync quick options contract notes in specs/008-quick-ride-entry/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add core contracts and service wiring required by all user stories.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T003 Add QuickRideOption and QuickRideOptionsResponse records in src/BikeTracking.Api/Contracts/RidesContracts.cs
- [X] T004 Create query service scaffold in src/BikeTracking.Api/Application/Rides/GetQuickRideOptionsService.cs
- [X] T005 Wire GetQuickRideOptionsService registration in src/BikeTracking.Api/Program.cs
- [X] T006 Add GET /api/rides/quick-options endpoint mapping in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T007 Add frontend quick-options DTOs and API client method in src/BikeTracking.Frontend/src/services/ridesService.ts

**Checkpoint**: Foundation complete; user-story work can proceed.

---

## Phase 3: User Story 1 - Reuse a Frequent Ride Pattern (Priority: P1) 🎯 MVP

**Goal**: Let riders view quick options and prefill miles/duration from one click without auto-saving.

**Independent Test**: Open record ride, select a quick option, verify miles and duration are populated and no save occurs until submit.

### Tests for User Story 1

- [X] T008 [P] [US1] Add failing backend service tests for authenticated rider-scoped quick options retrieval in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T009 [P] [US1] Add failing endpoint tests for GET /api/rides/quick-options success and 401 behavior in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T010 [P] [US1] Add failing frontend service tests for getQuickRideOptions request/response handling in src/BikeTracking.Frontend/src/services/ridesService.test.ts
- [X] T011 [P] [US1] Add failing page tests for rendering quick options and prefilling fields on selection in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx
- [X] T012 [US1] Run failing US1 test set and capture red results for approval via src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs and src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx

### Implementation for User Story 1

- [X] T013 [US1] Implement rider-scoped quick options query logic in src/BikeTracking.Api/Application/Rides/GetQuickRideOptionsService.cs
- [X] T014 [US1] Implement GET /api/rides/quick-options handler and response mapping in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs
- [X] T015 [US1] Implement getQuickRideOptions API method in src/BikeTracking.Frontend/src/services/ridesService.ts
- [X] T016 [US1] Integrate quick options UI rendering and prefill selection behavior in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [X] T017 [US1] Run US1 backend/frontend tests to reach green in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs and src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx

**Checkpoint**: User Story 1 is independently functional and demoable.

---

## Phase 4: User Story 2 - Keep Flexibility After Prefill (Priority: P2)

**Goal**: Preserve user control to edit copied values and keep existing validation/submission behavior.

**Independent Test**: Select quick option, edit copied value, submit successfully; clear a required field and observe standard validation blocking.

### Tests for User Story 2

- [X] T018 [P] [US2] Add failing page tests proving copied values remain editable and validation still blocks invalid submit in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx
- [X] T019 [P] [US2] Add failing e2e test for select-edit-save flow in src/BikeTracking.Frontend/tests/e2e/record-ride.spec.ts
- [X] T020 [US2] Run failing US2 tests and capture red results for approval via src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx and src/BikeTracking.Frontend/tests/e2e/record-ride.spec.ts

### Implementation for User Story 2

- [X] T021 [US2] Ensure quick-option selection updates form state without auto-submit in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [X] T022 [US2] Preserve and validate editable copied fields in existing submit path in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [X] T023 [US2] Run US2 unit and e2e tests to green in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx and src/BikeTracking.Frontend/tests/e2e/record-ride.spec.ts

**Checkpoint**: User Story 2 works independently with existing validation semantics.

---

## Phase 5: User Story 3 - See Useful, Non-Duplicate Suggestions (Priority: P3)

**Goal**: Ensure quick options are distinct, capped at 5, recency-ordered, and resilient for empty/error cases.

**Independent Test**: Seed repeated and unique rides, verify no duplicate options, cap of 5, and graceful empty/failure fallback.

### Tests for User Story 3

- [X] T024 [P] [US3] Add failing backend tests for distinct pair deduplication, recency ordering, and max-5 limit in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T025 [P] [US3] Add failing endpoint tests for excluding incomplete rides and returning empty options array in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
- [X] T026 [P] [US3] Add failing frontend tests for empty and fetch-failure quick options fallback states in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx
- [X] T027 [US3] Run failing US3 tests and capture red results for approval via src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs and src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx

### Implementation for User Story 3

- [X] T028 [US3] Implement strict distinct `(miles, rideMinutes)` grouping, recency ordering, and top-5 limit in src/BikeTracking.Api/Application/Rides/GetQuickRideOptionsService.cs
- [X] T029 [US3] Exclude incomplete records and return additive empty response shape in src/BikeTracking.Api/Application/Rides/GetQuickRideOptionsService.cs
- [X] T030 [US3] Implement frontend empty/error fallback rendering for quick-entry section in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [X] T031 [US3] Refresh quick options after successful ride save in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [X] T032 [US3] Run US3 backend/frontend tests to green in src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs and src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx

**Checkpoint**: User Story 3 is independently functional with robust option quality behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, docs, and full verification across all stories.

- [X] T033 [P] Add quick options request helper coverage updates in src/BikeTracking.Frontend/tests/e2e/support/ride-helpers.ts
- [X] T034 [P] Update feature docs and acceptance notes in specs/008-quick-ride-entry/quickstart.md
- [X] T035 Run full verification matrix commands from specs/008-quick-ride-entry/quickstart.md and record results in specs/008-quick-ride-entry/tasks.md

### Verification Results

- 2026-03-30: `dotnet test BikeTracking.slnx` executed from repo root. Result: failed due to 5 pre-existing backend failures in `BikeTracking.Api.Tests.Endpoints.Rides.DeleteRideEndpointTests`, including `DeleteRide_AlreadyDeleted_ReturnsIdempotent200Ok` at `src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideEndpointTests.cs:129` during host startup.
- 2026-03-30: `cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit && npm run test:e2e` executed successfully.
- 2026-03-30: Frontend verification summary: 19 Playwright E2E tests passed; record-ride quick-entry scenarios passed, including quick-option edit-before-save.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks all user stories.
- User Story phases (Phase 3-5) depend on Foundational completion.
- Polish (Phase 6) depends on completion of the selected user stories.

### User Story Dependencies

- **US1 (P1)** starts immediately after Phase 2 and delivers MVP.
- **US2 (P2)** depends on US1 UI prefill behavior being present.
- **US3 (P3)** depends on US1 query/endpoint baseline and refines result quality and fallback behavior.

### Within Each User Story

- Write tests first and run them red before implementation.
- Implement service/endpoint/frontend behavior after red tests are approved.
- Run story-specific tests to green before moving on.

## Parallel Opportunities

- Phase 2: T003-T007 can be split by file ownership after agreeing contracts.
- US1: T008-T011 are parallel test authoring tasks.
- US2: T018 and T019 can run in parallel.
- US3: T024-T026 are parallel test authoring tasks.
- Polish: T033 and T034 can run in parallel.

## Parallel Example: User Story 1

```bash
# Parallel test authoring tasks:
T008 src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
T009 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
T010 src/BikeTracking.Frontend/src/services/ridesService.test.ts
T011 src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx
```

## Parallel Example: User Story 3

```bash
# Parallel test authoring tasks:
T024 src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
T025 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs
T026 src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (quick option retrieval + prefill without auto-save).
3. Validate US1 independently before continuing.

### Incremental Delivery

1. Add US2 to preserve editable copied values and validation behavior.
2. Add US3 to enforce distinct/limit/recency quality and fallback states.
3. Finish with Phase 6 full verification.

### Team Parallelization

1. One developer owns backend query/endpoint tasks.
2. One developer owns frontend page/service tasks.
3. One developer owns tests/e2e tasks.
4. Merge per story checkpoint after green tests.