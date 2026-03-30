# Tasks: Per-User Settings Page

**Input**: Design documents from `/specs/009-create-a-per-user/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/user-settings-api.yaml

**Tests**: Tests are included because this feature plan requires a TDD-first workflow.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align docs, API playground requests, and route scaffolding before implementation.

- [X] T001 Add settings endpoint examples to src/BikeTracking.Api/BikeTracking.Api.http
- [X] T002 Sync settings implementation notes in specs/009-create-a-per-user/quickstart.md
- [X] T003 [P] Add settings page route placeholder in src/BikeTracking.Frontend/src/App.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add contracts, persistence shape, and service wiring required by all user stories.

**⚠️ CRITICAL**: No user story work starts until this phase is complete.

- [X] T004 Add user settings request/response contracts in src/BikeTracking.Api/Contracts/UsersContracts.cs
- [X] T005 Create settings application service scaffold in src/BikeTracking.Api/Application/Users/UserSettingsService.cs
- [X] T006 Add UserSettings DbSet and model configuration in src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
- [X] T007 Create settings persistence entity in src/BikeTracking.Api/Infrastructure/Persistence/Entities/UserSettingsEntity.cs
- [X] T008 Add EF Core migration for user settings persistence in src/BikeTracking.Api/Infrastructure/Persistence/Migrations
- [X] T009 Wire UserSettingsService dependency registration in src/BikeTracking.Api/Program.cs
- [X] T010 Add GET and PUT settings endpoint mappings in src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
- [X] T011 Add frontend settings API DTOs and client methods in src/BikeTracking.Frontend/src/services/users-api.ts

**Checkpoint**: Foundation complete; user-story work can proceed.

---

## Phase 3: User Story 1 - Save Personal Ride and Cost Settings (Priority: P1) 🎯 MVP

**Goal**: Allow authenticated riders to view and save average car mpg, yearly goal, oil change price, and mileage rate.

**Independent Test**: Open settings page as an authenticated rider, save valid numeric values, refresh, and verify values persist.

### Tests for User Story 1

- [X] T012 [P] [US1] Add failing backend service tests for first-save and load behavior in src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs
- [X] T013 [P] [US1] Add failing endpoint tests for GET/PUT settings success and 401 behavior in src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs
- [X] T014 [P] [US1] Add failing frontend API transport tests for get/save user settings in src/BikeTracking.Frontend/src/services/users-api.test.ts
- [X] T015 [P] [US1] Add failing settings page tests for numeric fields load/save flow in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
- [X] T016 [US1] Run failing US1 test set and capture red results for approval via src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs and src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx

### Implementation for User Story 1

- [X] T017 [US1] Implement numeric settings load/save logic in src/BikeTracking.Api/Application/Users/UserSettingsService.cs
- [X] T018 [US1] Implement settings endpoint request handling and response mapping in src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
- [X] T019 [US1] Implement settings API client calls in src/BikeTracking.Frontend/src/services/users-api.ts
- [X] T020 [US1] Implement authenticated settings page numeric form in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
- [X] T021 [US1] Add settings page styling for numeric fields and validation states in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.css
- [X] T022 [US1] Add settings navigation entry from the miles shell in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.tsx
- [X] T023 [US1] Run US1 backend and frontend tests to green in src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs and src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx

**Checkpoint**: User Story 1 is independently functional and demoable.

---

## Phase 4: User Story 2 - Set a Personal Reference Location (Priority: P2)

**Goal**: Allow riders to select and save a location with latitude and longitude on the settings page.

**Independent Test**: Select a location, save settings, reload, and verify the same coordinates are returned and shown.

### Tests for User Story 2

- [X] T024 [P] [US2] Add failing backend validation tests for latitude/longitude bounds and pair requirements in src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs
- [X] T025 [P] [US2] Add failing endpoint tests for location save and retrieval payload shape in src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs
- [X] T026 [P] [US2] Add failing settings page tests for location picker selection and coordinate persistence in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
- [X] T027 [US2] Run failing US2 tests and capture red results for approval via src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs and src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx

### Implementation for User Story 2

- [X] T028 [US2] Implement location coordinate validation and persistence in src/BikeTracking.Api/Application/Users/UserSettingsService.cs
- [X] T029 [US2] Extend settings contracts with location label and coordinates in src/BikeTracking.Api/Contracts/UsersContracts.cs
- [X] T030 [US2] Implement location picker state and payload mapping in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
- [X] T031 [US2] Implement location label/coordinate transport handling in src/BikeTracking.Frontend/src/services/users-api.ts
- [X] T032 [US2] Run US2 tests to green in src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs and src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx

**Checkpoint**: User Story 2 is independently functional and demoable.

---

## Phase 5: User Story 3 - Update Settings Safely Over Time (Priority: P3)

**Goal**: Ensure partial updates preserve other values and enforce rider isolation.

**Independent Test**: Save full profile, update one field, verify unchanged fields persist and another rider cannot see changed data.

### Tests for User Story 3

- [X] T033 [P] [US3] Add failing backend tests for partial update preservation and cross-user isolation in src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs
- [X] T034 [P] [US3] Add failing endpoint tests for authenticated rider-scoped updates in src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs
- [X] T035 [P] [US3] Add failing frontend tests for single-field update without full re-entry in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
- [X] T036 [P] [US3] Add failing authenticated e2e settings isolation scenario in src/BikeTracking.Frontend/tests/e2e/settings.spec.ts
- [X] T037 [US3] Run failing US3 tests and capture red results for approval via src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs and src/BikeTracking.Frontend/tests/e2e/settings.spec.ts

### Implementation for User Story 3

- [X] T038 [US3] Implement partial update merge semantics in src/BikeTracking.Api/Application/Users/UserSettingsService.cs
- [X] T039 [US3] Ensure rider identity scoping in settings endpoint handlers in src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
- [X] T040 [US3] Preserve unchanged form values and clear-field behavior in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
- [X] T041 [US3] Run US3 backend/frontend/e2e tests to green in src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs and src/BikeTracking.Frontend/tests/e2e/settings.spec.ts

**Checkpoint**: User Story 3 is independently functional and demoable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency checks, docs, and full verification matrix.

- [X] T042 [P] Update settings acceptance notes and manual verification flow in specs/009-create-a-per-user/quickstart.md
- [X] T043 [P] Add settings page route/accessibility assertions in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.test.tsx
- [X] T044 Run full verification matrix commands from specs/009-create-a-per-user/quickstart.md and record outcomes in specs/009-create-a-per-user/tasks.md
- [X] T045 Add optional browser-location fill action for latitude/longitude in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
- [X] T046 Run targeted settings-page browser-location tests in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx

### Verification Results (2026-03-30)

- `dotnet test BikeTracking.slnx` -> passed (total: 95, failed: 0, succeeded: 94, skipped: 1)
- `npm run lint` -> passed
- `npm run build` -> passed
- `npm run test:unit` -> passed (test files: 10 passed, tests: 81 passed)
- `npm run test:e2e` -> passed (20 passed)

### Incremental Validation Results (2026-03-30 browser location enhancement)

- `npx vitest run src/pages/settings/SettingsPage.test.tsx` -> passed (1 file, 6 tests)
- `npm run lint` -> passed

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks all user stories.
- User Story phases (Phase 3-5) depend on Foundational completion.
- Polish (Phase 6) depends on completion of the selected user stories.

### User Story Dependencies

- **US1 (P1)** starts immediately after Phase 2 and delivers MVP.
- **US2 (P2)** depends on US1 settings page baseline and adds location behavior.
- **US3 (P3)** depends on US1/US2 persistence and endpoint behavior to validate safe updates and isolation.

### Within Each User Story

- Write tests first and run them red before implementation.
- Obtain user confirmation that red tests fail for intended behavioral reasons.
- Implement minimal code to make tests pass.
- Re-run story-specific tests to green before moving to next story.

## Parallel Opportunities

- Phase 1: T003 can run in parallel with T001-T002.
- Phase 2: T004, T005, T007 can run in parallel before wiring tasks T006/T009/T010.
- US1: T012-T015 are parallel test-authoring tasks.
- US2: T024-T026 are parallel test-authoring tasks.
- US3: T033-T036 are parallel test-authoring tasks.
- Phase 6: T042 and T043 can run in parallel.

## Parallel Example: User Story 1

```bash
# Parallel test authoring tasks:
T012 src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs
T013 src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs
T014 src/BikeTracking.Frontend/src/services/users-api.test.ts
T015 src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
```

## Parallel Example: User Story 2

```bash
# Parallel test authoring tasks:
T024 src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs
T025 src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs
T026 src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
```

## Parallel Example: User Story 3

```bash
# Parallel test authoring tasks:
T033 src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs
T034 src/BikeTracking.Api.Tests/Endpoints/UsersEndpointsTests.cs
T035 src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
T036 src/BikeTracking.Frontend/tests/e2e/settings.spec.ts
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (numeric settings load/save).
3. Validate US1 independently before continuing.

### Incremental Delivery

1. Add US2 location selection and coordinate persistence.
2. Add US3 safe partial updates and cross-user isolation.
3. Finish with Phase 6 verification and documentation.

### Parallel Team Strategy

1. One developer owns backend contracts/service/endpoint tasks.
2. One developer owns frontend page/service/routing tasks.
3. One developer owns test authoring and e2e tasks.
4. Merge per-story after red-to-green checkpoint completion.

## Notes

- [P] tasks touch separate files with no unresolved dependencies.
- [US#] labels map tasks directly to user stories.
- Each user story remains independently testable and demoable.
- Preserve additive API contract behavior; do not break existing endpoints.
