# Tasks: Local User Signup and PIN Identity

**Input**: Design documents from `/specs/001-user-signup-pin/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: No explicit TDD or test-first request was made in the feature specification, so test tasks are not included in this task list.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature folders and configuration surfaces used by all stories.

- [X] T001 Create API feature folder structure in src/BikeTracking.Api/Endpoints/, src/BikeTracking.Api/Contracts/, src/BikeTracking.Api/Application/Users/, src/BikeTracking.Api/Application/Events/, src/BikeTracking.Api/Infrastructure/Persistence/, src/BikeTracking.Api/Infrastructure/Security/
- [X] T002 Create frontend feature folders in src/BikeTracking.Frontend/src/pages/signup/ and src/BikeTracking.Frontend/src/services/
- [X] T003 [P] Add local identity configuration placeholders in src/BikeTracking.Api/appsettings.json
- [X] T004 [P] Add development overrides for identity flow settings in src/BikeTracking.Api/appsettings.Development.json
- [X] T005 [P] Add local API/frontend orchestration updates in src/BikeTracking.AppHost/AppHost.cs
- [X] T006 Align local identity run/verification notes in specs/001-user-signup-pin/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement core persistence, security, and runtime plumbing that blocks all user stories.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T007 Add EF Core SQLite and migration package references in src/BikeTracking.Api/BikeTracking.Api.csproj
- [X] T008 Define identity persistence entities and DbSets in src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
- [X] T009 Create initial identity migration for User, UserCredential, AuthAttemptState, and OutboxEvent in src/BikeTracking.Api/Infrastructure/Persistence/Migrations/20260313_InitialUserIdentity.cs
- [X] T010 [P] Implement normalized-name helper (trim + case-insensitive canonicalization) in src/BikeTracking.Api/Application/Users/UserNameNormalizer.cs
- [X] T011 [P] Implement PIN policy validator for numeric 4-8 length rules in src/BikeTracking.Api/Application/Users/PinPolicyValidator.cs
- [X] T012 [P] Implement PBKDF2 PIN hash and verify service in src/BikeTracking.Api/Infrastructure/Security/PinHasher.cs
- [X] T013 [P] Define shared API error and throttle contracts in src/BikeTracking.Api/Contracts/UsersContracts.cs
- [X] T014 Implement outbox data access abstraction for pending event load/update in src/BikeTracking.Api/Application/Events/IOutboxStore.cs
- [X] T015 Implement hosted-service skeleton for outbox publishing in src/BikeTracking.Api/Application/Events/OutboxPublisherService.cs
- [X] T016 Configure DbContext, outbox worker, and users endpoint registration in src/BikeTracking.Api/Program.cs

**Checkpoint**: Foundation is complete; user stories can now be implemented.

---

## Phase 3: User Story 1 - Sign Up With Name and PIN (Priority: P1) 🎯 MVP

**Goal**: Allow a new local rider to sign up with validated name and PIN and receive a new database user ID.

**Independent Test**: Submit valid name/PIN from UI and API; verify 201 response with new user ID, persisted user+credential+attempt-state rows, and duplicate-name rejection with `name already exists`.

### Implementation for User Story 1

- [X] T017 [P] [US1] Build signup page view-model with client-side validation state in src/BikeTracking.Frontend/src/pages/signup/signup-page.ts
- [X] T018 [P] [US1] Build accessible signup form markup with field-level validation bindings in src/BikeTracking.Frontend/src/pages/signup/signup-page.html
- [X] T019 [P] [US1] Implement signup API client method in src/BikeTracking.Frontend/src/services/users-api.ts
- [X] T020 [US1] Register signup page bootstrap in src/BikeTracking.Frontend/src/main.ts
- [X] T021 [P] [US1] Define signup request/response DTOs and duplicate-name error code in src/BikeTracking.Api/Contracts/UsersContracts.cs
- [X] T022 [US1] Implement signup application service with normalized-name duplicate check in src/BikeTracking.Api/Application/Users/SignupService.cs
- [X] T023 [US1] Persist User, UserCredential, and AuthAttemptState transactionally in src/BikeTracking.Api/Application/Users/SignupService.cs
- [X] T024 [US1] Queue UserRegistered outbox event during signup transaction in src/BikeTracking.Api/Application/Users/SignupService.cs
- [X] T025 [US1] Implement POST /api/users/signup with 201/400/409 semantics in src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
- [X] T026 [US1] Wire frontend signup submit flow and server error rendering in src/BikeTracking.Frontend/src/pages/signup/signup-page.ts

**Checkpoint**: User Story 1 is complete and independently testable as the MVP.

---

## Phase 4: User Story 2 - Identify and Authorize User by PIN (Priority: P2)

**Goal**: Allow a returning rider to identify with normalized name + PIN and enforce progressive throttling for repeated failures.

**Independent Test**: Identify a previously created user with valid credentials (200), invalid PIN (401), and repeated invalid attempts (429 with Retry-After and progressive delay reset on success).

### Implementation for User Story 2

- [X] T027 [P] [US2] Define identify request/response contracts and throttle payload in src/BikeTracking.Api/Contracts/UsersContracts.cs
- [X] T028 [P] [US2] Implement identify API client method with Retry-After handling in src/BikeTracking.Frontend/src/services/users-api.ts
- [X] T029 [P] [US2] Add identify controls and throttle message placeholders in src/BikeTracking.Frontend/src/pages/signup/signup-page.html
- [X] T030 [US2] Implement normalized-name lookup + PIN verification in src/BikeTracking.Api/Application/Users/IdentifyService.cs
- [X] T031 [US2] Implement progressive delay calculation (1s to 30s cap) in src/BikeTracking.Api/Application/Users/IdentifyService.cs
- [X] T032 [US2] Reset delay progression after successful identification in src/BikeTracking.Api/Application/Users/IdentifyService.cs
- [X] T033 [US2] Implement POST /api/users/identify with 200/401/429 semantics in src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
- [X] T034 [US2] Return Retry-After header for throttled identify responses in src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
- [X] T035 [US2] Wire frontend identify submission, authorized state, and throttle UX in src/BikeTracking.Frontend/src/pages/signup/signup-page.ts

**Checkpoint**: User Story 2 is complete and independently testable.

---

## Phase 5: User Story 3 - Persist Signup Data and Emit Registration Event (Priority: P3)

**Goal**: Ensure signup persistence is durable and event publication is eventually consistent via retrying outbox delivery.

**Independent Test**: Complete signup once, verify persisted user data and queued event; simulate initial publish failure and verify eventual successful publish without deleting persisted user.

### Implementation for User Story 3

- [X] T036 [P] [US3] Define UserRegistered event type and mapping helpers in src/BikeTracking.Domain.FSharp/Users/UserEvents.fs
- [X] T037 [P] [US3] Add outbox entity configuration and pending-event indexes in src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs
- [X] T038 [US3] Implement outbox dequeue and publish-attempt loop in src/BikeTracking.Api/Application/Events/OutboxPublisherService.cs
- [X] T039 [US3] Implement retry scheduling with backoff and persisted RetryCount/NextAttemptUtc in src/BikeTracking.Api/Application/Events/OutboxPublisherService.cs
- [X] T040 [US3] Implement UserRegistered event publisher adapter in src/BikeTracking.Api/Application/Events/UserRegisteredPublisher.cs
- [X] T041 [US3] Mark outbox record published only on successful delivery in src/BikeTracking.Api/Application/Events/OutboxPublisherService.cs
- [X] T042 [US3] Wire outbox publisher options and hosted-service startup in src/BikeTracking.Api/Program.cs
- [X] T043 [US3] Surface event queue status in signup response mapping in src/BikeTracking.Api/Contracts/UsersContracts.cs

**Checkpoint**: User Story 3 is complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening and documentation that touches multiple stories.

- [X] T044 [P] Update local endpoint examples and expected outputs in specs/001-user-signup-pin/quickstart.md
- [X] T045 [P] Document local identity behavior and scope boundaries in README.md
- [X] T046 Harden API logging to exclude PIN/hash/salt data in src/BikeTracking.Api/Program.cs
- [X] T047 [P] Add outbox worker diagnostics notes to orchestration setup in src/BikeTracking.AppHost/AppHost.cs
- [X] T048 Run quickstart validation steps and record final verification notes in specs/001-user-signup-pin/quickstart.md
- [X] T049 Finalize user-facing copy for validation/duplicate/throttle states in src/BikeTracking.Frontend/src/pages/signup/signup-page.html

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks all user-story phases.
- User Story phases (Phase 3 onward) depend on Foundational completion.
- Polish (Phase 6) depends on completion of all selected user stories.

### User Story Dependencies

- US1 (P1) starts immediately after Foundational and defines the MVP.
- US2 (P2) depends on Foundational and user identity persistence; full end-to-end validation follows US1 completion.
- US3 (P3) depends on Foundational and signup transaction flow from US1.

### Suggested Story Completion Graph

- US1 → US2
- US1 → US3

---

## Parallel Execution Examples

### User Story 1

- Run T017, T018, T019, and T021 in parallel.
- After those complete, continue with T022 through T026 sequentially.

### User Story 2

- Run T027, T028, and T029 in parallel.
- After those complete, continue with T030 through T035 sequentially.

### User Story 3

- Run T036 and T037 in parallel.
- After those complete, continue with T038 through T043 sequentially.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Complete all US1 tasks (T017-T026).
3. Validate US1 independently before expanding scope.

### Incremental Delivery

1. Deliver MVP via US1.
2. Add US2 for returning-user authorization and throttle behavior.
3. Add US3 for reliable event delivery and operational resilience.
4. Finish with cross-cutting polish tasks.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. After US1 baseline is stable, one stream can take US2 while another takes US3.
3. Merge in Phase 6 for final hardening and documentation.
