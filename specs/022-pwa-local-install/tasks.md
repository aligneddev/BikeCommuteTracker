# Tasks: Local PWA Installation

**Input**: Design documents from `/specs/022-pwa-local-install/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/pwa-installation-contract.md, quickstart.md

**Tests**: Tests are required for this feature (TDD gate is mandatory in spec/constitution and quickstart).

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`)
- Each task includes a concrete file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare project-level PWA assets and test scaffolding.

- [X] T001 Add PWA metadata dependency/scripts in src/BikeTracking.Frontend/package.json
- [X] T002 Create PWA manifest baseline in src/BikeTracking.Frontend/public/manifest.webmanifest
- [X] T003 [P] Add installable app icon assets in src/BikeTracking.Frontend/public/pwa-192.png and src/BikeTracking.Frontend/public/pwa-512.png
- [X] T004 [P] Extend browser API test shims for install/service-worker events in src/BikeTracking.Frontend/src/test/setup.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared runtime primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story implementation starts before this phase completes.

- [X] T005 Create shared PWA state/type definitions in src/BikeTracking.Frontend/src/services/pwa/pwa-types.ts
- [X] T006 [P] Implement supported-environment detection utility in src/BikeTracking.Frontend/src/services/pwa/environment-support.ts
- [X] T007 [P] Implement install prompt lifecycle service in src/BikeTracking.Frontend/src/services/pwa/install-service.ts
- [X] T008 [P] Implement service worker update lifecycle service in src/BikeTracking.Frontend/src/services/pwa/update-service.ts
- [X] T009 Implement launch context and network-state helper in src/BikeTracking.Frontend/src/services/pwa/launch-context.ts
- [X] T010 Implement inactivity timeout policy helper (7-day rule) in src/BikeTracking.Frontend/src/services/pwa/session-policy.ts
- [X] T011 Wire global PWA bootstrap entrypoint in src/BikeTracking.Frontend/src/main.tsx
- [X] T012 Add top-level status outlet for install/update/offline messaging in src/BikeTracking.Frontend/src/App.tsx

**Checkpoint**: Shared PWA/session/update infrastructure is ready; user stories can proceed.

---

## Phase 3: User Story 1 - Install App Locally (Priority: P1) 🎯 MVP

**Goal**: Provide Windows Chrome/Edge install flow with clear install action and installed-window behavior.

**Independent Test**: In supported Windows Chrome/Edge, user sees install action, completes install, and launches app from OS launcher into app-style window.

### Tests for User Story 1 (write first, confirm failing)

- [X] T013 [P] [US1] Add unit tests for support matrix detection in src/BikeTracking.Frontend/src/services/pwa/environment-support.test.ts
- [X] T014 [P] [US1] Add unit tests for install prompt lifecycle transitions in src/BikeTracking.Frontend/src/services/pwa/install-service.test.ts
- [X] T015 [P] [US1] Add E2E scenario for supported install flow in src/BikeTracking.Frontend/tests/e2e/pwa-install-supported.spec.ts

### Implementation for User Story 1

- [X] T016 [US1] Add manifest link/theme/start URL metadata for installability in src/BikeTracking.Frontend/index.html
- [X] T017 [US1] Create service worker registration adapter in src/BikeTracking.Frontend/src/services/pwa/register-service-worker.ts
- [X] T018 [US1] Integrate service worker registration and install bootstrap in src/BikeTracking.Frontend/src/main.tsx
- [X] T019 [US1] Add install action UI and status text in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
- [X] T020 [US1] Add app-header install state indicator component wiring in src/BikeTracking.Frontend/src/components/app-header/app-header.tsx
- [X] T021 [US1] Ensure installed-window launch context handling in src/BikeTracking.Frontend/src/services/pwa/launch-context.ts

**Checkpoint**: US1 is independently functional and installable on supported environment.

---

## Phase 4: User Story 2 - Preserve Signed-In Experience Across Launches (Priority: P2)

**Goal**: Persist auth session for up to 7 days inactivity and support automatic updates on relaunch/refresh.

**Independent Test**: User stays signed in across normal relaunches, is forced to re-authenticate after >7 days inactivity, and sees update lifecycle messaging during auto-update.

### Tests for User Story 2 (write first, confirm failing)

- [ ] T022 [P] [US2] Add unit tests for inactivity expiration calculation in src/BikeTracking.Frontend/src/services/pwa/session-policy.test.ts
- [ ] T023 [P] [US2] Add unit tests for update lifecycle state transitions in src/BikeTracking.Frontend/src/services/pwa/update-service.test.ts
- [ ] T024 [P] [US2] Add E2E scenario for 7-day inactivity re-authentication in src/BikeTracking.Frontend/tests/e2e/pwa-session-timeout.spec.ts
- [ ] T025 [P] [US2] Add E2E scenario for automatic update on relaunch/refresh in src/BikeTracking.Frontend/tests/e2e/pwa-auto-update.spec.ts

### Implementation for User Story 2

- [ ] T026 [US2] Persist and refresh activity timestamps in auth state management in src/BikeTracking.Frontend/src/context/auth-context.tsx
- [ ] T027 [US2] Enforce inactivity expiration gate before protected routes render in src/BikeTracking.Frontend/src/components/protected-route.tsx
- [ ] T028 [US2] Update authenticated API usage to refresh activity timestamp in src/BikeTracking.Frontend/src/services/users-api.ts
- [ ] T029 [P] [US2] Update ride API usage to refresh activity timestamp in src/BikeTracking.Frontend/src/services/ridesService.ts
- [ ] T030 [US2] Add update status banner messaging (checking/downloading/failed) in src/BikeTracking.Frontend/src/components/app-header/app-header.tsx

**Checkpoint**: US2 is independently functional with session timeout and update messaging.

---

## Phase 5: User Story 3 - Handle Unsupported Install Environments Gracefully (Priority: P3)

**Goal**: Keep browser usage available with explicit unsupported-environment and offline guidance.

**Independent Test**: In unsupported environment or offline installed mode, app clearly explains limitation and keeps core browser flow available.

### Tests for User Story 3 (write first, confirm failing)

- [ ] T031 [P] [US3] Add unit test coverage for unsupported-environment guidance rendering in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx
- [ ] T032 [P] [US3] Add E2E scenario for unsupported OS/browser guidance and fallback in src/BikeTracking.Frontend/tests/e2e/pwa-unsupported-environment.spec.ts
- [ ] T033 [P] [US3] Add E2E scenario for installed-mode offline connectivity-required behavior in src/BikeTracking.Frontend/tests/e2e/pwa-offline-guard.spec.ts

### Implementation for User Story 3

- [ ] T034 [US3] Render unsupported OS/browser guidance and browser-mode fallback text in src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
- [ ] T035 [US3] Add connectivity-required guard and retry action for ride operations in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [ ] T036 [US3] Add online/offline status wiring for guard presentation in src/BikeTracking.Frontend/src/services/pwa/launch-context.ts

**Checkpoint**: US3 is independently functional with graceful fallback behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, docs, and cross-story cleanup.

- [ ] T037 [P] Update frontend feature documentation for install/update/session behavior in src/BikeTracking.Frontend/README.md
- [ ] T038 [P] Add shared E2E helper utilities for PWA scenarios in src/BikeTracking.Frontend/tests/e2e/support/auth-helpers.ts
- [ ] T039 Run full frontend validation checklist from specs/022-pwa-local-install/quickstart.md
- [ ] T040 Run full solution regression validation via BikeTracking.slnx and capture results in specs/022-pwa-local-install/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories
- **Phase 3 (US1)**: depends on Phase 2
- **Phase 4 (US2)**: depends on Phase 2 (can run parallel with US1 after foundation)
- **Phase 5 (US3)**: depends on Phase 2 (can run parallel with US1/US2 after foundation)
- **Phase 6 (Polish)**: depends on completion of all targeted user stories

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories
- **US2 (P2)**: no strict dependency on US1, but reuses shared PWA infrastructure from Phase 2
- **US3 (P3)**: no strict dependency on US1/US2, but reuses shared PWA infrastructure from Phase 2

### Within Each User Story

- Test tasks must be authored and fail before implementation tasks begin
- Runtime service/utilities before UI wiring
- UI behavior before E2E stabilization/cleanup

### Parallel Opportunities

- Setup: T003, T004 parallel
- Foundational: T006, T007, T008 parallel after T005
- US1 tests: T013, T014, T015 parallel
- US2 tests: T022, T023, T024, T025 parallel
- US3 tests: T031, T032, T033 parallel
- Polish: T037, T038 parallel

---

## Parallel Example: User Story 1

```bash
# Parallel test authoring for US1
T013 [US1] src/BikeTracking.Frontend/src/services/pwa/environment-support.test.ts
T014 [US1] src/BikeTracking.Frontend/src/services/pwa/install-service.test.ts
T015 [US1] src/BikeTracking.Frontend/tests/e2e/pwa-install-supported.spec.ts

# Parallel implementation tasks after core wiring exists
T019 [US1] src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
T020 [US1] src/BikeTracking.Frontend/src/components/app-header/app-header.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2
2. Deliver US1 (Phase 3)
3. Validate install success path in supported environment
4. Demo/release MVP scope

### Incremental Delivery

1. Add US1 install capability
2. Add US2 session/update lifecycle
3. Add US3 unsupported/offline guidance
4. Finish polish and full regression checks

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. After Phase 2:
   - Developer A: US1
   - Developer B: US2
   - Developer C: US3
3. Merge each story when independently green

---

## Notes

- `[P]` tasks indicate file-level independence, not zero coordination.
- Keep all implementation within the declared v1 scope: Windows + Chrome/Edge install support, online-only ride operations.
- Backend API changes are out-of-scope unless strictly required for auth compatibility.
- Do not proceed to `/speckit.implement` until task tests are explicitly validated as red-first then green.
