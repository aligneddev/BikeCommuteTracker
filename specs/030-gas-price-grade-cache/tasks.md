---

description: "Task list for Gas Price Grade Selection & Cache Refresh Policy"
---

# Tasks: Gas Price Grade Selection & Cache Refresh Policy

**Input**: Design documents from `/specs/030-gas-price-grade-cache/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/gas-price-grade-cache-contract.md, quickstart.md

**Tests**: This repo's constitution mandates TDD ("TDD mandatory" — see plan.md Constitution Check). All test tasks below are REQUIRED and MUST be written first and MUST FAIL before their corresponding implementation tasks.

**Organization**: Tasks are grouped by user story (US1 = Choose Preferred Gas Grade, P1; US2 = Gas Price Cache Refreshes Every 3 Days, P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Web application layout per plan.md:
- Backend: `src/BikeTracking.Api/`, tests in `src/BikeTracking.Api.Tests/`
- Frontend: `src/BikeTracking.Frontend/src/`, e2e tests in `src/BikeTracking.Frontend/tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project scaffolding is required — this feature extends existing entities/services in place. This phase only confirms the workspace builds/tests cleanly before changes begin.

- [X] T001 Run `dotnet test BikeTracking.slnx` and `cd src/BikeTracking.Frontend && npm run test:unit` to confirm a clean baseline before starting (no code changes)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema/entity/contract changes shared by both user stories (grade-aware cache column+index, `GasGrade` settings column, migration, contract field additions). **MUST complete before either user story's behavior can be implemented or tested**, since both US1 and US2 tests exercise the same `(WeekStartDate, Grade)` cache key and `GasGrade` column.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add nullable `Grade` (`string?`) property to `GasPriceLookupEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/GasPriceLookupEntity.cs` (per data-model.md; legacy rows keep `Grade = NULL`)
- [X] T003 [P] Add non-nullable `GasGrade` (`string`, CLR default `"Regular"`) property to `UserSettingsEntity` in `src/BikeTracking.Api/Infrastructure/Persistence/Entities/UserSettingsEntity.cs` (per data-model.md Decision 6)
- [X] T004 In `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`: drop the unique indexes on `GasPriceLookupEntity.PriceDate` and `GasPriceLookupEntity.WeekStartDate`, add a unique composite index on `(WeekStartDate, Grade)`, and configure the `CK_UserSettings_GasGrade_Valid` CHECK constraint (`GasGrade IN ('Regular','Premium')`) for `UserSettingsEntity` (depends on T002, T003)
- [X] T005 Generate EF Core migration `AddGasGradeAndCacheRefreshPolicy` in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/` (via `dotnet ef migrations add`) that: adds nullable `Grade` to `GasPriceLookups`, drops the two prior unique indexes and creates the new composite unique index, adds non-nullable `GasGrade` to `UserSettings` with a migration-time `UPDATE ... SET "GasGrade" = 'Premium'` backfill for all pre-existing rows, and adds the `CK_UserSettings_GasGrade_Valid` CHECK constraint (depends on T004)
- [X] T006 [P] Add `Grade: string` field to `GasPriceResponse` and add optional `grade` query parameter handling scaffolding to the `GetGasPrice` route signature in `src/BikeTracking.Api/Contracts/RidesContracts.cs` (per contract; field always present even when `IsAvailable` is false)
- [X] T007 [P] Add `GasGrade: string?` field to `UserSettingsUpsertRequest` and `GasGrade: string` field to `UserSettingsView` in `src/BikeTracking.Api/Contracts/UsersContracts.cs` (per contract)
- [X] T008 [P] Add `NEW: GasPriceRefreshCoordinator` skeleton class (constructor + `RunExclusiveAsync<T>((DateOnly weekStart, string grade) key, Func<Task<T>> refresh)` signature, `ConcurrentDictionary<(DateOnly, string), SemaphoreSlim>`-backed, no callers yet) in `src/BikeTracking.Api/Application/Rides/GasPriceRefreshCoordinator.cs` (per research.md Decision 3)
- [X] T009 Register `GasPriceRefreshCoordinator` as a singleton in `src/BikeTracking.Api/Program.cs` (depends on T008)

**Checkpoint**: Foundation ready — schema, entities, contracts, and the coordinator skeleton exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Choose Preferred Gas Grade (Priority: P1) 🎯 MVP

**Goal**: Riders can set a "Regular"/"Premium" gas grade preference in Settings; the ride form's suggested gas price is fetched from the grade-specific EIA series (`EPMR`/`EPMP`) instead of the current all-grades `EPM0` series, cached per `(WeekStartDate, Grade)`, with legacy ungraded rows remaining permanently inert, and an optional `grade` query-param override on the endpoint.

**Independent Test**: Set gas grade preference to "Regular" in Settings, open the ride creation form, and confirm the suggested price is fetched via the regular-grade series (inspect stored `DataSource`/`Grade` on the resulting cache row); repeat with "Premium" and confirm a different series/cache row is used, independent of any 3-day staleness behavior (US2).

### Tests for User Story 1 (write first — MUST fail before implementation) ⚠️

- [X] T010 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs`: a rider with no settings row reads `GasGrade` as `"Regular"` on `GetAsync`
- [X] T011 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs`: saving a valid `GasGrade` (`"Regular"`/`"Premium"`) via `SaveAsync` persists and round-trips
- [X] T012 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Application/Users/UserSettingsServiceTests.cs`: saving an invalid `GasGrade` value is rejected with the existing `UsersErrorCodes.ValidationFailed` shape
- [X] T013 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: requesting `Regular` and `Premium` for the same week produces two independent cache rows (verifying the `(WeekStartDate, Grade)` composite key)
- [X] T014 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: the EIA HTTP request uses product facet `EPMR` for `Regular` and `EPMP` for `Premium` (not legacy `EPM0`)
- [X] T015 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: a pre-feature `Grade = NULL` legacy row is never returned for any grade-aware query and a fresh external fetch is performed instead, writing a new graded row
- [X] T016 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`: `GET /api/rides/gas-price` with no `grade` query param uses the rider's saved `GasGrade` preference
- [X] T017 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`: `GET /api/rides/gas-price?grade=Premium` overrides the saved preference for that call only, without persisting it to `UserSettingsEntity`
- [X] T018 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`: an invalid `grade` query-param value returns `400 INVALID_REQUEST`
- [X] T019 [P] [US1] Add test to `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`: the `GasPriceResponse` always includes `grade`, even when `isAvailable` is `false`
- [X] T020 [P] [US1] Add test to `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx`: the Gas Grade selector renders, defaults to the resolved `gasGrade` from `GET /api/users/settings` (`"Regular"` for no-settings-row, `"Premium"` for pre-existing rows), and saves via `PUT /api/users/settings` on change
- [X] T021 [P] [US1] Add test to `src/BikeTracking.Frontend/src/services/users-api.test.ts`: `gasGrade` is included in the settings request/response payload types and round-trips through the client
- [X] T022 [P] [US1] Add test to `src/BikeTracking.Frontend/src/services/ridesService.test.ts`: `getGasPrice` accepts an optional `grade` parameter and includes it as a query param when provided

### Implementation for User Story 1

- [X] T023 [US1] In `src/BikeTracking.Api/Application/Rides/GasPriceLookupService.cs` / `IGasPriceLookupService`: add a `grade` parameter to `GetOrFetchAsync`, validate it is `"Regular"`/`"Premium"`, query the cache with `WHERE WeekStartDate = @week AND Grade = @grade` (never matching legacy `NULL` rows), and map `grade` to the EIA `product` facet (`EPMR`/`EPMP`) replacing the current `EPM0` selection (depends on T002, T005; makes T013, T014, T015 pass)
- [X] T024 [US1] In `src/BikeTracking.Api/Application/Users/UserSettingsService.cs`: read/write `GasGrade` following the existing partial-update (`providedFields`) convention, validating against `{"Regular","Premium"}`, defaulting to `"Regular"` for a rider with no settings row (depends on T003, T005; makes T010, T011, T012 pass)
- [X] T025 [US1] In `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`: resolve effective grade as `grade` query-param override → saved `UserSettingsEntity.GasGrade` → `"Regular"` default, pass it to `IGasPriceLookupService.GetOrFetchAsync`, and populate `GasPriceResponse.Grade` (depends on T006, T023; makes T016, T017, T019 pass)
- [X] T026 [US1] In `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`: validate the `grade` query parameter (case-insensitive `"Regular"`/`"Premium"`) and return `400 INVALID_REQUEST` for any other value (depends on T025; makes T018 pass)
- [X] T027 [P] [US1] In `src/BikeTracking.Frontend/src/services/users-api.ts`: add `gasGrade` to the settings request/response TypeScript types (depends on T007; makes T021 pass)
- [X] T028 [P] [US1] In `src/BikeTracking.Frontend/src/services/ridesService.ts`: add an optional `grade` parameter to `getGasPrice`, forwarded as a query param when present (makes T022 pass)
- [X] T029 [US1] In `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx`: add a Regular/Premium Gas Grade selector alongside existing rider-level preferences, defaulted from `gasGrade`, saved via `users-api.ts` (depends on T027; makes T020 pass)
- [X] T030 [US1] Extend `src/BikeTracking.Frontend/tests/e2e/settings.spec.ts` to cover setting a gas grade preference in Settings and confirm it is reflected in the ride form's suggested gas price (per plan.md E2E requirement)

**Checkpoint**: User Story 1 is fully functional and independently testable — grade selection, grade-aware cache key, legacy-row inertness, endpoint override, and Settings UI all work end-to-end.

---

## Phase 4: User Story 2 - Gas Price Cache Refreshes Every 3 Days (Priority: P2)

**Goal**: Cached gas price entries are treated as fresh for 3 days from `RetrievedAtUtc` and reused without an external call; once 3+ days old, the next request triggers a de-duplicated refresh (at most one external call per `(week, grade)` concurrently), replacing the cache row on success or gracefully falling back to the stale value on failure.

**Independent Test**: Seed a cache entry with `RetrievedAtUtc` older than 3 days and confirm the next lookup triggers a fresh external call and updates the cache entry; seed an entry retrieved less than 3 days ago and confirm the cached value is reused with no external call. This story is independently testable regardless of whether grade selection (US1) has shipped, since it exercises the freshness/refresh mechanics on top of whatever cache key shape already exists.

### Tests for User Story 2 (write first — MUST fail before implementation) ⚠️

- [X] T031 [P] [US2] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: a cached `(week, grade)` row younger than 3 days (per injected `TimeProvider`) is returned with zero HTTP calls
- [X] T032 [P] [US2] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: a cached row 3+ days old triggers a fresh external call and replaces the stored price/`RetrievedAtUtc` on success
- [X] T033 [P] [US2] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: a failed refresh attempt (simulated HTTP error/invalid price) returns the prior stale price unchanged rather than `null`, and does not overwrite the existing valid cache row
- [X] T034 [P] [US2] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: multiple concurrent callers requesting the same stale `(week, grade)` result in exactly one external HTTP call (via `GasPriceRefreshCoordinator` de-duplication), with all callers receiving the refreshed (or consistently stale-fallback) result
- [X] T035 [P] [US2] Add test to `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: the freshness boundary is measured via injected `TimeProvider.GetUtcNow()` (not `DateTime.UtcNow`), confirming the 3-day window survives a simulated process restart (new service instance, same durable `RetrievedAtUtc`)

### Implementation for User Story 2

- [X] T036 [US2] In `src/BikeTracking.Api/Application/Rides/GasPriceLookupService.cs`: inject `TimeProvider` via constructor and compute staleness as `timeProvider.GetUtcNow().UtcDateTime - cached.RetrievedAtUtc >= TimeSpan.FromDays(3)`, returning the cached value as-is when fresh (depends on T023; makes T031, T035 pass)
- [X] T037 [US2] In `src/BikeTracking.Api/Application/Rides/GasPriceLookupService.cs`: when a cache row is stale, route the refresh through `GasPriceRefreshCoordinator.RunExclusiveAsync` keyed by `(WeekStartDate, Grade)`, performing the EIA HTTP call and upserting the row (same `GasPriceLookupId`, updated `PricePerGallon`/`DataSource`/`EiaPeriodDate`/`RetrievedAtUtc`) on success (depends on T008, T009, T036; makes T032, T034 pass)
- [X] T038 [US2] In `src/BikeTracking.Api/Application/Rides/GasPriceLookupService.cs`: on a failed/invalid refresh (non-positive price or HTTP failure) for a stale row, return the prior stale cached value unchanged without overwriting it, reusing the existing non-positive-price rejection validation (depends on T037; makes T033 pass)
- [X] T039 [US2] Implement the full `GasPriceRefreshCoordinator.RunExclusiveAsync<T>` body in `src/BikeTracking.Api/Application/Rides/GasPriceRefreshCoordinator.cs` (per-key `SemaphoreSlim` acquire/release, removing the semaphore entry once no longer in-flight) (depends on T008; makes T034 pass)

**Checkpoint**: User Stories 1 AND 2 both work independently and together — grade-aware, freshness-aware, de-duplicated cache is fully functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification spanning both user stories

- [X] T040 [P] Run `dotnet test BikeTracking.slnx` and confirm all new/extended tests (T010–T019, T031–T035) pass
- [X] T041 [P] Run `cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit` and confirm all new/extended tests (T020–T022) pass
- [X] T042 Run `cd src/BikeTracking.Frontend && npm run test:e2e` and confirm the extended `settings.spec.ts` (T030) passes
- [X] T043 Execute the manual verification steps in `specs/030-gas-price-grade-cache/quickstart.md` (Manual Check section) against a locally seeded pre-feature database to confirm the `"Premium"` backfill, `"Regular"` new-row default, legacy-row inertness, and 3-day refresh/fallback behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS both user stories (shared `Grade`/`GasGrade` schema, contracts, migration, coordinator skeleton)
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion - No dependency on US2
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion; its implementation tasks (T036-T039) build on top of US1's `GetOrFetchAsync(grade, ...)` signature (T023), so in practice US2 implementation follows US1 implementation, but US2's *tests* (T031-T035) can be written as soon as Foundational is done
- **Polish (Phase 5)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories; this is the MVP
- **User Story 2 (P2)**: Can start after Foundational (Phase 2); implementation tasks depend on US1's grade-aware `GetOrFetchAsync` signature (T023) already existing, since staleness/refresh logic is layered on top of the same method — treat US2 implementation as sequential-after-US1 even though it is a separately deliverable/testable increment

### Within Each User Story

- Tests (T010-T022 for US1, T031-T035 for US2) MUST be written and FAIL before their corresponding implementation tasks
- Entity/contract changes (Foundational) before service changes
- Services before endpoints
- Endpoints before frontend consumers
- Backend before frontend within a story where the frontend depends on the new field/param

### Parallel Opportunities

- All Foundational tasks marked [P] (T002, T003, T006, T007, T008) can run in parallel; T004 depends on T002+T003, T005 depends on T004, T009 depends on T008
- All US1 test tasks (T010-T022) marked [P] can be written in parallel (different files)
- T027 and T028 (frontend service files) can run in parallel
- US1 and US2 test-writing can happen in parallel once Foundational is done (T010-T022 vs. T031-T035), even though US2 *implementation* follows US1 implementation
- Polish tasks T040 and T041 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all backend tests for User Story 1 together:
Task: "Add test: rider with no settings row reads GasGrade as 'Regular' in UserSettingsServiceTests.cs"
Task: "Add test: Regular/Premium produce two independent cache rows in GasPriceLookupServiceTests.cs"
Task: "Add test: EIA request uses EPMR/EPMP facets in GasPriceLookupServiceTests.cs"
Task: "Add test: grade query-param override doesn't persist in RidesEndpointsTests.cs"

# Launch frontend service edits for User Story 1 together:
Task: "Add gasGrade to settings types in users-api.ts"
Task: "Add optional grade param to getGasPrice in ridesService.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all backend tests for User Story 2 together:
Task: "Add test: fresh (<3 day) cached row returns with zero HTTP calls in GasPriceLookupServiceTests.cs"
Task: "Add test: stale (3+ day) row triggers refresh and cache update in GasPriceLookupServiceTests.cs"
Task: "Add test: failed refresh falls back to stale price in GasPriceLookupServiceTests.cs"
Task: "Add test: concurrent stale requests de-duplicate to one HTTP call in GasPriceLookupServiceTests.cs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — schema, contracts, coordinator skeleton)
3. Complete Phase 3: User Story 1 (grade selection end-to-end)
4. **STOP and VALIDATE**: Set a gas grade preference, confirm the correct EIA series/cache row is used, confirm legacy rows are inert
5. Deploy/demo if ready — this alone resolves the core complaint (all-grades price skew)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (schema/contracts for both stories)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently (3-day freshness, refresh de-duplication, graceful fallback) → Deploy/Demo
4. Each story adds value without breaking the other — US2 layers freshness onto the same grade-aware cache key US1 introduced

### Parallel Team Strategy

With multiple developers, after Foundational (Phase 2) completes:
- Developer A: User Story 1 (grade selection, Settings UI, endpoint override)
- Developer B: User Story 2 test-writing (freshness/de-dup tests) in parallel, holding implementation until US1's `GetOrFetchAsync(grade, ...)` signature (T023) lands, then completing US2 implementation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story (US1/US2) for traceability
- Tests are REQUIRED per this repo's TDD-mandatory constitution directive — write and confirm failing before implementing
- Verify tests fail before implementing (`dotnet test` / `npm run test:unit` should show new failing tests after Phase 2/before their implementation tasks)
- Commit after each task or logical group
- Stop at either checkpoint (end of Phase 3, end of Phase 4) to validate that story independently
- Legacy `GasPriceLookups` rows (`Grade = NULL`) are NEVER migrated or backfilled — do not add a migration data task for them (FR-004a)
- `UserSettings.GasGrade` migration backfill value is `"Premium"` for pre-existing rows (T005) — do not confuse with the `"Regular"` application-level default for new rows (T024)
