# Research: Gas Price Lookup at Ride Entry

**Feature**: 010-gas-price-lookup  
**Branch**: `010-gas-price-lookup`  
**Date**: 2026-03-31

---

## Decision 1: External Gas Price Data Source

**Decision**: Use the EIA (U.S. Energy Information Administration) Open Data API v2 for weekly national average retail gasoline prices.

**Rationale**: The EIA is a U.S. government source with data back to 1990. It is free, reliable, and published weekly. The team-managed free API key avoids any end-user setup. No third-party dependency risk.

**Alternatives considered**:
- Keyless web scraping / unofficial aggregators — rejected: brittle, legally uncertain, no stability guarantee.
- GasBuddy or other commercial APIs — rejected: paid tiers, account management overhead, no government-grade reliability.
- Embedding a static price table — rejected: goes stale and requires manual maintenance.

**EIA API Details**:

| Field | Value |
|---|---|
| Endpoint | `https://api.eia.gov/v2/petroleum/pri/gnd/data` |
| Series | `EMM_EPM0_PTE_NUS_DPG` (All Grades, All Formulations, National U.S.) |
| Key param | `?api_key=YOUR_KEY` (query string, not header) |
| Date field | `period` (YYYY-MM-DD string, Monday of survey week) |
| Price field | `value` (string, $/GAL — parse as decimal) |
| Frequency | Weekly (Mondays) |
| Coverage | 1990-08-20 → present; ~1-2 hour lag after Monday 4PM ET |
| Rate limit | ~9,000 req/hr sustained, ~5 req/sec burst |

**Lookup strategy for arbitrary date**: Query with `end=TARGET_DATE`, `sort[0][column]=period`, `sort[0][direction]=desc`, `length=1` → returns the most recent available weekly price on or before the given date.

**Caveats**:
- Weekly granularity only — the returned price may be from up to 7 days before the target date (up to ~2 weeks during holiday gaps). This is acceptable per the spec's "weekly granularity is fine" assumption.
- For future dates (beyond latest available data), the API returns the most recent available point — this is acceptable fallback behavior.

---

## Decision 2: Where Gas Price Lookup Happens (Client vs. Server)

**Decision**: Server-side lookup via a new `GET /api/rides/gas-price?date=YYYY-MM-DD` endpoint. The frontend calls this endpoint; the API handles EIA communication and caching.

**Rationale**:
- The EIA API key must not be shipped to or accessible from the client (browser).
- The durable cache (`GasPriceLookupEntity` in SQLite) lives on the server, where it is shared across all form loads.
- Keeps the frontend contract simple: one endpoint call per date change, returns a nullable decimal.

**Alternatives considered**:
- Frontend calls EIA directly — rejected: exposes the API key in browser network traffic.
- Embed cache in frontend `localStorage` — rejected: per-browser, not durable across reinstalls, inconsistent across multiple users on the same machine.

---

## Decision 3: Gas Price Cache Strategy

**Decision**: Durable SQLite table (`GasPriceLookups`) keyed by calendar date (not datetime). One row per date. Once a price is stored for a date, it is never re-fetched from EIA. If the EIA call fails or returns no data, nothing is written to the cache — the next request will retry the EIA lookup.

**Rationale**: Immutable cache per date (week) matches EIA's weekly granularity. The cache doubles as a history of prices seen, useful for future calculations. Not caching failures means the system will retry on transient outages without manual intervention.

**Alternatives considered**:
- Time-based cache expiry (TTL) — rejected: weekly prices don't change after publication; TTL adds complexity with no benefit.
- In-memory cache (IMemoryCache) — rejected: doesn't survive app restarts; defeats the durable reuse requirement.

---

## Decision 4: Gas Price Field on Forms — UX Pattern

**Decision**: 
1. The gas price field is shown on both the RecordRide and Edit Ride forms. It is pre-populated via the existing `GET /api/rides/defaults` endpoint (extended to include `DefaultGasPricePerGallon` from the user's last ride).
2. When the user changes the ride date, the frontend calls `GET /api/rides/gas-price?date=YYYY-MM-DD` to refresh the gas price field for the new date. This call is debounced (300ms) to avoid excessive API calls during rapid date edits.
3. The user may overwrite the field at any time. Whatever is in the field at submit time is sent in the request.
4. If the gas price endpoint returns null/unavailable, the field retains whatever value it had (from defaults, from the previous date's price, or whatever the user entered). This means on initial load, if EIA is unavailable, the fallback from `defaults` (last ride's price) is used.

**Rationale**: Parallels the existing `temperature` field pattern (pre-populated, user-overridable, nullable). The `defaults` endpoint already provides a natural entry point for the initial fallback. The date-change fetch makes the form feel responsive without blocking save.

**Alternatives considered**:
- Fetch gas price at save time only (server-side, not shown to user before submit) — rejected: spec explicitly requires the price to be shown and editable before submit.
- Always re-fetch on every date keystroke — rejected: excessive API calls; debounce is the right pattern.

---

## Decision 5: Existing Code Integration Points

**Decision**: The following existing code is extended (not replaced):

| File | Change |
|---|---|
| `RideEntity` | Add `GasPricePerGallon decimal?` column |
| `RecordRideRequest` | Add `GasPricePerGallon decimal?` optional parameter |
| `EditRideRequest` | Add `GasPricePerGallon decimal?` optional parameter |
| `RideDefaultsResponse` | Add `DefaultGasPricePerGallon decimal?` |
| `RideRecordedEventPayload` | Add `GasPricePerGallon decimal?` |
| `RideEditedEventPayload` | Add `GasPricePerGallon decimal?` |
| `RideHistoryRow` (frontend TS) | Add `gasPricePerGallon?: number` |
| `RecordRideRequest` (frontend TS) | Add `gasPricePerGallon?: number` |
| `EditRideRequest` (frontend TS) | Add `gasPricePerGallon?: number` |
| `RideDefaultsResponse` (frontend TS) | Add `defaultGasPricePerGallon?: number` |
| `RecordRidePage.tsx` | Add gas price field, date-change handler |
| `HistoryPage.tsx` | Add gas price field to inline edit form |

**New additions**:

| New File/Entity | Purpose |
|---|---|
| `GasPriceLookupEntity` | EF Core entity; the durable cache table |
| `GasPriceLookupContract` (TS interface) | Frontend type for `/api/rides/gas-price` response |
| `IGasPriceLookupService` (C#) | Interface to allow EIA client to be mocked in tests |
| `EiaGasPriceLookupService` (C#) | Calls EIA API, reads/writes the cache table |
| `GasPriceController endpoint` | `GET /api/rides/gas-price?date=YYYY-MM-DD` |
| Migration | Add `GasPriceLookups` table; add `GasPricePerGallon` to `Rides` |

---

## Decision 6: EIA API Key Configuration

**Decision**: The EIA API key is stored in `appsettings.json` / `appsettings.Development.json` under a `GasPriceLookup:EiaApiKey` configuration key. In development, it can be overridden via `dotnet user-secrets`. The secure production storage mechanism (Azure Key Vault, environment variable injection) is deferred and out of scope for this feature.

**Rationale**: Follows the existing pattern already in use in this app for other secrets (e.g., auth configuration). No new secret infrastructure is introduced.
