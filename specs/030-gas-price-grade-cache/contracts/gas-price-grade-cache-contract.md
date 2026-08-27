# Contract: Gas Price Grade Selection & Cache Refresh Policy

This feature modifies two existing endpoints/resources — it does not introduce a new endpoint.

## 1. `GET /api/rides/gas-price`

**Existing route, extended.**

### Request

| Parameter | Location | Type | Required | Notes |
|-----------|----------|------|----------|-------|
| `date` | query | `string` (`YYYY-MM-DD`) | yes | unchanged |
| `grade` | query | `string` (`"Regular"` \| `"Premium"`, case-insensitive) | **no (NEW)** | When present and valid, overrides the rider's saved `GasGrade` preference for this call only. When omitted, the rider's saved preference is used (or `"Regular"` if the rider has no settings row). |

### Response `200 OK` — `GasPriceResponse` (extended)

```json
{
  "date": "2026-08-24",
  "pricePerGallon": 3.219,
  "isAvailable": true,
  "dataSource": "Source: U.S. Energy Information Administration (EIA)",
  "grade": "Regular"
}
```

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `date` | `string` | unchanged | |
| `pricePerGallon` | `number \| null` | unchanged | |
| `isAvailable` | `boolean` | unchanged | |
| `dataSource` | `string \| null` | unchanged | |
| `grade` | `string` | **NEW** | The grade actually used to resolve this response (`"Regular"` or `"Premium"`) — either the `grade` query-param override or the rider's saved preference. Always present, even when `isAvailable` is `false`, so callers/tests can confirm which grade was attempted. |

### Response `400 Bad Request` — `ErrorResponse` (extended condition)

- Existing: missing/invalid `date` → `INVALID_REQUEST`.
- **New**: `grade` present but not `"Regular"`/`"Premium"` (case-insensitive) → `400 INVALID_REQUEST` with the same `ErrorResponse` shape, e.g.:
  ```json
  { "code": "INVALID_REQUEST", "message": "grade query parameter, if provided, must be 'Regular' or 'Premium'." }
  ```

### Behavioral Rules

1. Effective grade resolution order: `grade` query param (if valid) → rider's saved `UserSettingsEntity.GasGrade` → `"Regular"` (no-settings-row default). This mirrors the existing `apiKey` resolution precedent (`userSettings?.EiaGasApiKey` → app-config fallback) already in `GetGasPrice`.
2. Cache lookup/write always keys on `(WeekStartDate, effectiveGrade)` — never on `date`/`WeekStartDate` alone (FR-004).
3. A cached row younger than 3 days (`RetrievedAtUtc`) for the effective `(week, grade)` is returned without any external call (FR-006).
4. A cached row 3+ days old triggers a de-duplicated refresh attempt (FR-007/FR-007a); on success the new price/timestamp replace the row; on failure the prior stale price is still returned (FR-009).
5. A pre-feature legacy row (`Grade = NULL`) for the same `WeekStartDate` is never returned or matched — a lookup that only finds a legacy row is treated as a full cache miss and triggers a fresh external fetch (FR-004a).
6. Manually overriding `grade` via the query parameter never persists to `UserSettingsEntity.GasGrade` (FR-011 — "overrides... for that single request").

## 2. `GET /api/users/settings` and `PUT /api/users/settings` (existing settings endpoints backing `UserSettingsService`)

> Route names as currently exposed by `UsersEndpoints`/equivalent; only the payload shape changes here.

### `UserSettingsView` / `UserSettingsResponse` (GET) — extended

```json
{
  "hasSettings": true,
  "settings": {
    "averageCarMpg": 32.5,
    "yearlyGoalMiles": 3000,
    "oilChangePrice": 45,
    "mileageRateCents": 67,
    "locationLabel": "Downtown",
    "latitude": 39.1,
    "longitude": -84.5,
    "dashboardGallonsAvoidedEnabled": true,
    "dashboardGoalProgressEnabled": true,
    "updatedAtUtc": "2026-08-27T12:00:00Z",
    "weatherApiKey": null,
    "eiaGasApiKey": null,
    "gasGrade": "Premium"
  }
}
```

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `gasGrade` | `string` | **NEW** | Always present, always `"Regular"` or `"Premium"`. `"Regular"` for a rider with `hasSettings: false` (no row yet) or a post-feature settings row that has never set it explicitly; `"Premium"` for any rider whose settings row existed before this feature's migration ran. |

### `UserSettingsUpsertRequest` (PUT) — extended

```json
{
  "gasGrade": "Regular"
}
```

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `gasGrade` | `string?` | **NEW** | Optional on the wire, following the existing partial-update convention (`providedFields`). When provided, MUST be `"Regular"` or `"Premium"` (case handling left to the same validation approach used for other constrained fields) or the request is rejected with the existing `UsersErrorCodes.ValidationFailed` shape. When omitted, the rider's existing `GasGrade` is left unchanged. |

### Behavioral Rules

1. Changing `gasGrade` never retroactively alters gas prices already stored on previously recorded rides (FR-005) — it only affects the *next* `GET /api/rides/gas-price` call's default grade resolution.
2. The migration backfills `gasGrade = "Premium"` for every `UserSettings` row that exists at migration time; the application-level default of `"Regular"` applies only to rows created via `UserSettingsService` after the migration has run (FR-002 vs. FR-002a).

## Consumer Rules for Spec #030

1. `RidesEndpointsTests` (backend) must assert: (a) omitting `grade` uses the rider's saved preference, (b) a valid `grade` override changes the returned `grade`/price series without persisting to settings, (c) an invalid `grade` value returns `400 INVALID_REQUEST`, (d) the response always includes `grade` even when `isAvailable` is `false`.
2. `GasPriceLookupServiceTests` (backend) must assert: (a) a fresh (`< 3 days`) cached row for `(week, grade)` is returned without an HTTP call, (b) a stale (`>= 3 days`) row triggers exactly one HTTP call even under simulated concurrent callers for the same `(week, grade)`, (c) a failed refresh returns the prior stale price rather than `null`, (d) a legacy `Grade = NULL` row is never returned for a grade-aware query and instead triggers a fresh fetch, (e) `Regular` and `Premium` requests for the same week produce two independent cache rows.
3. `UserSettingsServiceTests` (backend) must assert: (a) a rider with no settings row sees `gasGrade: "Regular"` as the read-side default, (b) saving `gasGrade` persists and round-trips, (c) an invalid `gasGrade` value is rejected.
4. Migration tests / manual verification must confirm all pre-existing `UserSettings` rows read `gasGrade: "Premium"` immediately after the migration runs, with no manual intervention.
5. Frontend `SettingsPage` tests must assert the grade selector renders, defaults per the above rules, and saves via `users-api.ts`.

## Formula/Policy Requirements (Spec Source of Truth)

- Freshness window: `now - RetrievedAtUtc < 3 days` ⇒ fresh (reuse, no external call); `>= 3 days` ⇒ stale (attempt refresh) (FR-006/FR-007).
- Cache key: `(WeekStartDate, Grade)`, `Grade ∈ {"Regular", "Premium"}` for all post-feature rows (FR-004).
- Concurrency: at most one external call per `(week, grade)` per staleness event (FR-007a/SC-003).
- Legacy rows (`Grade = NULL`): permanently inert, never matched, never migrated (FR-004a).
- Settings defaults: new rows → `"Regular"` (FR-002); pre-existing rows at migration time → `"Premium"` (FR-002a).

Backend contracts (`RidesContracts.cs`, `UsersContracts.cs`) and frontend TypeScript models (`ridesService.ts`, `users-api.ts`) must stay synchronized for these new fields in the same change.
