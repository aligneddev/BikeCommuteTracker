# Tasks: Improve Ride Entry Preset Options

**Feature**: `020-improve-ride-preset-options`  
**Branch**: `020-improve-ride-preset-options`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Generated**: 2026-04-29  
**Design inputs**: spec.md, plan.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable task (different files, no dependency on incomplete task)
- **[US1/US2/US3]**: User story label
- Every task includes concrete repository file targets
- Tests are mandatory for this feature and must run RED before implementation and GREEN after implementation

---

## Phase 1: Setup (Shared Context)

**Purpose**: Baseline checks and feature scaffolding alignment before schema/API/UI changes.

- [ ] T001 Validate baseline build/test commands and capture pre-change status in `specs/020-improve-ride-preset-options/quickstart.md`
- [ ] T002 Add implementation notes section for task checkpoints and commit boundaries in `specs/020-improve-ride-preset-options/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persisted preset model + core API contracts and service wiring that all stories depend on.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [ ] T003 Create `RidePresetEntity` with rider scope, exact start time, period tag, duration, MRU fields, and concurrency token in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RidePresetEntity.cs`
- [ ] T004 [P] Register `DbSet<RidePresetEntity>`, unique rider+name index, MRU index, and field constraints in `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`
- [ ] T005 [P] Extend ride-create contract with optional `selectedPresetId` and add preset DTO/request/response records in `src/BikeTracking.Api/Contracts/RidesContracts.cs`
- [ ] T006 Add preset service interfaces and implementations for list/create/update/delete + rider authorization checks in `src/BikeTracking.Api/Application/Rides/RidePresetService.cs`
- [ ] T007 Register preset services in DI container in `src/BikeTracking.Api/Program.cs`
- [ ] T008 Generate EF Core migration for `RidePresets` table and indexes in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [ ] T009 [P] Add backend persistence tests for unique rider-scoped names, exact `HH:mm` time parsing/storage, and rider isolation in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsSqliteIntegrationTests.cs`
- [ ] T010 Run foundational persistence tests GREEN and document output in `specs/020-improve-ride-preset-options/quickstart.md`

**Checkpoint**: Preset persistence/contracts/services exist and pass foundational persistence validation.

---

## Phase 3: User Story 1 - Configure Ride Presets in Settings (Priority: P1) 🎯 MVP

**Goal**: Riders can reach settings from username menu and perform full preset CRUD with exact start time persisted.

**Independent Test**: Navigate from username menu to settings, create/edit/delete presets, reload page, and confirm persisted values.

### Tests for User Story 1 (RED Gate Required)

- [ ] T011 [P] [US1] Add failing API tests for `GET/POST/PUT/DELETE /api/rides/presets` including duplicate-name rejection and exact time roundtrip in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`
- [ ] T012 [P] [US1] Add failing settings-page tests for preset CRUD UI and persisted reload behavior in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx`
- [ ] T013 [US1] Run US1 RED test gate (`dotnet test` and `npm run test:unit` filtered suites) and record failing assertions in `specs/020-improve-ride-preset-options/quickstart.md`

### Implementation for User Story 1

- [ ] T014 [US1] Map preset CRUD endpoints (`GET/POST/PUT/DELETE /api/rides/presets`) with rider auth and contract validation in `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`
- [ ] T015 [US1] Add preset contract mapping and validation helpers (`periodTag`, exact `HH:mm`, duration bounds) in `src/BikeTracking.Api/Contracts/RidesContracts.cs`
- [ ] T016 [US1] Add settings-page preset section with list/create/edit/delete forms in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx`
- [ ] T017 [P] [US1] Add settings-page styling for preset section states (empty/list/edit/delete confirm) in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.css`
- [ ] T018 [US1] Extend ride service API client with preset CRUD methods and typed models in `src/BikeTracking.Frontend/src/services/ridesService.ts`
- [ ] T019 [US1] Ensure username menu exposes settings navigation for click and hover interaction paths in `src/BikeTracking.Frontend/src/components/app-header/app-header.tsx`

### Verification for User Story 1 (GREEN Gate Required)

- [ ] T020 [US1] Run US1 backend GREEN suite for preset endpoint tests and capture pass output in `specs/020-improve-ride-preset-options/quickstart.md`
- [ ] T021 [US1] Run US1 frontend GREEN suite for settings preset tests and capture pass output in `specs/020-improve-ride-preset-options/quickstart.md`

**Checkpoint**: US1 independently shippable (preset CRUD in settings with exact start time persistence).

---

## Phase 4: User Story 2 - Apply Presets During Ride Entry (Priority: P1)

**Goal**: Ride entry uses saved presets ordered by MRU, applies preset values, and removes legacy quick-entry behavior.

**Independent Test**: Create multiple presets, record rides using selected presets, confirm MRU reorder after successful save, and confirm legacy quick-entry UI is absent.

### Tests for User Story 2 (RED Gate Required)

- [ ] T022 [P] [US2] Add failing API tests for MRU ordering (`lastUsedAtUtc DESC`), post-save MRU update, and selected-preset ownership enforcement in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsSqliteIntegrationTests.cs`
- [ ] T023 [P] [US2] Add failing record-ride page tests for preset apply (direction + exact time + duration), manual override behavior, and no-legacy-quick-entry rendering in `src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx`
- [ ] T024 [P] [US2] Add failing service tests for rides API preset fetch and ride submit payload with `selectedPresetId` in `src/BikeTracking.Frontend/src/services/ridesService.test.ts`
- [ ] T025 [US2] Run US2 RED test gate and capture failing assertions in `specs/020-improve-ride-preset-options/quickstart.md`

### Implementation for User Story 2

- [ ] T026 [US2] Update preset listing service query to return MRU order (`LastUsedAtUtc DESC`, `UpdatedAtUtc DESC`) in `src/BikeTracking.Api/Application/Rides/RidePresetService.cs`
- [ ] T027 [US2] Extend ride save flow to update preset `LastUsedAtUtc` only after successful ride persistence when `selectedPresetId` is provided in `src/BikeTracking.Api/Application/Rides/RecordRideService.cs`
- [ ] T028 [US2] Remove legacy quick-options endpoint mapping from rides API surface in `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`
- [ ] T029 [US2] Delete legacy backend quick-options service implementation in `src/BikeTracking.Api/Application/Rides/GetQuickRideOptionsService.cs`
- [ ] T030 [US2] Remove legacy quick-options contracts/types from rides contracts in `src/BikeTracking.Api/Contracts/RidesContracts.cs`
- [ ] T031 [US2] Add ride-entry preset selector, apply action, and local form population for direction/exact start time/duration in `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`
- [ ] T032 [P] [US2] Extend rides client for `getRidePresets` and include optional `selectedPresetId` in ride submit request in `src/BikeTracking.Frontend/src/services/ridesService.ts`
- [ ] T033 [US2] Remove legacy quick-entry UI section and related fetch/apply flow from ride-entry page in `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`
- [ ] T034 [US2] Remove quick-entry usage path from history/edit interactions if referenced by legacy code in `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`

### Verification for User Story 2 (GREEN Gate Required)

- [ ] T035 [US2] Run US2 backend GREEN suite for MRU ordering and post-save update behavior and record pass output in `specs/020-improve-ride-preset-options/quickstart.md`
- [ ] T036 [US2] Run US2 frontend GREEN suites for record-ride preset apply and legacy quick-entry removal and record pass output in `specs/020-improve-ride-preset-options/quickstart.md`

**Checkpoint**: US2 independently shippable (preset apply + MRU behavior + legacy quick-entry deletion).

---

## Phase 5: User Story 3 - Support Routine Direction Defaults (Priority: P2)

**Goal**: Settings preset form suggests Morning -> SW and Afternoon -> NE defaults while preserving user override.

**Independent Test**: In settings preset form choose morning/afternoon tags, verify default direction suggestions appear, override direction and save successfully.

### Tests for User Story 3 (RED Gate Required)

- [ ] T037 [P] [US3] Add failing settings-page tests for period-tag direction suggestions (morning SW, afternoon NE) and override persistence in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx`
- [ ] T038 [P] [US3] Add failing API tests proving override values are accepted and persisted independent of suggested defaults in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`
- [ ] T039 [US3] Run US3 RED test gate and capture failing assertions in `specs/020-improve-ride-preset-options/quickstart.md`

### Implementation for User Story 3

- [ ] T040 [US3] Add preset-form default suggestion logic keyed by `periodTag` while preserving manual overrides in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx`
- [ ] T041 [P] [US3] Add helper constants/types for period-tag defaults and direction options in `src/BikeTracking.Frontend/src/services/ridesService.ts`
- [ ] T042 [US3] Ensure backend accepts rider-selected direction regardless of default suggestion source in `src/BikeTracking.Api/Application/Rides/RidePresetService.cs`

### Verification for User Story 3 (GREEN Gate Required)

- [ ] T043 [US3] Run US3 backend GREEN tests for override acceptance and capture output in `specs/020-improve-ride-preset-options/quickstart.md`
- [ ] T044 [US3] Run US3 frontend GREEN tests for default suggestion + override flows and capture output in `specs/020-improve-ride-preset-options/quickstart.md`

**Checkpoint**: US3 independently shippable (direction defaults are helpful but never restrictive).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end hardening, regression checks, and verification matrix execution.

- [ ] T045 [P] Add/update E2E flow covering settings preset CRUD, ride-entry preset apply, MRU reorder after save, and no legacy quick-entry UI in `src/BikeTracking.Frontend/tests/e2e/record-ride.spec.ts`
- [ ] T046 [P] Update backend endpoint integration coverage for unauthorized and cross-rider preset access attempts in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsSqliteIntegrationTests.cs`
- [ ] T047 [P] Run backend full test suite and capture results in `specs/020-improve-ride-preset-options/quickstart.md`
- [ ] T048 [P] Run frontend lint/build/unit suite and capture results in `specs/020-improve-ride-preset-options/quickstart.md`
- [ ] T049 Run E2E suite and confirm key success criteria evidence (preset apply speed and zero legacy quick-entry visibility) in `specs/020-improve-ride-preset-options/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1, blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 and US1 contracts/service availability
- **Phase 5 (US3)**: Depends on Phase 3 settings preset form foundation
- **Phase 6 (Polish)**: Depends on completion of all user stories

### User Story Dependencies

- **US1 (P1)**: Independent after foundation; delivers MVP
- **US2 (P1)**: Depends on preset CRUD artifacts from US1 but is independently testable once those exist
- **US3 (P2)**: Depends on settings preset UI from US1; independently testable suggestion/override behavior

### Within Each User Story

- RED tests must be written and executed before implementation tasks
- Backend contract/service changes before endpoint mapping
- Frontend service typing before UI integration
- GREEN verification tasks must pass before story checkpoint

---

## Parallel Opportunities

- Phase 2: T004 + T005 + T009 can run in parallel after T003 starts
- US1: T011 and T012 can run in parallel; T017 can run in parallel with T016/T018
- US2: T022 + T023 + T024 can run in parallel; T032 can run in parallel with T031 after API contract is stable
- US3: T037 and T038 can run in parallel; T041 can run in parallel with T040
- Phase 6: T045 + T046 + T047 + T048 can run in parallel, then T049

---

## Parallel Execution Examples by User Story

### User Story 1

- Run in parallel: T011 and T012 (RED tests)
- Run in parallel: T016 and T018 and T017 (settings UI + service + styling)

### User Story 2

- Run in parallel: T022 and T023 and T024 (RED tests)
- Run in parallel: T031 and T032 (UI apply flow + service payload typing)

### User Story 3

- Run in parallel: T037 and T038 (RED tests)
- Run in parallel: T040 and T041 (UI suggestion logic + constants/types)

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2
2. Complete US1 RED gate tasks (T011-T013)
3. Complete US1 implementation tasks (T014-T019)
4. Complete US1 GREEN gate tasks (T020-T021)
5. Validate and demo settings preset CRUD with exact start time persistence

### Incremental Delivery

1. Ship MVP (US1)
2. Add US2 for ride-entry apply + MRU + legacy quick-entry deletion
3. Add US3 for morning/afternoon direction defaults with override support
4. Run full polish verification matrix

### Key Clarified Requirement Coverage

- Exact preset start time persisted and reapplied: T003, T005, T011, T016, T031
- MRU ordering and update semantics (only after successful ride save): T022, T026, T027, T035
- Legacy quick-entry behavior and UI removal for all riders: T028, T029, T030, T033, T036, T049
