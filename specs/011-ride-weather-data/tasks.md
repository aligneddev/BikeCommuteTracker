# Tasks: Weather-Enriched Ride Entries

**Feature**: `011-ride-weather-data`  
**Input**: Design documents from `/specs/011-ride-weather-data/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included and required by constitution/TDD workflow. Red tests must be written and user-confirmed before implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (no dependency on incomplete tasks in same phase)
- **[Story]**: User story this task belongs to (US1–US3)
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline config and wiring before schema/service work.

- [X] T001 Add `WeatherLookup:ApiKey` configuration key (empty default) to `src/BikeTracking.Api/appsettings.json` and `src/BikeTracking.Api/appsettings.Development.json`
- [X] T002 Register named HttpClient for weather provider in `src/BikeTracking.Api/Program.cs` with 5-second timeout for server-side lookup calls
- [X] T003 [P] Add weather API sample requests to `src/BikeTracking.Api/BikeTracking.Api.http` (create/edit ride payloads with weather fields)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema/contracts/entities all stories rely on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Create `src/BikeTracking.Api/Infrastructure/Persistence/Entities/WeatherLookupEntity.cs` with fields from data-model (`WeatherLookupId`, `LookupHourUtc`, `LatitudeRounded`, `LongitudeRounded`, weather snapshot fields, `DataSource`, `RetrievedAtUtc`, `Status`)
- [X] T005 Extend `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs` with new nullable weather fields (`WindSpeedMph`, `WindDirectionDeg`, `RelativeHumidityPercent`, `CloudCoverPercent`, `PrecipitationType`) and `WeatherUserOverridden`
- [X] T006 Extend `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`: add `DbSet<WeatherLookupEntity> WeatherLookups`; configure mapping and unique index on (`LookupHourUtc`, `LatitudeRounded`, `LongitudeRounded`)
- [X] T007 Generate EF Core migration `AddWeatherFieldsToRides` in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T008 Generate EF Core migration `AddWeatherLookupCache` in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`
- [X] T009 [P] Extend `src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs` with optional weather fields and `WeatherUserOverridden` in record + `Create(...)`
- [X] T010 [P] Extend `src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs` with optional weather fields and `WeatherUserOverridden` in record + `Create(...)`
- [X] T011 Extend `src/BikeTracking.Api/Contracts/RidesContracts.cs`: add weather fields + validation attributes to `RecordRideRequest` and `EditRideRequest`; add weather fields to `RideHistoryRow` and `RideDefaultsResponse`
- [X] T012 [P] Extend frontend ride DTOs/interfaces with new weather fields in `src/BikeTracking.Frontend/src/services/ridesService.ts`
- [X] T013 Update migration-policy mapping in `src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs` for both new migrations

**Checkpoint**: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Auto-fill weather for ride entries (Priority: P1) 🎯 MVP

**Goal**: On create and edit-save, server fetches weather for ride time and stores it in ride/event data.

**Independent Test**: Create or edit a ride with valid timestamp/location and verify weather fields are auto-populated and persisted in events/rows.

### US1 - Tests (write first, TDD-RED gate)

- [X] T014 [P] [US1] Add failing unit tests for weather lookup cache/API behavior in `src/BikeTracking.Api.Tests/Application/Rides/WeatherLookupServiceTests.cs` (cache hit/miss, endpoint routing, timeout/error fallback, precipitation type derivation)
- [X] T015 [P] [US1] Add failing service tests for create/edit auto-fetch behavior in `src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs`
- [X] T016 [P] [US1] Add failing endpoint/integration coverage for weather persistence in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs` and `src/BikeTracking.Api.Tests/Infrastructure/RidesPersistenceTests.cs`
- [X] T017 [US1] Run failing US1 backend test set and capture red output for user confirmation

### US1 - Implementation (TDD-GREEN gate)

- [X] T018 [US1] Create `src/BikeTracking.Api/Application/Rides/WeatherLookupService.cs` with `IWeatherLookupService`, `OpenMeteoWeatherLookupService`, and `WeatherSnapshot` model
- [X] T019 [US1] Implement hour-bucket cache key logic (UTC hour + rounded lat/lon), persistence, and concurrent insert handling in `src/BikeTracking.Api/Application/Rides/WeatherLookupService.cs`
- [X] T020 [US1] Implement Open-Meteo HTTP parsing and precipitation type mapping in `src/BikeTracking.Api/Application/Rides/WeatherLookupService.cs`
- [X] T021 [US1] Wire weather lookup dependency registration in `src/BikeTracking.Api/Program.cs`
- [X] T022 [US1] Extend `src/BikeTracking.Api/Application/Rides/RecordRideService.cs` to fetch weather server-side on create and merge values for save/event payload
- [X] T023 [US1] Extend `src/BikeTracking.Api/Application/Rides/EditRideService.cs` to re-fetch weather when ride timestamp changes and merge values for save/event payload
- [X] T024 [US1] Extend `src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs` and related mapping to include new weather fields
- [X] T025 [US1] Extend `src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs` to include weather defaults in response
- [X] T026 [US1] Run US1 backend tests to green (`WeatherLookupServiceTests`, `RidesApplicationServiceTests`, endpoint/persistence tests)

**Checkpoint**: US1 is independently functional and demoable.

---

## Phase 4: User Story 2 - Manual override of weather values (Priority: P2)

**Goal**: User can manually enter/override weather values and those values remain authoritative.

**Independent Test**: Edit weather fields on create/edit forms, save, and verify saved values are exactly user-provided even when auto-fetch data exists.

### US2 - Tests (write first, TDD-RED gate)

- [X] T027 [P] [US2] Add failing backend tests for override precedence (`WeatherUserOverridden`, field-level precedence) in `src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs`
- [X] T028 [P] [US2] Add failing frontend tests for weather field editing + override flag behavior in create/edit pages (`RecordRidePage.test.tsx`, `HistoryPage.test.tsx`)
- [X] T029 [US2] Run failing US2 tests and capture red output for user confirmation

### US2 - Implementation (TDD-GREEN gate)

- [X] T030 [US2] Update create/edit merge logic in `src/BikeTracking.Api/Application/Rides/RecordRideService.cs` and `src/BikeTracking.Api/Application/Rides/EditRideService.cs` so user-submitted values always win over fetched values
- [X] T031 [US2] Extend ride create form with editable weather fields and override flag handling in `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`
- [X] T032 [US2] Extend ride edit form with editable weather fields and override flag handling in `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`
- [X] T033 [US2] Add/update weather input validation messaging in form components and styles (co-located frontend files)
- [X] T034 [US2] Run US2 backend/frontend tests to green

**Checkpoint**: US2 is independently functional and demoable.

---

## Phase 5: User Story 3 - Reuse historical weather lookups (Priority: P3)

**Goal**: Avoid redundant external weather calls by reusing persisted weather lookup records.

**Independent Test**: Two saves for same hour/location should perform only one external call and reuse cached weather on the second save.

### US3 - Tests (write first, TDD-RED gate)

- [X] T035 [P] [US3] Add failing cache reuse tests (same hour/location no second HTTP call) in `src/BikeTracking.Api.Tests/Application/Rides/WeatherLookupServiceTests.cs`
- [X] T036 [P] [US3] Add failing durability test showing reuse after service restart/new scope in `src/BikeTracking.Api.Tests/Application/Rides/WeatherLookupServiceTests.cs`
- [X] T037 [US3] Run failing US3 tests and capture red output for user confirmation

### US3 - Implementation (TDD-GREEN gate)

- [X] T038 [US3] Finalize cache lookup/read-through behavior and status persistence in `src/BikeTracking.Api/Application/Rides/WeatherLookupService.cs`
- [X] T039 [US3] Add structured logging for cache hit/miss and graceful weather lookup failure paths in `src/BikeTracking.Api/Application/Rides/WeatherLookupService.cs`
- [X] T040 [US3] Run US3 tests to green and verify no regression in US1/US2 behavior

**Checkpoint**: US3 is independently functional and demoable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full verification matrix and final consistency checks.

- [X] T041 [P] Update quickstart verification notes and any changed examples in `specs/011-ride-weather-data/quickstart.md`
- [X] T042 [P] Run `csharpier format .` and resolve formatting issues in changed C# files
- [X] T043 [P] Run frontend lint/build checks from `src/BikeTracking.Frontend` (`npm run lint`, `npm run build`) and resolve issues
- [X] T044 Run backend test suite: `dotnet test BikeTracking.slnx`
- [X] T045 Run frontend unit tests: `cd src/BikeTracking.Frontend && npm run test:unit`
- [X] T046 Run frontend E2E tests: `cd src/BikeTracking.Frontend && npm run test:e2e` (with Aspire stack running)

---

## Dependencies

```text
Phase 1 (T001-T003)
  -> Phase 2 (T004-T013)
      -> Phase 3 / US1 (T014-T026)  MVP
          -> Phase 4 / US2 (T027-T034)
          -> Phase 5 / US3 (T035-T040)
              -> Phase 6 (T041-T046)
```

- US1 depends on foundational schema/contracts/service wiring.
- US2 depends on US1 weather fetch pipeline and form weather fields.
- US3 depends on US1 lookup service and cache table.
- Polish depends on all completed story work.

## Parallel Opportunities

- Phase 1: T003 can run in parallel with T001-T002.
- Phase 2: T009, T010, T012 can run in parallel after T004-T006 starts.
- US1 tests: T014, T015, T016 can be authored in parallel.
- US2 tests: T027 and T028 can be authored in parallel.
- US3 tests: T035 and T036 can be authored in parallel.
- Final checks: T042 and T043 can run in parallel before T044-T046.

## Parallel Example: US1 Test Authoring

```text
T014 src/BikeTracking.Api.Tests/Application/Rides/WeatherLookupServiceTests.cs
T015 src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs
T016 src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs + Infrastructure/RidesPersistenceTests.cs
```

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 backend auto-fetch + persistence path.
3. Validate US1 independently before continuing.

### Incremental Delivery

1. Add US2 user override behavior after US1 green.
2. Add US3 cache-reuse hardening and durability checks.
3. Finish with Phase 6 verification matrix.

### Suggested Commit Boundaries (TDD)

1. `TDD-RED: 011 weather lookup/service tests`
2. `TDD-GREEN: 011 backend auto-fetch and persistence`
3. `TDD-RED: 011 override tests`
4. `TDD-GREEN: 011 create/edit override behavior`
5. `TDD-RED: 011 cache reuse tests`
6. `TDD-GREEN: 011 cache reuse implementation`
7. `CI-GREEN: 011 weather final verification`

## Notes

- [P] tasks touch separate files or independent areas.
- [US#] labels map each task to a user story for traceability.
- Keep each story independently testable and demoable.
- Do not skip the red-test user confirmation gate before implementation.