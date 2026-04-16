# Tasks: Ride Notes

**Input**: Design documents from `/specs/014-ride-notes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare implementation scaffolding and validation workflow for this feature.

- [X] T001 Prepare EF migration scaffolding for ride note column in src/BikeTracking.Api/Infrastructure/Persistence/Migrations/
- [X] T002 [P] Prepare backend TDD scaffolding for note scenarios in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T003 [P] Prepare frontend TDD scaffolding for note scenarios in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contracts and persistence changes required before any user story work.

**CRITICAL**: No user story tasks begin until this phase is complete.

- [X] T004 Add optional `Notes` field to ride persistence model in src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs
- [X] T005 Add and apply additive migration for `Rides.Notes` (nullable, max 500) in src/BikeTracking.Api/Infrastructure/Persistence/Migrations/
- [X] T006 Extend ride API contracts with optional note + 500-char validation in src/BikeTracking.Api/Contracts/RidesContracts.cs
- [X] T007 [P] Extend frontend ride DTO types with note fields in src/BikeTracking.Frontend/src/services/ridesService.ts
- [X] T008 Thread note through ride event payload contract in src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs
- [X] T009 Update migration coverage policy test for new migration in src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs

**Checkpoint**: Foundation complete; user stories can now be implemented.

---

## Phase 3: User Story 1 - Add and Edit Ride Notes (Priority: P1) MVP

**Goal**: Riders can create, edit, and clear plain-text notes (0-500 chars) on rides.

**Independent Test**: Create a ride with a note, edit the note, clear it, and confirm data persists correctly.

### Tests for User Story 1

- [X] T010 [P] [US1] Add backend failing tests for create/edit note validation and persistence in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
- [X] T011 [P] [US1] Add frontend failing tests for record form note input and max-length behavior in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx

### Implementation for User Story 1

- [X] T012 [US1] Implement note persistence and validation in record flow in src/BikeTracking.Api/Application/Rides/RecordRideService.cs
- [X] T013 [US1] Implement note persistence and validation in edit flow in src/BikeTracking.Api/Application/Rides/EditRideService.cs
- [X] T014 [US1] Add note field and client-side note validation to record ride UI in src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx
- [X] T015 [US1] Ensure note is carried through ride create/edit endpoint mapping in src/BikeTracking.Api/Endpoints/RidesEndpoints.cs

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - View Notes in Compact Ride History (Priority: P2)

**Goal**: History rows show a compact note indicator with hover/focus/tap reveal without row expansion.

**Independent Test**: View rides with and without notes; verify icon visibility rules and accessible reveal interactions.

### Tests for User Story 2

- [X] T016 [P] [US2] Add backend failing tests for note projection in history responses in src/BikeTracking.Api.Tests/Application/GetRideHistoryServiceTests.cs
- [X] T017 [P] [US2] Add frontend failing tests for note indicator and reveal interactions in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx

### Implementation for User Story 2

- [X] T018 [US2] Project note values into ride history API rows in src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
- [X] T019 [US2] Add compact note indicator and escaped note reveal interactions in src/BikeTracking.Frontend/src/pages/HistoryPage.tsx
- [X] T020 [US2] Add styles for hover/focus/tap note reveal overlay without row-height growth in src/BikeTracking.Frontend/src/pages/HistoryPage.css

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Import Notes from CSV (Priority: P2)

**Goal**: Import path accepts note values, rejects note values >500 at row level, and continues valid rows.

**Independent Test**: Import CSV with mixed valid/oversized/blank notes and verify row-level outcomes plus history visibility.

### Tests for User Story 3

- [X] T021 [P] [US3] Add backend failing tests for CSV note validation and row-level continuation in src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs
- [X] T022 [P] [US3] Add frontend failing tests for import preview note errors in src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.test.tsx

### Implementation for User Story 3

- [X] T023 [US3] Add note-length rule (`<=500`) with `NOTE_TOO_LONG` errors in src/BikeTracking.Api/Application/Imports/CsvValidationRules.cs
- [X] T024 [US3] Ensure import processing marks oversized-note rows invalid while continuing valid rows in src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs
- [X] T025 [US3] Ensure imported note values are persisted through ride-write mapping in src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs
- [X] T026 [US3] Surface note-related preview validation feedback in import UI in src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and full-stack validation.

- [X] T027 [P] Add/refresh manual API examples with note payloads in src/BikeTracking.Api/BikeTracking.Api.http
- [X] T028 Run full backend and frontend validation matrix from quickstart in specs/014-ride-notes/quickstart.md
- [X] T029 [P] Run formatting and cleanup pass for touched backend files in src/BikeTracking.Api/
- [X] T030 [P] Run formatting and cleanup pass for touched frontend files in src/BikeTracking.Frontend/src/

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): starts immediately.
- Foundational (Phase 2): depends on Setup; blocks all user stories.
- User Stories (Phases 3-5): depend on Foundational completion.
- Polish (Phase 6): depends on completing desired user stories.

### User Story Dependencies

- **US1 (P1)**: starts immediately after Foundational completion.
- **US2 (P2)**: starts after Foundational completion; does not require US3.
- **US3 (P2)**: starts after Foundational completion; reuses history note rendering from US2 for final visibility checks.

### Within Each User Story

- Tests must be written and verified failing before implementation.
- Backend contract/service changes before frontend wiring.
- Story must pass its independent test criteria before moving on.

---

## Parallel Execution Examples

### User Story 1

```bash
# Parallel test authoring
T010 in src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
T011 in src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx
```

### User Story 2

```bash
# Parallel backend/frontend test authoring
T016 in src/BikeTracking.Api.Tests/Application/GetRideHistoryServiceTests.cs
T017 in src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx
```

### User Story 3

```bash
# Parallel import test authoring
T021 in src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs
T022 in src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.test.tsx
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete US1 (Phase 3).
3. Validate US1 independently before moving to P2 stories.

### Incremental Delivery

1. Deliver US1 (note capture/edit).
2. Deliver US2 (compact history visibility).
3. Deliver US3 (import note behavior and row-level invalid handling).
4. Finish with cross-cutting polish and validation.

### Team Parallelization

1. Team aligns on Foundational tasks.
2. After Phase 2 completion:
   - Dev A: US1
   - Dev B: US2
   - Dev C: US3
3. Re-integrate in Phase 6 with full validation.
