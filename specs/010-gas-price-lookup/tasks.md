# Tasks: Gas Price Lookup at Ride Entry

**Feature**: `010-gas-price-lookup`  
**Input**: Design documents from `/specs/010-gas-price-lookup/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (no dependency on incomplete tasks in same phase)
- **[Story]**: User story this task belongs to (US1–US4)
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration baseline needed before any implementation can proceed.

- [ ] T001 Add `GasPriceLookup:EiaApiKey` configuration key to `src/BikeTracking.Api/appsettings.json` (empty default) and `src/BikeTracking.Api/appsettings.Development.json` (dev placeholder)
- [ ] T002 Register `HttpClient` named client for EIA API in `src/BikeTracking.Api/Program.cs` (base address `https://api.eia.gov`, timeout 10s)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema and backend entities that ALL user stories depend on. Must be complete before any story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Create `src/BikeTracking.Api/Infrastructure/Persistence/Entities/GasPriceLookupEntity.cs` with all columns per data-model.md (`GasPriceLookupId`, `PriceDate`, `PricePerGallon`, `DataSource`, `EiaPeriodDate`, `RetrievedAtUtc`)
- [ ] T004 Add `GasPricePerGallon decimal?` column to `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs`
- [ ] T005 Extend `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`: add `DbSet<GasPriceLookupEntity> GasPriceLookups`, configure table mapping with unique index on `PriceDate`, add `GasPricePerGallon` mapping for `Rides` table
- [ ] T006 Generate EF Core migration `AddGasPriceToRidesAndLookupCache` in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/` (creates `GasPriceLookups` table, adds `GasPricePerGallon` column to `Rides`)
- [ ] T007 [P] Add `GasPricePerGallon decimal?` to `RideRecordedEventPayload` record and its `Create` factory method in `src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs`
- [ ] T008 [P] Add `GasPricePerGallon decimal?` to `RideEditedEventPayload` record and its `Create` factory method in `src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs`
- [ ] T009 Extend `src/BikeTracking.Api/Contracts/RidesContracts.cs`: add `GasPricePerGallon decimal?` with `[Range(0.01, 999.9999)]` to `RecordRideRequest` and `EditRideRequest`; add `DefaultGasPricePerGallon decimal?` to `RideDefaultsResponse`; add new `GasPriceResponse` record with `Date`, `PricePerGallon`, `IsAvailable`, `DataSource`
- [ ] T010 [P] Add `gasPricePerGallon?: number` to `RecordRideRequest`, `EditRideRequest`, `RideDefaultsResponse`, and `RideHistoryRow` TypeScript interfaces in `src/BikeTracking.Frontend/src/services/ridesService.ts`; add `GasPriceResponse` interface

**Checkpoint**: Foundation is ready — all user story phases can now begin.

---

## Phase 3: User Story 1 — Gas Price on Ride Creation (Priority: P1) 🎯 MVP

**Goal**: The gas price field is shown and pre-populated with the EIA price for today's date on the Record Ride form. The user can edit it, and the saved ride record includes whatever value they submitted.

**Independent Test**: Open Record Ride page → confirm gas price field is pre-populated → edit the value → save → confirm ride history shows the user-entered gas price.

- [ ] T011 [US1] Create `src/BikeTracking.Api/Application/Rides/GasPriceLookupService.cs`: `IGasPriceLookupService` interface with `GetOrFetchAsync(DateOnly date)` returning `decimal?`; concrete `EiaGasPriceLookupService` registered as `Scoped` — checks `GasPriceLookups` cache first, calls EIA API v2 (`/v2/petroleum/pri/gnd/data?facets[duoarea][]=NUS&facets[product][]=EPM0&frequency=weekly&end=DATE&sort[0][column]=period&sort[0][direction]=desc&length=1&api_key=KEY`) on miss, stores result in cache, returns `null` on failure
- [ ] T012 [US1] Register `EiaGasPriceLookupService` (as `IGasPriceLookupService`) and `IHttpClientFactory` in `src/BikeTracking.Api/Program.cs`
- [ ] T013 [US1] Extend `src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs`: return `DefaultGasPricePerGallon` from the most recent ride's `GasPricePerGallon` value (null if no prior rides or no prior price)
- [ ] T014 [US1] Add `GET /api/rides/gas-price` endpoint handler to `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`: accepts `date` query param (YYYY-MM-DD), validates format, calls `IGasPriceLookupService`, returns `GasPriceResponse`; returns 400 on invalid/missing date, 401 on unauthenticated, never 5xx on EIA failure
- [ ] T015 [US1] Extend `src/BikeTracking.Api/Application/Rides/RecordRideService.cs`: accept `GasPricePerGallon decimal?` from `RecordRideRequest`, persist it to `RideEntity`, pass it to `RideRecordedEventPayload.Create`
- [ ] T016 [US1] Add `getGasPrice(date: string): Promise<GasPriceResponse>` function to `src/BikeTracking.Frontend/src/services/ridesService.ts` calling `GET /api/rides/gas-price?date={date}`
- [ ] T017 [US1] Extend `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`: add `gasPrice` state (`string`), pre-populate from `defaults.defaultGasPricePerGallon` on load, add gas price `<input type="number" step="0.0001" min="0">` field with label "Gas Price ($/gal) (optional)", pass `gasPricePerGallon` in `RecordRideRequest` on submit (parse as `parseFloat`, undefined if empty)
- [ ] T018 [US1] Add client-side gas price validation in `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`: if field is non-empty and value ≤ 0, show validation error and block submit
- [ ] T019 [US1] Write failing tests for `GasPriceLookupService` in `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: cache hit returns stored value without HTTP call; cache miss calls EIA and stores result; EIA HTTP failure returns null and does not write cache entry; second call for same date after cache miss returns cached value
- [ ] T020 [US1] Extend `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`: `GET /api/rides/gas-price` with valid date returns 200 with price shape; invalid date returns 400; unauthenticated returns 401; `POST /api/rides` with `gasPricePerGallon` stores value in ride record; `GET /api/rides/defaults` returns `defaultGasPricePerGallon` from last ride
- [ ] T021 [US1] Extend `src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx`: gas price field renders; pre-populated from defaults; user can edit value; submit passes user-entered value; negative value shows validation error and blocks submit

---

## Phase 4: User Story 2 — Fallback to Last Ride's Price (Priority: P2)

**Goal**: When EIA lookup returns unavailable (`isAvailable: false`), the gas price field retains the fallback from `DefaultGasPricePerGallon` (last ride). If no prior ride has a price, field is empty.

**Independent Test**: Set EIA key to invalid (force unavailable), open Record Ride form with a prior ride that had a gas price → confirm gas price field shows the prior ride's price, not empty.

- [ ] T022 [US2] Add date-change handler to `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`: when `rideDateTimeLocal` changes, debounce 300ms then call `getGasPrice(date)` and update `gasPrice` state only if `isAvailable`; if `isAvailable=false`, leave `gasPrice` unchanged (fallback retained from defaults or prior date call)
- [ ] T023 [US2] Write failing Vitest test in `src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx`: when `getGasPrice` returns `isAvailable=false`, gas price field still shows the default fallback value from `getRideDefaults`
- [ ] T024 [US2] Write failing Vitest test in `src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx`: when `getGasPrice` returns `isAvailable=false` and no default exists, gas price field is empty

---

## Phase 5: User Story 3 — Gas Price on Ride Edit (Priority: P3)

**Goal**: The inline edit form on the History page shows the gas price for the selected ride, pre-populated. Date changes refresh it. User can overwrite. Saved edit stores the user's value.

**Independent Test**: Edit an existing ride on the History page → confirm gas price field shows the stored value → change the date → confirm gas price refreshes → overwrite → save → confirm history row shows updated price.

- [ ] T025 [US3] Extend `src/BikeTracking.Api/Application/Rides/EditRideService.cs`: accept `GasPricePerGallon decimal?` from `EditRideRequest`, persist to `RideEntity`, pass to `RideEditedEventPayload.Create`
- [ ] T026 [US3] Extend `RideHistoryRow` API mapping in `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs` (or the query service): include `GasPricePerGallon` in the history row projection from `RideEntity`
- [ ] T027 [US3] Extend `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`: add `gasPricePerGallon` to inline edit form state, pre-populate from `ride.gasPricePerGallon` when edit opens, add gas price `<input type="number" step="0.0001" min="0">` field with label "Gas Price ($/gal)", pass `gasPricePerGallon` in `EditRideRequest` on submit
- [ ] T028 [US3] Add date-change handler to inline edit form in `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`: when date field changes, debounce 300ms then call `getGasPrice(newDate)`; update gas price field if `isAvailable`, retain current value if not
- [ ] T029 [US3] Add gas price column to the ride history table in `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`: display `gasPricePerGallon` in the history table (format as `$X.XXXX` or "N/A")
- [ ] T030 [US3] Extend `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs`: `PUT /api/rides/{id}` with `gasPricePerGallon` stores updated value; `GET /api/rides/history` response rows include `gasPricePerGallon`
- [ ] T031 [US3] Extend `src/BikeTracking.Frontend/src/pages/HistoryPage.test.tsx`: gas price column renders in history table; edit form shows pre-populated gas price; date change triggers gas price refresh; user can overwrite gas price; submit passes user-entered value

---

## Phase 6: User Story 4 — Cache Prevents Redundant EIA Calls (Priority: P4)

**Goal**: Once a price is cached for a date, no further EIA HTTP calls are made for that date — across form loads and app restarts.

**Independent Test**: Call `GET /api/rides/gas-price?date=X` twice for the same date; confirm EIA API is only hit once (inspectable via test mock call count or integration log).

- [ ] T032 [US4] Write failing test in `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: two sequential calls for the same date result in exactly one EIA HTTP request (second call hits cache)
- [ ] T033 [US4] Write failing test in `src/BikeTracking.Api.Tests/Application/GasPriceLookupServiceTests.cs`: after app restart (new service instance, same DbContext with existing cache row), lookup returns cached value without HTTP call

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Validation completeness, formatting, and CI verification.

- [ ] T034 [P] Add `gasPricePerGallon` to `RecordRideApiHost.RecordRideAsync` test helper in `src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs` so existing seeding helpers can set gas price on test rides
- [ ] T035 [P] Run `csharpier format .` from repo root and fix any formatting issues in new/modified C# files
- [ ] T036 [P] Run `cd src/BikeTracking.Frontend && npm run lint` and fix any ESLint/Stylelint issues in new/modified TypeScript/CSS files
- [ ] T037 Run `dotnet test BikeTracking.slnx` — confirm all backend tests pass
- [ ] T038 Run `cd src/BikeTracking.Frontend && npm run test:unit` — confirm all frontend unit tests pass
- [ ] T039 Run `cd src/BikeTracking.Frontend && npm run build` — confirm no TypeScript compilation errors

---

## Dependencies

```
Phase 1 (T001–T002)
  └─ Phase 2 (T003–T010)  [T007, T008, T010 parallelizable within phase]
       ├─ Phase 3 / US1 (T011–T021)   🎯 MVP — implement first
       │     └─ Phase 4 / US2 (T022–T024)  [depends on US1 date field + getGasPrice()]
       │     └─ Phase 5 / US3 (T025–T031)  [depends on US1 backend + US1 getGasPrice()]
       │           └─ Phase 6 / US4 (T032–T033)  [depends on GasPriceLookupService from T011]
       └─ Final Phase (T034–T039)  [after all stories complete]
```

**Parallel opportunities within US1 (Phase 3)**:
- T011 + T013 (service + defaults extension) can run in parallel with T016 + T018 (frontend service + validation)
- T019 + T020 (backend tests) can run in parallel with T021 (frontend tests)

**Parallel opportunities within US3 (Phase 5)**:
- T025 + T026 (API backend) can run in parallel with T027 + T028 + T029 (frontend)
- T030 (backend tests) can run in parallel with T031 (frontend tests)

---

## Implementation Strategy

**Start with Phase 3 (US1) only** — it is the complete MVP:
- `GasPriceLookupService` + `GET /api/rides/gas-price` endpoint
- `RecordRide` saving gas price
- Gas price field on Record Ride page with fallback from defaults

**US2 and US3 can be implemented independently after US1** — US2 adds the date-change refresh behavior to the existing field; US3 extends the pattern to the edit form.

**US4 (cache correctness tests) can be written alongside US1** since `GasPriceLookupService` is created in T011.

**Suggested commit boundaries**:
1. `TDD-RED: 010 gas price cache + endpoint failing tests` (after T019, T020)
2. `TDD-GREEN: 010 gas price backend — cache + EIA + endpoint` (after T011–T015)
3. `TDD-RED: 010 gas price frontend failing tests` (after T021)
4. `TDD-GREEN: 010 gas price frontend Record Ride field` (after T016–T018)
5. `TDD-GREEN: 010 gas price fallback + edit form + history table` (after US2, US3)
6. `TDD-GREEN: 010 gas price cache redundancy tests` (after US4)
