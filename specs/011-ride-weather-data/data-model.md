# Data Model: Weather-Enriched Ride Entries

**Feature**: 011-ride-weather-data  
**Date**: 2026-04-03  
**Status**: Complete

---

## Overview

This feature requires two schema changes:
1. **Extend `RideEntity`** with five new nullable weather fields and a `WeatherUserOverridden` flag.
2. **Add `WeatherLookupEntity`** as a new table to cache weather API results keyed by
   hour-bucket + location, following the exact same pattern as `GasPriceLookupEntity`.

---

## Existing Entity: `RideEntity` (extensions only)

File: `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs`

**Existing fields** (unchanged):

| Field | Type | Notes |
|-------|------|-------|
| `Id` | `int` | PK |
| `RiderId` | `long` | FK to user |
| `RideDateTimeLocal` | `DateTime` | Ride time in local time |
| `Miles` | `decimal` | Required |
| `RideMinutes` | `int?` | Optional |
| `Temperature` | `decimal?` | Already exists; single value in °F |
| `GasPricePerGallon` | `decimal?` | Already exists |
| `Version` | `int` | Optimistic concurrency |
| `CreatedAtUtc` | `DateTime` | Audit |

**New fields** (additive, all nullable):

| Field | Type | DB Column | Notes |
|-------|------|-----------|-------|
| `WindSpeedMph` | `decimal?` | `WindSpeedMph` | mph, from Open-Meteo `wind_speed_10m` (converted) |
| `WindDirectionDeg` | `int?` | `WindDirectionDeg` | 0–360 degrees, from `wind_direction_10m` |
| `RelativeHumidityPercent` | `int?` | `RelativeHumidityPercent` | 0–100%, from `relative_humidity_2m` |
| `CloudCoverPercent` | `int?` | `CloudCoverPercent` | 0–100%, from `cloud_cover` |
| `PrecipitationType` | `string?` | `PrecipitationType` | `"rain"`, `"snow"`, `"freezing_rain"`, or null |
| `WeatherUserOverridden` | `bool` | `WeatherUserOverridden` | Default `false`; `true` when user explicitly submitted weather fields |

**Migration approach**: New EF Core migration adding six columns to the `Rides` table. All new
columns nullable (or default `false` for `WeatherUserOverridden`) — no data loss or backfill
required. Existing rides will have nulls for new fields.

---

## New Entity: `WeatherLookupEntity`

File: `src/BikeTracking.Api/Infrastructure/Persistence/Entities/WeatherLookupEntity.cs`

Mirrors the shape of `GasPriceLookupEntity`. One row per unique `(LookupHourUtc, LatitudeRounded, LongitudeRounded)` key.

| Field | Type | DB Column | Notes |
|-------|------|-----------|-------|
| `WeatherLookupId` | `int` | `WeatherLookupId` | PK, auto-increment |
| `LookupHourUtc` | `DateTime` | `LookupHourUtc` | Ride time in UTC, truncated to whole hour |
| `LatitudeRounded` | `decimal` | `LatitudeRounded` | User lat rounded to 2 decimal places |
| `LongitudeRounded` | `decimal` | `LongitudeRounded` | User lon rounded to 2 decimal places |
| `Temperature` | `decimal?` | `Temperature` | °F |
| `WindSpeedMph` | `decimal?` | `WindSpeedMph` | mph |
| `WindDirectionDeg` | `int?` | `WindDirectionDeg` | 0–360° |
| `RelativeHumidityPercent` | `int?` | `RelativeHumidityPercent` | 0–100% |
| `CloudCoverPercent` | `int?` | `CloudCoverPercent` | 0–100% |
| `PrecipitationType` | `string?` | `PrecipitationType` | `"rain"`, `"snow"`, `"freezing_rain"`, or null |
| `DataSource` | `string` | `DataSource` | e.g. `"OpenMeteo_Forecast"` or `"OpenMeteo_Archive"` |
| `RetrievedAtUtc` | `DateTime` | `RetrievedAtUtc` | When the API call was made |
| `Status` | `string` | `Status` | `"success"`, `"partial"`, `"unavailable"`, `"error"` |

**Unique constraint**: `(LookupHourUtc, LatitudeRounded, LongitudeRounded)` — prevents duplicate
cache entries; handles concurrent inserts (same as `GasPriceLookupEntity` pattern, catch
`DbUpdateException` and re-read on conflict).

**Migration approach**: New EF Core migration creating the `WeatherLookups` table with the unique
constraint index.

---

## New Service Interface: `IWeatherLookupService`

File: `src/BikeTracking.Api/Application/Rides/WeatherLookupService.cs`

```text
interface IWeatherLookupService
  GetOrFetchAsync(
    DateTime rideTimeLocal,   ← ride's local DateTime
    decimal latitude,
    decimal longitude,
    CancellationToken
  ) → Task<WeatherSnapshot?>  ← null on unavailable/error
```

**`WeatherSnapshot` value type** (C# record, same file):

```text
record WeatherSnapshot(
  decimal? Temperature,
  decimal? WindSpeedMph,
  int?     WindDirectionDeg,
  int?     RelativeHumidityPercent,
  int?     CloudCoverPercent,
  string?  PrecipitationType
)
```

**Internal logic**:
1. Convert `rideTimeLocal` → UTC; truncate to hour → `lookupHourUtc`
2. Round lat/lon to 2 dp → `latR`, `lonR`
3. Query `WeatherLookups` for `(lookupHourUtc, latR, lonR)` → return cached snapshot if hit
4. If miss: determine endpoint (forecast if within 92 days; archive otherwise)
5. Call Open-Meteo; parse hourly index for `lookupHourUtc`; derive precipitation type from WMO code
6. Persist `WeatherLookupEntity`; handle concurrent insert
7. Return snapshot (or null on any error)

---

## Updated Event Payloads

Both `RideRecordedEventPayload` and `RideEditedEventPayload` gain the same new fields:

| New field | Type | Source |
|-----------|------|--------|
| `WindSpeedMph` | `decimal?` | from merged weather snapshot |
| `WindDirectionDeg` | `int?` | from merged weather snapshot |
| `RelativeHumidityPercent` | `int?` | from merged weather snapshot |
| `CloudCoverPercent` | `int?` | from merged weather snapshot |
| `PrecipitationType` | `string?` | from merged weather snapshot |
| `WeatherUserOverridden` | `bool` | from request flag |

**Backwards compatibility**: All new fields added as optional parameters with defaults in the
`Create(…)` factory methods. Existing unit tests can continue calling `Create(…)` without
supplying weather fields.

---

## DbContext Changes

`BikeTrackingDbContext` gains:
```text
DbSet<WeatherLookupEntity> WeatherLookups
```

With `OnModelCreating` configuration:
- Unique index on `(LookupHourUtc, LatitudeRounded, LongitudeRounded)`
- `Status` and `DataSource` as `varchar(50)` / `varchar(100)`

---

## State Transitions

```
RideCreateRequest received
  → Server reads UserSettingsEntity (lat, lon)
  → If lat/lon present AND WeatherUserOverridden = false:
      → WeatherLookupService.GetOrFetchAsync(rideTime, lat, lon)
      → Merge: non-null user fields win; null fields use API values
  → RideEntity saved with merged weather fields
  → RideRecordedEventPayload created with merged weather fields → outbox
```

```
RideEditRequest received
  → If RideDateTimeLocal changed from stored value AND WeatherUserOverridden = false:
      → WeatherLookupService.GetOrFetchAsync(newRideTime, lat, lon)
      → Merge submitted fields + API fields
  → Else (time unchanged): use submitted values as-is
  → RideEntity updated; RideEditedEventPayload → outbox
```

---

## Validation Rules

| Field | Rule | Where enforced |
|-------|------|----------------|
| `WindSpeedMph` | `>= 0` if provided | API DTO `[Range]`; DB CHECK |
| `WindDirectionDeg` | `0–360` if provided | API DTO `[Range]`; DB CHECK |
| `RelativeHumidityPercent` | `0–100` if provided | API DTO `[Range]`; DB CHECK |
| `CloudCoverPercent` | `0–100` if provided | API DTO `[Range]`; DB CHECK |
| `PrecipitationType` | max 50 chars enum-like string | API DTO `[MaxLength]` |
| All weather fields | nullable; ride save not blocked by null | all layers |
