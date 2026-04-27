# API Contract: Rides Endpoints (Extended)

**Feature**: `019-ride-difficulty-wind`  
**File to change**: `src/BikeTracking.Api/Contracts/RidesContracts.cs`  
**Date**: 2026-04-24

All existing fields are preserved. Changes are purely additive (new optional fields). Existing API clients remain compatible.

---

## 1. RecordRideRequest (modified)

```csharp
public sealed record RecordRideRequest(
    // ... all existing fields unchanged ...

    // NEW optional fields (append to end of parameter list):

    /// <summary>
    /// Optional rider-supplied difficulty (1 = Very Easy … 5 = Very Hard).
    /// If provided, this value is stored as-is. If not provided, server computes
    /// a suggested value from wind data (which the client may have already shown
    /// as a suggestion) — but does NOT auto-store it; Difficulty is only stored
    /// when the client explicitly sends it.
    /// </summary>
    [property: Range(1, 5, ErrorMessage = "Difficulty must be between 1 and 5")]
    int? Difficulty = null,

    /// <summary>
    /// Rider's primary travel direction, used to compute WindResistanceRating.
    /// Accepted inputs: full compass names (e.g., "North", "Northeast") or 2-letter abbreviations.
    /// Values are normalized server-side to canonical 2-letter abbreviations: `N, NE, E, SE, S, SW, W, NW`.
    /// </summary>
    [property: MaxLength(2, ErrorMessage = "Primary travel direction must be 2 characters or fewer")]
        string? PrimaryTravelDirection = null
);
```

**Server-side behaviour**:
- `WindResistanceRating` is **not** in the request; it is computed server-side in `RecordRideService`.
-- If `PrimaryTravelDirection` is provided and `WindSpeedMph` + `WindDirectionDeg` are available, `WindResistanceRating` is computed via `WindResistance.calculateDifficulty` and persisted.
-- `PrimaryTravelDirection` must be parsed via `WindResistance.tryParseCompassDirection`; if invalid, return `400 Bad Request` with error message listing accepted values.

---

## 2. RecordRideSuccessResponse (unchanged)

No changes required — `WindResistanceRating` is an internal computed value, not returned in the record response. Clients that want to read it back use `GET /api/rides/history`.

---

## 3. EditRideRequest (modified)

```csharp
public sealed record EditRideRequest(
    // ... all existing fields unchanged ...

    // NEW optional fields (append to end of parameter list):

    [property: Range(1, 5, ErrorMessage = "Difficulty must be between 1 and 5")]
    int? Difficulty = null,

    [property: MaxLength(2, ErrorMessage = "Primary travel direction must be 2 characters or fewer")]
        string? PrimaryTravelDirection = null
);
```

**Server-side behaviour** (FR-026, FR-027):
-- When `PrimaryTravelDirection` changes relative to the stored value, `EditRideService` recomputes `WindResistanceRating` using current `WindSpeedMph` and `WindDirectionDeg` and persists the new value.
-- When `PrimaryTravelDirection` is sent as `null` (direction cleared), `WindResistanceRating` is set to `null`.
- `Difficulty` is the rider's final choice — stored as-is (no silent server override).

---

## 4. RideHistoryRow (modified)

```csharp
public sealed record RideHistoryRow(
    long RideId,
    DateTime RideDateTimeLocal,
    decimal Miles,
    int? RideMinutes = null,
    decimal? Temperature = null,
    decimal? GasPricePerGallon = null,
    decimal? WindSpeedMph = null,
    int? WindDirectionDeg = null,
    int? RelativeHumidityPercent = null,
    int? CloudCoverPercent = null,
    string? PrecipitationType = null,
    string? Note = null,
    bool WeatherUserOverridden = false,

    // NEW fields:
    int? Difficulty = null,
        string? PrimaryTravelDirection = null,
    int? WindResistanceRating = null
);
```

---

## 5. New Endpoint: GET /api/rides/csv-sample

**Purpose**: Download a sample CSV file showing all supported import columns including `Difficulty` and `Direction`.

**Route**: `GET /api/rides/csv-sample`  
**Auth**: Required (same as all other ride endpoints)  
**Response**: Binary CSV download

**Response headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="ride-import-sample.csv"
```

**Response body** (CSV):
```csv
# Sample CSV for bike ride import. Legend:
# Date: required. Formats: yyyy-MM-dd, MM/dd/yyyy, M/d/yyyy, dd-MMM-yyyy, MM/dd/yy
# Miles: required. Decimal, 0.01–200.
# Time: optional. Minutes (e.g., 45) or HH:mm (e.g., 00:45).
# Temp: optional. Fahrenheit (decimal).
# Notes: optional. Max 500 characters.
# Difficulty: optional. Integer 1 (Very Easy) to 5 (Very Hard).
# Direction: optional. Accepts full names or 2-letter abbreviations; normalized to N, NE, E, SE, S, SW, W, NW.
Date,Miles,Time,Temp,Notes,Difficulty,Direction
2026-01-15,12.5,45,38,"Morning commute, light rain",3,NE
2026-01-16,12.5,43,41,,1,South
2026-01-17,12.5,,35,"Too windy",,
```

**Contract record** (for `SampleCsvGenerator`):
```csharp
// No request body; no response DTO — returns raw CSV bytes.
// Endpoint registered in RidesEndpoints.cs:
// app.MapGet("/api/rides/csv-sample", DownloadSampleCsv).RequireAuthorization();
```

---

## 6. Validation Error Response Shape (unchanged)

All existing `400 Bad Request` responses continue to use the existing problem details / validation error format. New field errors follow the same pattern:

```json
{
  "errors": {
    "Difficulty": ["Difficulty must be between 1 and 5"],
    "PrimaryTravelDirection": ["Primary travel direction must be one of: N, NE, E, SE, S, SW, W, NW (accepts full names or abbreviations)"]
  }
}
```

---

## 7. Updated RideEditedEventPayload

`src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs`

Add new fields to the event payload record and the `Create` factory method:

```csharp
public sealed record RideEditedEventPayload(
    // ... existing fields ...
    int? Difficulty,
    string? PrimaryTravelDirection,
    int? WindResistanceRating
) { ... }
```

Matching change to `RideRecordedEventPayload`:
```csharp
public sealed record RideRecordedEventPayload(
    // ... existing fields ...
    int? Difficulty,
    string? PrimaryTravelDirection,
    int? WindResistanceRating
) { ... }
```
