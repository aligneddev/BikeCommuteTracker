# Developer Quickstart: Weather-Enriched Ride Entries

**Feature**: 011-ride-weather-data  
**Branch**: `011-ride-weather-data`  
**Date**: 2026-04-03

---

## Overview

This feature adds automatic weather capture (temperature, wind speed/direction, humidity, cloud
cover, precipitation type) to ride create and edit events. Weather is fetched server-side at
save time using the Open-Meteo free API, with no API key required by default. Results are cached
in SQLite by hour-bucket + location to minimize external calls.

---

## Prerequisites

- DevContainer running (mandatory — all tooling pre-configured)
- App running: `dotnet run --project src/BikeTracking.AppHost`
- User has configured Latitude/Longitude in Settings (otherwise weather fetch is skipped gracefully)

---

## Implementation Order

Follow the TDD red-green-refactor cycle at each step. Get user confirmation of failing tests
before implementing.

### Step 1 — Schema (migrations)

**Files to create/modify:**

```
src/BikeTracking.Api/Infrastructure/Persistence/Entities/
  WeatherLookupEntity.cs              ← new
  RideEntity.cs                       ← extend with 6 new fields

src/BikeTracking.Api/Infrastructure/Persistence/
  BikeTrackingDbContext.cs            ← add DbSet<WeatherLookupEntity>
```

**Create migrations** (run after entity changes):
```bash
cd src/BikeTracking.Api
dotnet ef migrations add AddWeatherFieldsToRides
dotnet ef migrations add AddWeatherLookupCache
```

> Each migration needs a corresponding test entry in `MigrationTestCoveragePolicyTests.cs`.

---

### Step 2 — Weather Lookup Service

**Files to create:**

```
src/BikeTracking.Api/Application/Rides/
  WeatherLookupService.cs             ← IWeatherLookupService + OpenMeteoWeatherLookupService
```

**Pattern to follow**: `GasPriceLookupService.cs` (exact same structure)

Key logic inside `GetOrFetchAsync`:
```text
1. Convert rideTimeLocal → UTC; truncate to hour
2. Round lat/lon to 2 decimal places
3. Query WeatherLookups cache table
4. If miss: pick endpoint (forecast if ≤ 92 days old; archive otherwise)
5. GET Open-Meteo; parse hourly array; derive PrecipitationType from weather_code
6. INSERT WeatherLookupEntity; catch DbUpdateException for concurrent insert
7. Return WeatherSnapshot (or null on error)
```

**Register in `Program.cs`:**
```csharp
builder.Services.AddScoped<IWeatherLookupService, OpenMeteoWeatherLookupService>();
builder.Services.AddHttpClient("OpenMeteo", client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
    // BaseAddress not set — implementation switches between two base URLs
});
```

**Configuration** (optional — no key needed for Open-Meteo free tier):
```json
// appsettings.Development.json (for future commercial tier / override)
"WeatherLookup": {
  "ApiKey": ""
}
```

---

### Step 3 — Update Event Payloads

**Files:**
```
src/BikeTracking.Api/Application/Events/
  RideRecordedEventPayload.cs         ← add 6 new optional params to Create()
  RideEditedEventPayload.cs           ← same
```

Add to both records and `Create(…)` factory signatures:
```csharp
decimal? WindSpeedMph = null,
int? WindDirectionDeg = null,
int? RelativeHumidityPercent = null,
int? CloudCoverPercent = null,
string? PrecipitationType = null,
bool WeatherUserOverridden = false
```

All new params are optional with defaults → **no existing test breakage**.

---

### Step 4 — Update API Contracts

**File:** `src/BikeTracking.Api/Contracts/RidesContracts.cs`

Extend `RecordRideRequest`, `EditRideRequest`, `RideHistoryRow`, and `RideDefaultsResponse`
as defined in [contracts/api-contracts.md](./contracts/api-contracts.md).

---

### Step 5 — Integrate Weather into RecordRideService

**File:** `src/BikeTracking.Api/Application/Rides/RecordRideService.cs`

Inject `IWeatherLookupService` and `UserSettingsService` (or access lat/lon via a lightweight
read). At save time:

```text
1. Read user lat/lon from UserSettingsEntity
2. If lat/lon available AND request.WeatherUserOverridden == false:
   a. Call IWeatherLookupService.GetOrFetchAsync(rideTime, lat, lon)
   b. Merge: for each weather field, user-submitted non-null value wins; null → use API value
3. Build RideEntity with merged weather fields
4. Create RideRecordedEventPayload with merged weather fields
```

---

### Step 6 — Integrate Weather into EditRideService

**File:** `src/BikeTracking.Api/Application/Rides/EditRideService.cs`

Same inject pattern. Additional edit-specific rule:

```text
If request.RideDateTimeLocal == stored ride.RideDateTimeLocal:
  → skip weather re-fetch (FR-012); use submitted values as-is
If request.RideDateTimeLocal changed AND request.WeatherUserOverridden == false:
  → fetch weather for new time; merge as per Step 5
```

---

### Step 7 — Update `GetRideHistoryService` + `GetRideDefaultsService`

**Files:**
```
src/BikeTracking.Api/Application/Rides/GetRideHistoryService.cs
src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs
```

Map new `RideEntity` weather columns to `RideHistoryRow` and `RideDefaultsResponse`.

---

### Step 7.5 — Add Explicit Weather Preview Endpoint

Add an authenticated endpoint that accepts `rideDateTimeLocal` and returns weather fields for the
authenticated rider's configured location. This endpoint is used by create/edit form buttons to
fill weather values before save while keeping the weather provider server-side.

---

### Step 8 — Frontend: Ride Create/Edit Form

**Files** (locate existing ride form components):
```
src/BikeTracking.Frontend/src/
  (find RecordRide or CreateRide component)
  (find EditRide component)
  (find ride service / API client types)
```

Add optional weather fields to both forms:
- Temperature (already exists — verify rendering)
- Wind Speed (mph)
- Wind Direction (degrees, optional compass hint)
- Relative Humidity (%)
- Cloud Cover (%)
- Precipitation Type (text input or simple select: none / rain / snow / freezing_rain)

**UI behavior**:
- All weather fields are optional — user can leave them empty
- Pre-populated on edit from the stored ride values
- Add a `Load Weather` button on create and edit that fetches weather for the currently selected ride timestamp
- When user manually changes any field, set `weatherUserOverridden = true` before submit
- Show in RideHistoryRow in the history table

**TypeScript type contracts**: see [contracts/api-contracts.md](./contracts/api-contracts.md)

---

## Verification Commands

After each step, run the appropriate verification tier:

```bash
# Backend changes
dotnet test BikeTracking.slnx

# Frontend changes
cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit

# Cross-layer (auth/contract/E2E)
cd src/BikeTracking.Frontend && npm run test:e2e
```

Notes:
- In this repository, code formatting is run with `dotnet csharpier format .`.
- E2E may log warnings about missing `GasPriceLookup:EiaApiKey`; this is expected and does not fail weather-related scenarios.

---

## Test Plan (TDD — write & confirm failing first)

### Unit Tests (new file: `Application/Rides/WeatherLookupServiceTests.cs`)

| Test | What it proves |
|------|----------------|
| Returns cached WeatherSnapshot when cache hit exists | Cache reuse works |
| Calls Open-Meteo API when no cache entry exists | API integration fires on miss |
| Returns null and logs warning on HTTP error | Graceful degradation |
| Returns null when lat/lon are null (location not configured) | FR-001a |
| Uses forecast endpoint for a ride time within 92 days | Routing logic |
| Uses archive endpoint for a ride time older than 92 days | Routing logic |
| Correctly derives PrecipitationType from WMO weather_code rain range | Precip mapping |
| Correctly derives PrecipitationType from WMO weather_code snow range | Precip mapping |
| Correctly returns null PrecipitationType for clear weather | Precip mapping |
| Handles concurrent cache insert (DbUpdateException) gracefully | Race condition safe |

### Unit Tests (extend `Application/RidesApplicationServiceTests.cs`)

| Test | What it proves |
|------|----------------|
| RecordRideService auto-fills null weather fields from lookup result | FR-001 |
| RecordRideService preserves non-null user-submitted weather fields | FR-008 |
| RecordRideService completes save when weather lookup returns null | FR-009 |
| RecordRideService skips lookup when WeatherUserOverridden = true | Override flag works |
| RecordRideService skips lookup when user has no location configured | FR-001a |
| EditRideService re-fetches weather when RideDateTimeLocal changes | FR-002 |
| EditRideService skips weather re-fetch when RideDateTimeLocal unchanged | FR-012 |
| EditRideService respects WeatherUserOverridden = true on edit | FR-008 |

### Integration Tests (extend `Infrastructure/RidesPersistenceTests.cs`)

| Test | What it proves |
|------|----------------|
| New migrations apply cleanly to SQLite | Schema change safe |
| WeatherLookupEntity persisted and re-read correctly | Entity mapping correct |
| RideEntity with all weather fields round-trips through EF Core | Column mapping correct |

### E2E Tests (Playwright — extend existing ride E2E suite)

| Test | What it proves |
|------|----------------|
| Ride create form shows weather fields | FR-011 |
| Weather fields appear in ride history row | FR-011 |
| User can manually enter weather on create and values are saved | FR-007/FR-008 |
| Editing a ride pre-populates weather fields from stored values | UX correctness |

### Migration Coverage Policy

Add entries to `MigrationTestCoveragePolicyTests.cs` for:
- `AddWeatherFieldsToRides`
- `AddWeatherLookupCache`

---

## Open-Meteo Quick Reference

**Forecast endpoint** (rides ≤ 92 days old or future):
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &hourly=temperature_2m,wind_speed_10m,wind_direction_10m,
          relative_humidity_2m,cloud_cover,precipitation,snowfall,weather_code
  &temperature_unit=fahrenheit
  &wind_speed_unit=mph
  &timezone=auto
  &past_days={daysDiff}     ← how many days back
  &forecast_days=1
```

**Archive endpoint** (rides > 92 days old):
```
GET https://archive-api.open-meteo.com/v1/archive
  ?latitude={lat}&longitude={lon}
  &start_date={yyyy-MM-dd}&end_date={yyyy-MM-dd}
  &hourly=temperature_2m,wind_speed_10m,wind_direction_10m,
          relative_humidity_2m,cloud_cover,precipitation,snowfall,weather_code
  &temperature_unit=fahrenheit
  &wind_speed_unit=mph
  &timezone=auto
```

**Response shape** (both endpoints):
```json
{
  "hourly": {
    "time": ["2026-04-03T07:00", "2026-04-03T08:00", ...],
    "temperature_2m": [52.1, 53.4, ...],
    "wind_speed_10m": [8.2, 9.1, ...],
    "wind_direction_10m": [270, 265, ...],
    "relative_humidity_2m": [72, 70, ...],
    "cloud_cover": [40, 35, ...],
    "precipitation": [0.0, 0.0, ...],
    "snowfall": [0.0, 0.0, ...],
    "weather_code": [2, 2, ...]
  }
}
```

**Match hourly index**: find `time` entry equal to `lookupHourUtc` formatted as `yyyy-MM-ddTHH:mm`
(local time in the timezone parameters). Use that index for all field arrays.
