# Quickstart Validation: Gas Price Grade Selection & Cache Refresh Policy

Use this to validate spec #030 end-to-end after implementation.

## Prerequisites

1. Run app stack:
   - `dotnet run --project src/BikeTracking.AppHost`
2. Have a rider account, and know whether it existed before this feature's migration ran (to test the `"Premium"` backfill) or was created after (to test the `"Regular"` default).
3. A valid EIA API key configured (`GasPriceLookup:EiaApiKey` app setting, or a rider-specific `EiaGasApiKey` in Settings) if validating live external fetch behavior; otherwise use the stubbed-HTTP backend tests for deterministic verification.

## Backend Validation

1. Run backend tests:
   - `dotnet test BikeTracking.slnx`
2. Confirm `GasPriceLookupServiceTests` assert:
   - A cached `(week, grade)` row younger than 3 days is returned with zero HTTP calls.
   - A cached row 3+ days old triggers exactly one HTTP call, even when multiple concurrent callers request the same stale `(week, grade)` simultaneously (de-duplication via `GasPriceRefreshCoordinator`).
   - A failed refresh (HTTP error / exception) returns the previous stale price, not `null`.
   - Requesting `Regular` and `Premium` for the same week produces two independent cache rows, each individually cacheable/staleable.
   - A pre-feature `Grade = NULL` row is never returned for any grade-aware request; the lookup instead performs a fresh external fetch and creates a new graded row.
   - The EIA request uses product facet `EPMR` for Regular and `EPMP` for Premium (not the legacy `EPM0`).
3. Confirm `RidesEndpointsTests` assert:
   - `GET /api/rides/gas-price?date=...` (no `grade`) uses the rider's saved `GasGrade` preference.
   - `GET /api/rides/gas-price?date=...&grade=Premium` overrides the saved preference for that call only, without persisting it.
   - An invalid `grade` value returns `400 INVALID_REQUEST`.
   - The response always includes a `grade` field, even when `isAvailable` is `false`.
4. Confirm `UserSettingsServiceTests` assert:
   - A rider with no settings row reads `gasGrade: "Regular"`.
   - Saving `gasGrade` persists and round-trips via `GET`/`PUT`.
   - An invalid `gasGrade` value is rejected with the existing validation-failure shape.
5. Confirm the new EF Core migration:
   - Adds nullable `Grade` to `GasPriceLookups`, replaces the prior `PriceDate`/`WeekStartDate` unique indexes with a single unique `(WeekStartDate, Grade)` index.
   - Adds non-nullable `GasGrade` to `UserSettings`, backfilling every pre-existing row to `"Premium"`.
   - Applying the migration against a database seeded with pre-feature `GasPriceLookups`/`UserSettings` rows leaves those rows' data otherwise untouched (only the new column/index shape changes).

## Frontend Validation

1. Run frontend unit tests:
   - `cd src/BikeTracking.Frontend && npm run test:unit`
2. Run E2E tests:
   - `cd src/BikeTracking.Frontend && npm run test:e2e`
3. Confirm tests verify:
   - `SettingsPage` renders a Gas Grade selector (Regular/Premium), defaulted per the resolved `gasGrade` value from `GET /api/users/settings`.
   - Changing and saving the selector persists via `PUT /api/users/settings` and is reflected immediately (no reload required) in the next gas price fetch within the same session (SC-002).
   - The ride creation form's suggested gas price reflects the rider's currently selected grade.

## Manual Check

1. Log in as a rider whose settings existed before this feature shipped; open Settings and verify the Gas Grade selector shows "Premium" pre-selected (backfilled), not "Regular".
2. Log in as (or create) a rider with no prior settings row; open Settings and verify Gas Grade defaults to "Regular".
3. Set Gas Grade to "Regular", open the ride creation form for any date, and verify the suggested gas price is fetched (check the network response's `grade`/`dataSource` or the `GasPriceLookups` row's `DataSource`) using the regular-grade series; repeat with "Premium" and verify a different (higher, typically) price/series is used.
4. Change the grade preference, reopen a ride form for a date already cached under the old grade, and verify the system fetches/reuses a price for the *new* grade, not the old cached value (Acceptance Scenario 4, US1).
5. Seed (or wait out) a cache row older than 3 days for a given `(week, grade)`; reload the ride form for a covered date and verify a fresh external call occurs and the cache entry updates (`RetrievedAtUtc` advances). Reload again immediately and verify no further external call occurs (still fresh).
6. Simulate an EIA outage (e.g., temporarily point `GasPriceLookup:EiaApiKey` at an invalid value) with a stale cache entry present, and verify the rider still sees the last known (stale) price rather than a blank value.
7. Verify gas prices already recorded on rides created before this feature shipped are unchanged after deployment (spot-check a historical ride's stored `GasPricePerGallon`).

## Final Validation Matrix

| Area | Command/Check | Expected Result |
|------|----------------|-----------------|
| Backend unit/integration tests | `dotnet test BikeTracking.slnx` | Pass; grade-aware caching, 3-day staleness, refresh de-duplication, legacy-row non-match, settings default/backfill, and endpoint override all covered |
| Migration verification | Apply migration against a pre-feature-seeded DB | `GasPriceLookups.Grade` added (nullable, legacy rows `NULL`); new composite unique index in place; `UserSettings.GasGrade` added (non-nullable), all pre-existing rows read `"Premium"` |
| Frontend unit suite | `cd src/BikeTracking.Frontend && npm run test:unit` | Pass; `SettingsPage` renders/saves/defaults the Gas Grade selector correctly |
| Frontend E2E suite | `cd src/BikeTracking.Frontend && npm run test:e2e` | Pass; setting Gas Grade in Settings is reflected in the ride form's suggested price within the same session |
| Manual check | Steps above | Grade selection changes fetched price/series; 3-day staleness refreshes and falls back gracefully on failure; legacy rows inert; existing ride prices unchanged |

## Command Checklist

- [ ] `dotnet test BikeTracking.slnx`
- [ ] `cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit`
- [ ] `cd src/BikeTracking.Frontend && npm run test:e2e`

## References

- Spec: [spec.md](spec.md)
- Research: [research.md](research.md)
- Data model: [data-model.md](data-model.md)
- Contract: [contracts/gas-price-grade-cache-contract.md](contracts/gas-price-grade-cache-contract.md)
