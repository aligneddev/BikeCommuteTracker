# Phase 1 Data Model: Gas Price Grade Selection & Cache Refresh Policy

## Modified Entities

### `GasPriceLookupEntity` (table: `GasPriceLookups`)

| Field | Type | Change | Rules |
|-------|------|--------|-------|
| `GasPriceLookupId` | `int` (PK) | unchanged | identity |
| `PriceDate` | `DateOnly` | unchanged | required |
| `WeekStartDate` | `DateOnly` | unchanged | required; Sunday-of-ISO-week per `GasPriceWeekKeyHelper` |
| `Grade` | `string?` | **NEW** | nullable at DB level; `NULL` only ever appears on pre-feature legacy rows. Every row written by post-feature code sets this to the literal `"Regular"` or `"Premium"` — never `NULL`, never any other value. |
| `PricePerGallon` | `decimal` | unchanged | required, precision (10,4), must be `> 0` (existing validation) |
| `DataSource` | `string` | unchanged | required, max length 64 (existing value: `"EIA_EPM0_NUS_Weekly"` for legacy rows; new rows continue to use a source label reflecting the grade-specific series, e.g. `"EIA_EPMR_NUS_Weekly"` / `"EIA_EPMP_NUS_Weekly"`) |
| `EiaPeriodDate` | `DateOnly` | unchanged | required |
| `RetrievedAtUtc` | `DateTime` | unchanged (usage extended) | required; now also read (not just written) — drives the 3-day freshness check via `TimeProvider.GetUtcNow()` |

**Index changes**:
- Remove: `HasIndex(x => x.PriceDate).IsUnique()` — **unchanged, kept as-is** (still present; grade does not change the price-date uniqueness expectation for a *given* week+grade... actually `PriceDate` unique index predates grade-awareness and is superseded — see note below).
- Remove: `HasIndex(x => x.WeekStartDate).IsUnique()`.
- Add: `HasIndex(x => new { x.WeekStartDate, x.Grade }).IsUnique()` — the new cache key. Because SQLite indexes treat each `NULL` as distinct, multiple legacy rows (`Grade = NULL`) for different (or even the same) `WeekStartDate` do not violate this unique index amongst themselves, and never collide with new graded rows.

  > **Note on the existing `PriceDate` unique index**: The current schema has *two* unique indexes (`PriceDate` and `WeekStartDate` independently), which is stricter than necessary now that the true cache key is `(WeekStartDate, Grade)` — a given `PriceDate` could legitimately need two rows (one per grade) once grade-awareness lands. The migration MUST drop the standalone unique index on `PriceDate` (replacing enforcement of "one row per priced day" with the new composite key), since keeping it would block writing both a Regular and a Premium row that happen to share the same representative `PriceDate` for a given lookup. `PriceDate` remains a required, non-unique column.

**Validation/Rules**:
- `Grade`, when non-null, MUST be one of `"Regular"` / `"Premium"` (validated in `EiaGasPriceLookupService`, mirroring how `UserSettingsService` validates `GasGrade`).
- A row is considered **fresh** iff `TimeProvider.GetUtcNow().UtcDateTime - RetrievedAtUtc < TimeSpan.FromDays(3)`; **stale** otherwise (FR-006/FR-007).
- A stale row is never deleted outright — it is only replaced in-place (same `GasPriceLookupId`, updated `PricePerGallon`/`DataSource`/`EiaPeriodDate`/`RetrievedAtUtc`) when a refresh succeeds and returns a valid (`> 0`) price (FR-008/FR-010); on refresh failure, the stale row is returned unchanged (FR-009).

### `UserSettingsEntity` (table: `UserSettings`)

| Field | Type | Change | Rules |
|-------|------|--------|-------|
| `GasGrade` | `string` | **NEW** | non-nullable; allowed values `"Regular"` / `"Premium"`; CLR default `"Regular"` for newly-constructed rows (FR-002); pre-existing rows backfilled to `"Premium"` by the migration (FR-002a) |

**New CHECK constraint** (mirroring existing `CK_UserSettings_*` pattern):
```sql
CK_UserSettings_GasGrade_Valid: "GasGrade" IN ('Regular', 'Premium')
```

**Validation/Rules**:
- `UserSettingsService.SaveAsync` treats `GasGrade` like other provided-fields-aware settings (only updated when explicitly included in `providedFields`, per the existing partial-update convention), rejecting any value outside `{"Regular", "Premium"}` with the existing validation-failure result shape (`UserSettingsResult`/`UsersErrorCodes.ValidationFailed`).
- `UserSettingsService.GetAsync` for a rider with no existing settings row continues to report `HasSettings: false`; the *view's* `GasGrade` in that no-row case is `"Regular"` (the FR-002 default), never `null` and never `"Premium"` (the `"Premium"` backfill only applies to rows that already existed at migration time — a rider who signs up after the feature ships and has never saved settings sees `"Regular"`).

## Migration: `AddGasGradeAndCacheRefreshPolicy` (name illustrative; follow existing `yyyyMMddHHmmss_Description` convention)

1. `AddColumn<string>("Grade")` on `GasPriceLookups`, nullable, no default (legacy rows become `NULL`).
2. `DropIndex` on `GasPriceLookups.PriceDate` (unique) and `GasPriceLookups.WeekStartDate` (unique).
3. `CreateIndex` unique on `GasPriceLookups (WeekStartDate, Grade)`.
4. `AddColumn<string>("GasGrade")` on `UserSettings`, non-nullable, with a migration-time default of `'Premium'` applied via the column-add default (or an explicit `UPDATE "UserSettings" SET "GasGrade" = 'Premium'` immediately after adding the column with a temporary default), so every row that existed before this migration ends up with `"Premium"` explicitly (FR-002a), and the column's ongoing application-level default for rows inserted afterward is `"Regular"` (enforced in `UserSettingsService`, not as a changing DB default, to avoid a second migration if the default logic is later revisited).
5. Add CHECK constraint `CK_UserSettings_GasGrade_Valid`.

**Rollback consideration**: Down-migration removes the CHECK constraint, drops `GasGrade`, drops the composite unique index, drops `Grade`, and restores the two prior standalone unique indexes on `GasPriceLookups` — acceptable since this is a reversible schema change with no destructive data loss beyond the (already-inert) `Grade` values.

## Contract Shape Changes

### `GasPriceResponse` (`src/BikeTracking.Api/Contracts/RidesContracts.cs`)
- **Add**: `Grade: string` — the grade actually used for this lookup (resolved from the query-param override or the rider's saved preference), so the frontend/tests can confirm which grade produced the returned price, even when `IsAvailable` is `false`.

### `GetGasPrice` endpoint (`GET /api/rides/gas-price`)
- **Add**: optional query parameter `grade` (`string`, `"Regular"` or `"Premium"`, case-insensitive). When present and valid, overrides the rider's saved `GasGrade` for this single call only (not persisted). When omitted, the rider's saved `UserSettingsEntity.GasGrade` is used (defaulting to `"Regular"` if the rider has no settings row at all — same default as Settings). An invalid `grade` value (anything other than `"Regular"`/`"Premium"`) returns the existing `400 INVALID_REQUEST` shape.

### `UserSettingsUpsertRequest` / `UserSettingsView` (`src/BikeTracking.Api/Contracts/UsersContracts.cs`)
- **Add**: `GasGrade: string?` on both records, following the same optional/partial-update convention as `WeatherApiKey`/`EiaGasApiKey` (nullable on the wire; validated/defaulted server-side).

## Presentation State Rules (Frontend)

- `SettingsPage` renders a "Gas Grade" selector (e.g., a two-option radio group or `<select>`: Regular / Premium) alongside the existing rider-level preferences (API keys, location), defaulting to whatever `UserSettingsResponse.Settings.GasGrade` returns (`"Regular"` for a rider with no settings row yet, `"Premium"` for a pre-existing rider whose settings were backfilled).
- `ridesService.getGasPrice` gains an optional `grade` parameter so a future preview/testing UI (or the ride form, if desired) can pass an explicit override; when omitted, the backend resolves the rider's saved preference — the frontend does not need to duplicate the default-resolution logic.
- Ride creation/edit forms continue to display the fetched price as a pre-filled, overridable suggestion (unchanged behavior); no new UI element is required on the ride form itself beyond continuing to call the existing gas-price endpoint (grade resolution happens server-side from the rider's saved setting).

## Relationship/Flow

`UserSettingsEntity.GasGrade` (rider preference, or `grade` query-param override) → `RidesEndpoints.GetGasPrice` (resolves effective grade) → `IGasPriceLookupService.GetOrFetchAsync(date, weekStart, grade, apiKey)` → cache read keyed by `(WeekStartDate, Grade)` → **fresh** (`< 3 days` old): return cached price as-is → **stale** (`>= 3 days` old) or **miss**: `GasPriceRefreshCoordinator` de-duplicates concurrent refreshes for the same `(week, grade)` key → EIA HTTP call using the grade-mapped product facet (`EPMR`/`EPMP`) → on success, upsert the `(WeekStartDate, Grade)` row and return the new price; on failure, return the prior stale value unchanged (or `null` if there was no prior cached row at all) → `GasPriceResponse` (including `Grade`) → frontend `getGasPrice` → ride form's pre-filled (overridable) gas price field.
