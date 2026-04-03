# API Contracts: Weather-Enriched Ride Entries

**Feature**: 011-ride-weather-data  
**Date**: 2026-04-03  
**Base path**: `/api/rides`  
**Contract file**: `src/BikeTracking.Api/Contracts/RidesContracts.cs`

---

## Modified Contracts

### `RecordRideRequest` (extended)

New optional fields added; all existing fields unchanged.

```csharp
public sealed record RecordRideRequest(
    // --- existing fields ---
    [Required] DateTime RideDateTimeLocal,
    [Required][Range(0.01, 200)] decimal Miles,
    [Range(1, int.MaxValue)] int? RideMinutes = null,
    decimal? Temperature = null,
    [Range(0.01, 999.9999)] decimal? GasPricePerGallon = null,
    // --- new weather fields ---
    [Range(0, 500, ErrorMessage = "Wind speed must be between 0 and 500 mph")]
        decimal? WindSpeedMph = null,
    [Range(0, 360, ErrorMessage = "Wind direction must be between 0 and 360 degrees")]
        int? WindDirectionDeg = null,
    [Range(0, 100, ErrorMessage = "Relative humidity must be between 0 and 100")]
        int? RelativeHumidityPercent = null,
    [Range(0, 100, ErrorMessage = "Cloud cover must be between 0 and 100")]
        int? CloudCoverPercent = null,
    [MaxLength(50, ErrorMessage = "Precipitation type must be 50 characters or fewer")]
        string? PrecipitationType = null,
    bool WeatherUserOverridden = false
);
```

---

### `EditRideRequest` (extended)

Same new fields added alongside existing fields.

```csharp
public sealed record EditRideRequest(
    // --- existing fields ---
    [Required] DateTime RideDateTimeLocal,
    [Required][Range(0.01, 200)] decimal Miles,
    [Range(1, int.MaxValue)] int? RideMinutes,
    decimal? Temperature,
    [Required][Range(1, int.MaxValue)] int ExpectedVersion,
    [Range(0.01, 999.9999)] decimal? GasPricePerGallon = null,
    // --- new weather fields ---
    [Range(0, 500)] decimal? WindSpeedMph = null,
    [Range(0, 360)] int? WindDirectionDeg = null,
    [Range(0, 100)] int? RelativeHumidityPercent = null,
    [Range(0, 100)] int? CloudCoverPercent = null,
    [MaxLength(50)] string? PrecipitationType = null,
    bool WeatherUserOverridden = false
);
```

---

### `RideHistoryRow` (extended)

New weather fields added to the read-model row for display in ride history.

```csharp
public sealed record RideHistoryRow(
    long RideId,
    DateTime RideDateTimeLocal,
    decimal Miles,
    int? RideMinutes = null,
    decimal? Temperature = null,
    decimal? GasPricePerGallon = null,
    // --- new weather fields ---
    decimal? WindSpeedMph = null,
    int? WindDirectionDeg = null,
    int? RelativeHumidityPercent = null,
    int? CloudCoverPercent = null,
    string? PrecipitationType = null,
    bool WeatherUserOverridden = false
);
```

---

### `RideDefaultsResponse` (extended)

Pre-populates weather fields from the most recent ride so the ride form shows prior values as defaults.

```csharp
public sealed record RideDefaultsResponse(
    bool HasPreviousRide,
    DateTime DefaultRideDateTimeLocal,
    decimal? DefaultMiles = null,
    int? DefaultRideMinutes = null,
    decimal? DefaultTemperature = null,
    decimal? DefaultGasPricePerGallon = null,
    // --- new weather defaults ---
    decimal? DefaultWindSpeedMph = null,
    int? DefaultWindDirectionDeg = null,
    int? DefaultRelativeHumidityPercent = null,
    int? DefaultCloudCoverPercent = null,
    string? DefaultPrecipitationType = null
);
```

---

## No New Endpoints

This feature does **not** introduce a new weather API endpoint visible to the frontend. Weather
data is fetched server-side at save time inside `RecordRideService` and `EditRideService`.
The existing `GET /api/rides/gas-price` endpoint pattern is not replicated for weather because
the weather lookup is tightly coupled to save time and user location (which is server-held).

---

## Frontend TypeScript Contracts

File to extend: `src/BikeTracking.Frontend/src/` (locate existing ride service API types)

### `RecordRideRequest` (TypeScript)

```typescript
interface RecordRideRequest {
  // existing
  rideDateTimeLocal: string;     // ISO 8601
  miles: number;
  rideMinutes?: number;
  temperature?: number;
  gasPricePerGallon?: number;
  // new weather fields
  windSpeedMph?: number;
  windDirectionDeg?: number;
  relativeHumidityPercent?: number;
  cloudCoverPercent?: number;
  precipitationType?: string;
  weatherUserOverridden?: boolean;  // default false
}
```

### `EditRideRequest` (TypeScript)

```typescript
interface EditRideRequest {
  // existing
  rideDateTimeLocal: string;
  miles: number;
  rideMinutes?: number;
  temperature?: number;
  expectedVersion: number;
  gasPricePerGallon?: number;
  // new weather fields
  windSpeedMph?: number;
  windDirectionDeg?: number;
  relativeHumidityPercent?: number;
  cloudCoverPercent?: number;
  precipitationType?: string;
  weatherUserOverridden?: boolean;
}
```

### `RideHistoryRow` (TypeScript)

```typescript
interface RideHistoryRow {
  // existing
  rideId: number;
  rideDateTimeLocal: string;
  miles: number;
  rideMinutes?: number;
  temperature?: number;
  gasPricePerGallon?: number;
  // new weather fields
  windSpeedMph?: number;
  windDirectionDeg?: number;
  relativeHumidityPercent?: number;
  cloudCoverPercent?: number;
  precipitationType?: string;
  weatherUserOverridden?: boolean;
}
```

### `RideDefaultsResponse` (TypeScript)

```typescript
interface RideDefaultsResponse {
  // existing
  hasPreviousRide: boolean;
  defaultRideDateTimeLocal: string;
  defaultMiles?: number;
  defaultRideMinutes?: number;
  defaultTemperature?: number;
  defaultGasPricePerGallon?: number;
  // new weather defaults
  defaultWindSpeedMph?: number;
  defaultWindDirectionDeg?: number;
  defaultRelativeHumidityPercent?: number;
  defaultCloudCoverPercent?: number;
  defaultPrecipitationType?: string;
}
```

---

## Backwards Compatibility

All new fields are optional with null/false defaults. Existing API callers that omit weather
fields will behave exactly as before — the server will attempt to auto-fill weather from the
API and store the result. No breaking changes to existing endpoints.
