# Tasks: CSV Ride Import

**Input**: Design documents from `/specs/013-csv-ride-import/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required for this feature because the plan and quickstart define a strict TDD workflow.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare base folders, service registration scaffolding, and frontend route placeholders for the import feature.

- [X] T001 Create import application folder structure in `src/BikeTracking.Api/Application/Imports/`
- [X] T002 Create import frontend folder structure in `src/BikeTracking.Frontend/src/pages/import-rides/` and `src/BikeTracking.Frontend/src/components/import-rides/`
- [X] T003 [P] Add import API service placeholder in `src/BikeTracking.Frontend/src/services/import-api.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define contracts, persistence model, and endpoint wiring that all stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create import DTO contracts in `src/BikeTracking.Api/Contracts/ImportContracts.cs`
- [X] T005 [P] Create `ImportJobEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ImportJobEntity.cs`
- [X] T006 [P] Create `ImportRowEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/ImportRowEntity.cs`
- [X] T007 Configure import entity mappings in `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`
- [X] T008 Add import endpoints shell in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T009 Register import services and endpoint mapping in `src/BikeTracking.Api/Program.cs`
- [X] T010 Create EF migration for import persistence in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T011 Add migration policy coverage entry in `src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs`

**Checkpoint**: Foundation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - Upload and import CSV file (Priority: P1) MVP

**Goal**: Allow rider to upload CSV, validate/preview rows, and execute import for valid rows.

**Independent Test**: Upload a CSV with valid and invalid rows, confirm preview displays errors and only valid rows are imported after confirmation.

### Tests for User Story 1

- [X] T012 [P] [US1] Add parser header/required-column tests in `src/BikeTracking.Api.Tests/Application/Imports/CsvParserTests.cs`
- [X] T013 [P] [US1] Add row validation tests for date/miles/time rules in `src/BikeTracking.Api.Tests/Application/Imports/CsvParserTests.cs`
- [X] T014 [P] [US1] Add preview endpoint contract tests in `src/BikeTracking.Api.Tests/Endpoints/ImportEndpointsTests.cs`
- [X] T015 [P] [US1] Add frontend preview rendering tests in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.test.tsx`
- [X] T016 [US1] Add E2E happy-path upload-preview-start-import test in `src/BikeTracking.Frontend/tests/e2e/import-rides.spec.ts`
- [X] T069 [US1] Add non-CSV upload rejection integration test in `src/BikeTracking.Api.Tests/Endpoints/ImportEndpointsTests.cs`
- [X] T071 [US1] Add frontend non-CSV error rendering test in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.test.tsx`
- [X] T073 [US1] Add oversized upload (>5 MB) endpoint test in `src/BikeTracking.Api.Tests/Endpoints/ImportEndpointsTests.cs`
- [X] T075 [US1] Add oversized-file frontend error test in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.test.tsx`

### Implementation for User Story 1

- [X] T017 [US1] Implement CSV parsing and header normalization in `src/BikeTracking.Api/Application/Imports/CsvParser.cs`
- [X] T018 [US1] Implement CSV row validation rules in `src/BikeTracking.Api/Application/Imports/CsvValidationRules.cs`
- [X] T019 [US1] Implement import preview orchestration in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T020 [US1] Implement preview upload endpoint in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T021 [US1] Implement import start endpoint baseline flow in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T022 [US1] Implement import status endpoint baseline flow in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T023 [US1] Implement frontend import API preview/start/status calls in `src/BikeTracking.Frontend/src/services/import-api.ts`
- [X] T024 [US1] Build import page upload + preview UI in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx`
- [X] T025 [US1] Add import page styles for preview/error states in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.css`
- [X] T026 [US1] Wire import route in `src/BikeTracking.Frontend/src/App.tsx`
- [X] T070 [US1] Enforce non-CSV file validation (extension/content type) in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T072 [US1] Render clear non-CSV error message in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx`
- [X] T074 [US1] Enforce 5 MB upload limit in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T076 [US1] Render oversized-file validation message in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx`
- [X] T077 [US1] Add concurrent start-request guard integration test in `src/BikeTracking.Api.Tests/Endpoints/ImportEndpointsTests.cs`
- [X] T078 [US1] Implement active-import-per-rider guard in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T079 [US1] Return conflict response for concurrent import attempts in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`

**Checkpoint**: User Story 1 is independently functional.

---

## Phase 4: User Story 2 - Duplicate detection and resolution (Priority: P1)

**Goal**: Detect duplicates by date+miles and allow keep existing, replace with import, or override-all behavior.

**Independent Test**: Import a CSV containing at least one date+miles duplicate and verify duplicate dialog decisions control the final import outcome.

### Tests for User Story 2

- [X] T027 [P] [US2] Add duplicate key and match tests in `src/BikeTracking.Api.Tests/Application/Imports/DuplicateResolutionServiceTests.cs`
- [X] T028 [P] [US2] Add duplicate resolution endpoint tests in `src/BikeTracking.Api.Tests/Endpoints/ImportEndpointsTests.cs`
- [X] T029 [P] [US2] Add duplicate dialog interaction tests in `src/BikeTracking.Frontend/src/components/import-rides/DuplicateResolutionDialog.test.tsx`
- [X] T030 [US2] Add E2E duplicate keep-existing and replace-with-import tests in `src/BikeTracking.Frontend/tests/e2e/import-rides.spec.ts`

### Implementation for User Story 2

- [X] T031 [US2] Implement duplicate detection by date+miles in `src/BikeTracking.Api/Application/Imports/DuplicateResolutionService.cs`
- [X] T032 [US2] Implement duplicate resolution payload handling in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T033 [US2] Implement keep-existing and replace-with-import row actions in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T034 [US2] Implement override-all duplicate bypass in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T035 [US2] Return duplicate match details in preview response in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T036 [US2] Create duplicate resolution dialog component in `src/BikeTracking.Frontend/src/components/import-rides/DuplicateResolutionDialog.tsx`
- [X] T037 [US2] Integrate duplicate dialog and override-all toggle in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx`

**Checkpoint**: User Story 2 is independently functional.

---

## Phase 5: User Story 3 - Real-time progress and cancellation (Priority: P2)

**Goal**: Provide 25% milestone updates, ETA in 5-minute increments, reconnect-safe status, and cooperative cancellation.

**Independent Test**: Start a long import and verify progress reaches 25/50/75/100 with ETA display; cancel mid-run and confirm partial summary.

### Tests for User Story 3

- [X] T038 [P] [US3] Add progress milestone and ETA rounding tests in `src/BikeTracking.Api.Tests/Application/Imports/ImportProgressEstimatorTests.cs`
- [X] T039 [P] [US3] Add cancel endpoint and status transition tests in `src/BikeTracking.Api.Tests/Endpoints/ImportEndpointsTests.cs`
- [X] T040 [P] [US3] Add progress panel rendering tests in `src/BikeTracking.Frontend/src/components/import-rides/ImportProgressPanel.test.tsx`
- [X] T041 [US3] Add E2E progress milestones and cancellation test in `src/BikeTracking.Frontend/tests/e2e/import-rides.spec.ts`

### Implementation for User Story 3

- [X] T042 [US3] Implement progress estimator with 5-minute ETA rounding in `src/BikeTracking.Api/Application/Imports/ImportProgressEstimator.cs`
- [X] T043 [US3] Implement milestone notifier payloads in `src/BikeTracking.Api/Application/Notifications/ImportProgressNotifier.cs`
- [X] T044 [US3] Emit 25/50/75/100 progress milestones in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T045 [US3] Persist and expose reconnect-safe job status in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T046 [US3] Implement cooperative cancellation handling in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T047 [US3] Implement cancel endpoint in `src/BikeTracking.Api/Endpoints/ImportEndpoints.cs`
- [X] T048 [US3] Create import progress panel component in `src/BikeTracking.Frontend/src/components/import-rides/ImportProgressPanel.tsx`
- [X] T049 [US3] Integrate progress subscription, ETA, and cancel action in `src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.tsx`

**Checkpoint**: User Story 3 is independently functional.

---

## Phase 6: User Story 4 - Gas and weather enrichment with cache + lookup fallback (Priority: P2)

**Goal**: Enrich imported rides via cache-first lookups with weekly gas deduplication, noon-default weather hour, batch pre-fetch with controlled concurrency, retry-once behavior, and 4 calls/sec throttle.

**Independent Test**: Import a CSV with rides spanning multiple weeks, some cached and some not; verify (a) only one gas API call per distinct week, (b) weather looked up at noon UTC per date, (c) retry-once-then-skip on failure, (d) CSV Temp takes precedence over fetched temperature.

### Tests for User Story 4

- [X] T050 [P] [US4] Add weekly gas dedup tests (two rows same week → one call, boundary Saturday/Sunday → two calls) in `src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs`
- [X] T051 [P] [US4] Add cache-hit/cache-miss enrichment tests (gas week key, weather noon-hour key) in `src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs`
- [X] T052 [P] [US4] Add retry-once-then-skip enrichment failure tests in `src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs`
- [X] T053 [P] [US4] Add lookup throttling tests (4 calls/sec, SemaphoreSlim token bucket) in `src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs`
- [X] T054 [US4] Add E2E enrichment behavior test with mixed cache states in `src/BikeTracking.Frontend/tests/e2e/import-rides.spec.ts`

### Implementation for User Story 4

- [X] T055 [US4] Add `GasPriceWeekKeyHelper` utility: compute Sunday start-date for a given `DateOnly` in `src/BikeTracking.Api/Application/Imports/GasPriceWeekKeyHelper.cs`
- [X] T056 [US4] Extend `IGasPriceLookupService` / `EiaGasPriceLookupService` to accept and store a `weekStartDate` cache key alongside `PriceDate`; add DB migration for the `WeekStartDate` column and unique index on `WeekStartDate` in `src/BikeTracking.Api/Application/Rides/GasPriceLookupService.cs` and `src/BikeTracking.Api/Infrastructure/Persistence/`
- [X] T057 [US4] Implement pre-fetch enrichment stage in `ImportJobProcessor`: before the row loop, group valid rows by week key (gas) and by date (weather), resolve each distinct key with one cache check + at most one throttled API call, store results in memory dictionaries in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs`
- [X] T058 [US4] Apply pre-fetched gas price to each row during the row loop (use week key to look up from in-memory dict) in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs`
- [X] T059 [US4] Apply pre-fetched weather snapshot to each row during the row loop (use date key; weather fetched at noon UTC) in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs`
- [X] T060 [US4] Implement shared 4 calls/sec `SemaphoreSlim` token-bucket throttle for pre-fetch API calls in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs`
- [X] T061 [US4] Implement retry-once then skip-field policy wrapping each external call in the pre-fetch stage in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs`
- [X] T062 [US4] Enforce CSV Temp precedence over fetched weather temperature when applying enrichment in `src/BikeTracking.Api/Application/Imports/ImportJobProcessor.cs`

**Checkpoint**: User Story 4 is independently functional.

---

## Phase 7: User Story 5 - Settings navigation and access control (Priority: P3)

**Goal**: Expose import from Settings and ensure route is authenticated.

**Independent Test**: From authenticated session navigate Settings -> Import Rides, and verify unauthenticated direct navigation redirects to login.

### Tests for User Story 5

- [X] T063 [P] [US5] Add settings link rendering tests in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx`
- [X] T064 [P] [US5] Add route auth redirect tests in `src/BikeTracking.Frontend/src/App.test.tsx`
- [X] T065 [US5] Add E2E settings navigation and unauthenticated redirect tests in `src/BikeTracking.Frontend/tests/e2e/import-rides.spec.ts`

### Implementation for User Story 5

- [X] T066 [US5] Add Import Rides entry on settings page in `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx`
- [X] T067 [US5] Ensure import route uses authenticated guard in `src/BikeTracking.Frontend/src/App.tsx`

**Checkpoint**: User Story 5 is independently functional.

---

## Phase 8: Polish and cross-cutting concerns

**Purpose**: Finalize documentation, validation, and cleanup across all stories.

- [X] T068 [P] Update import API examples in `src/BikeTracking.Api/BikeTracking.Api.http`
- [X] T069 Clean up import service helper extraction in `src/BikeTracking.Api/Application/Imports/CsvRideImportService.cs`
- [X] T070 [P] Run backend validation suite from `specs/013-csv-ride-import/quickstart.md` using `dotnet test BikeTracking.slnx`
- [X] T071 [P] Run frontend validation suite from `specs/013-csv-ride-import/quickstart.md` using `npm run lint`, `npm run build`, `npm run test:unit`, and `npm run test:e2e` in `src/BikeTracking.Frontend/`

---

## Dependencies and execution order

### Phase dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Setup; blocks all user story work.
- User Story phases (Phase 3 to Phase 7): depend on Foundational completion.
- Polish (Phase 8): depends on completion of selected user stories.

### User story dependencies

- US1 (P1): can start immediately after Foundational; MVP slice.
- US2 (P1): depends on US1 preview/start flow because duplicate resolution plugs into that pipeline.
- US3 (P2): depends on US1 job processing skeleton; can run in parallel with US2 after US1 baseline exists.
- US4 (P2): depends on US1 processing skeleton; can run in parallel with US3.
- US5 (P3): depends on US1 route/page existence; can run after US1 and in parallel with US3/US4.

### Within each user story

- Write tests first and confirm failing state before implementation.
- Implement backend/core models and services before endpoint wiring.
- Wire frontend service before page integration.
- Complete story checkpoint validation before moving to next priority.

## Parallel opportunities

- Phase 2: T005 and T006 can run in parallel.
- US1: T012-T015 can run in parallel; T017 and T018 can run in parallel.
- US2: T027-T029 can run in parallel.
- US3: T038-T040 can run in parallel; T048 can proceed while backend progress estimator is built.
- US4: T050–T053 can run in parallel (test tasks); T055 and T057 must precede T056 (pre-fetch stage needs week key helper and extended lookup service).
- US5: T063 and T064 can run in parallel.
- Polish: T068, T070, and T071 can run in parallel after implementation stabilizes.

---

## Parallel example: User Story 1

```bash
Task: "T012 [US1] Add parser header/required-column tests in src/BikeTracking.Api.Tests/Application/Imports/CsvParserTests.cs"
Task: "T013 [US1] Add row validation tests for date/miles/time rules in src/BikeTracking.Api.Tests/Application/Imports/CsvParserTests.cs"
Task: "T015 [US1] Add frontend preview rendering tests in src/BikeTracking.Frontend/src/pages/import-rides/ImportRidesPage.test.tsx"
```

## Parallel example: User Story 3

```bash
Task: "T038 [US3] Add progress milestone and ETA rounding tests in src/BikeTracking.Api.Tests/Application/Imports/ImportProgressEstimatorTests.cs"
Task: "T040 [US3] Add progress panel rendering tests in src/BikeTracking.Frontend/src/components/import-rides/ImportProgressPanel.test.tsx"
```

## Parallel example: User Story 4

```bash
Task: "T050 [US4] Add weekly gas dedup tests in src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs"
Task: "T051 [US4] Add cache-hit/cache-miss enrichment tests (gas week key, weather noon-hour) in src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs"
Task: "T052 [US4] Add retry-once-then-skip enrichment failure tests in src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs"
Task: "T053 [US4] Add lookup throttling tests (4 calls/sec, SemaphoreSlim) in src/BikeTracking.Api.Tests/Application/Imports/CsvRideImportServiceTests.cs"
```

---

## Implementation strategy

### MVP first (US1 only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 US1.
4. Validate US1 independently as the first deployable slice.

### Incremental delivery

1. Deliver US1 upload/preview/import baseline.
2. Add US2 duplicate resolution.
3. Add US3 progress + cancellation.
4. Add US4 enrichment fallback/throttle behavior.
5. Add US5 settings discoverability and auth route guard.
6. Finish with Phase 8 polish and full quickstart verification.

### Parallel team strategy

1. Team completes Setup + Foundational together.
2. After US1 baseline, split ownership:
   - Developer A: US2 duplicate resolution
   - Developer B: US3 progress/cancellation
   - Developer C: US4 enrichment behavior
3. Complete US5 and polish after core backend stability.

---

## Notes

- [P] tasks are parallel-safe and should avoid same-file conflicts.
- Every user-story task includes explicit file paths.
- Task IDs are sequential and execution-ordered.
- Story checkpoints are designed for independent testing and demo.
