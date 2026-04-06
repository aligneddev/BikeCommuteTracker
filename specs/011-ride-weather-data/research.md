# Research: Weather-Enriched Ride Entries

**Feature**: 011-ride-weather-data  
**Date**: 2026-04-03  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Weather API Provider

**Decision**: Use [Open-Meteo](https://open-meteo.com/) as the weather provider.

**Rationale**:
- Completely free and open — no API key required for default use, yet the application configures a key
  slot (graceful fallback when unconfigured satisfies FR-001a with zero setup friction).
- Full historical archive from 1940 to present via `archive-api.open-meteo.com`, plus
  near-real-time current weather via `api.open-meteo.com` with `past_days` parameter.
- Returns hourly data for all six required fields in a single request: temperature, wind speed,
  wind direction, relative humidity, cloud cover, and precipitation amount; WMO weather codes
  disambiguate precipitation type (rain vs. snow vs. sleet).
- No rate-limit concerns for a local-first single-user app.
- REST/JSON; no SDK or paid subscription required.

**Alternatives considered**:
- **WeatherAPI.com** — free tier (1M calls/month) with key; good historical coverage from 2010.
  Ruled out because Open-Meteo covers earlier dates, needs no key by default, and produces simpler
  responses.
- **OpenWeatherMap** — free tier covers current and 5-day forecast only; historical data requires
  paid "History" API. Ruled out.
- **Visual Crossing** — free tier (1000 records/day) with key; excellent historical coverage.
  Viable fallback if Open-Meteo becomes unavailable, but has lower free-tier limits.

**API Endpoints used**:

| Scenario | Endpoint |
|----------|----------|
| Ride within last 92 days or today/future | `https://api.open-meteo.com/v1/forecast?past_days=N` |
| Ride older than 92 days | `https://archive-api.open-meteo.com/v1/archive` |

**Fields requested**:
```
hourly=temperature_2m,wind_speed_10m,wind_direction_10m,
       relative_humidity_2m,cloud_cover,precipitation,snowfall,weather_code
&temperature_unit=fahrenheit
&wind_speed_unit=mph
&timezone=auto
```

**Precipitation type derivation** from WMO `weather_code`:
- Codes 51–67, 80–82: Rain / drizzle / rain showers → `"rain"`
- Codes 71–77, 85–86: Snow / snow showers → `"snow"`
- Codes 56–57, 66–67: Freezing rain → `"freezing_rain"`
- Code 0: Clear → `null` (empty)
- No precipitation (code <40 or `precipitation == 0 && snowfall == 0`) → `null`

---

## Decision 2: Cache Key Design

**Decision**: Cache by `(LookupHourUtc, LatitudeRounded, LongitudeRounded)`.

| Component | Rule |
|-----------|------|
| `LookupHourUtc` | Convert ride's local `DateTime` to UTC; truncate to whole hour |
| `LatitudeRounded` | Round user's `Latitude` to 2 decimal places (~1 km precision) |
| `LongitudeRounded` | Round user's `Longitude` to 2 decimal places |

**Rationale**: One-hour granularity matches Open-Meteo's hourly data resolution and the
constitution-approved cache strategy. Two-decimal rounding gives ~1 km precision — accurate
enough for commute weather while ensuring identical coordinates for the same configured location
always hit the same cache entry (floating-point equality safe).

**Alternatives considered**:
- Exact UTC minute: too fine; no two ride times share a cache entry, defeating reuse objective.
- Calendar day: too coarse; riding at 7 AM in clear weather vs. 5 PM in rain would share a record.

---

## Decision 3: Server-Side Fetch + User Override Merge Strategy

**Decision**: Weather fetch is server-side at save time. User-submitted field values take precedence
over API-fetched values on a per-field basis, controlled by a `WeatherUserOverridden` flag.

**Merge rules at save**:

| Scenario | Server action |
|----------|---------------|
| `WeatherUserOverridden = false` AND field is `null` in request | Fetch from API (or cache); use API value |
| `WeatherUserOverridden = false` AND field is non-null in request | User typed a value — use the user value, skip fetch for that field |
| `WeatherUserOverridden = true` | Use all submitted values as-is; skip weather fetch entirely |
| Location (lat/lon) not configured in user settings | Skip fetch; all weather fields remain as submitted (empty unless user typed) |
| API unreachable / timeout / error | Log warning; all null weather fields remain null; save proceeds |

**Edit-specific rule**:
- If `RideDateTimeLocal` is unchanged from the stored ride, skip weather re-fetch (satisfies FR-012).
- If `RideDateTimeLocal` changed, re-apply merge rules above using new timestamp.

**Rationale**: Keeps the API key server-side only. Front-end form never makes external calls.
Aligns with existing `GasPriceLookupService` pattern where the service is called from within the
application layer at the appropriate integration point.

---

## Decision 4: F# Domain vs. C# for Weather Fields

**Decision**: Weather fields remain in C# (API layer) for this feature, consistent with the
existing pattern for `Temperature` and `GasPricePerGallon` in `RideEntity` and the event
payloads.

**Rationale**: The F# domain layer currently contains user event types (`UserEvents.fs`) and
core calculations. Weather is a data-capture concern (not a business-rule/calculation concern)
at this stage; no railroad-oriented decision logic is required to store or merge the fields.
If future features add weather-based recommendations or eligibility rules, those calculations
belong in the F# domain layer at that time.

---

## Decision 5: New Fields vs. Existing `Temperature`

**Decision**: `Temperature` remains as its own standalone field on `RideEntity` and request DTOs
(it already exists). The five new weather fields are **additions** alongside `Temperature`, not
a replacement or restructuring.

**Rationale**: Backwards compatibility — all existing rides have `Temperature` stored separately.
Changing the shape of `Temperature` would require a migration and a data-loss risk. Adding new
nullable columns is a safe, additive schema change.

---

## Decision 6: Timeout Budget for External Weather Calls

**Decision**: 5-second HTTP client timeout for Open-Meteo calls, consistent with the existing
`EiaGasPrice` HttpClient timeout (10 seconds); weather is simpler and should respond faster.

**Rationale**: Constitution Principle VI mandates `<500ms p95` API response time. Weather fetch
adds latency at save time; a 5-second cap ensures the request fails fast on a hanging connection
without blocking the user indefinitely. Cached responses add zero latency after the first lookup.

---

## Resolved Clarifications

| Question | Answer |
|----------|--------|
| Location source | Single user-configured lat/lon from `UserSettingsEntity` |
| Historical vs current | Both — archive API (>92 days) + forecast API (≤92 days) |
| API key | Open-Meteo needs no key by default; key slot configurable (`WeatherLookup:ApiKey`) for commercial tier fallback |
| Cache granularity | 1-hour bucket, rounded lat/lon to 2 decimal places |
| Fetch timing | Server-side at save; API key never sent to browser |
| Timeout | 5 seconds |
| Precipitation type | Derived from WMO `weather_code` |
| Temperature unit | Fahrenheit (consistent with existing `Temperature` field) |
| Wind speed unit | mph (consistent with existing US-centric app) |
