# API Contract: Gas Price Lookup Endpoint

**Feature**: 010-gas-price-lookup  
**Owner**: BikeTracking.Api  
**Consumer**: BikeTracking.Frontend

---

## GET /api/rides/gas-price

Retrieves the national average retail gasoline price for a given date, using a local durable cache backed by the EIA API.

### Request

```
GET /api/rides/gas-price?date=YYYY-MM-DD
Authorization: Bearer {token}
```

**Query Parameters**

| Parameter | Type | Required | Constraints | Notes |
|---|---|---|---|---|
| `date` | string (YYYY-MM-DD) | Yes | Valid ISO date format | The ride date to look up the gas price for. |

### Response: 200 OK

```json
{
  "date": "2026-03-31",
  "pricePerGallon": 3.1860,
  "isAvailable": true,
  "dataSource": "EIA_EPM0_NUS_Weekly"
}
```

**When unavailable** (API down, no data, future date with no coverage):
```json
{
  "date": "2100-01-01",
  "pricePerGallon": null,
  "isAvailable": false,
  "dataSource": null
}
```

### Response: 400 Bad Request

Returned when `date` is missing or not a valid date string.

```json
{
  "error": "invalid_request",
  "message": "date query parameter is required and must be a valid date in YYYY-MM-DD format."
}
```

### Response: 401 Unauthorized

Returned when no valid bearer token is present.

### Notes

- This endpoint never returns a 5xx for EIA lookup failures. EIA failures are absorbed and reflected as `isAvailable: false` with `pricePerGallon: null`.
- The response is deterministic for any given date: once a price is cached, the same value is always returned for that date.
- The `date` parameter is used as the cache key. The actual EIA period date (the Monday of the survey week) may differ; it is not exposed in this contract.

---

## Modified Contract: GET /api/rides/defaults

Extends the existing defaults endpoint to include the most recent ride's gas price.

### Response: 200 OK (extended)

Adds `defaultGasPricePerGallon` to the existing response:

```json
{
  "hasPreviousRide": true,
  "defaultRideDateTimeLocal": "2026-03-31T07:30:00",
  "defaultMiles": 5.2,
  "defaultRideMinutes": 22,
  "defaultTemperature": 58.0,
  "defaultGasPricePerGallon": 3.1860
}
```

When no previous ride exists, or the most recent ride has no gas price:
```json
{
  "hasPreviousRide": false,
  "defaultRideDateTimeLocal": "2026-03-31T08:00:00",
  "defaultGasPricePerGallon": null
}
```

**Backwards compatibility**: `defaultGasPricePerGallon` is a new nullable field. Existing clients that ignore it continue to work.

---

## Modified Contract: POST /api/rides (Record Ride)

Adds `gasPricePerGallon` to the existing request body.

### Request (extended)

```json
{
  "rideDateTimeLocal": "2026-03-31T07:30:00",
  "miles": 5.2,
  "rideMinutes": 22,
  "temperature": 58.0,
  "gasPricePerGallon": 3.1860
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `gasPricePerGallon` | number | No | Must be > 0 and ≤ 999.9999 when provided. Null/omitted means unavailable. |

**Backwards compatibility**: Existing requests that omit `gasPricePerGallon` continue to work; the field defaults to null.

---

## Modified Contract: PUT /api/rides/{rideId} (Edit Ride)

Adds `gasPricePerGallon` to the existing request body.

### Request (extended)

```json
{
  "rideDateTimeLocal": "2026-03-31T07:30:00",
  "miles": 5.2,
  "rideMinutes": 22,
  "temperature": 58.0,
  "gasPricePerGallon": 3.1860,
  "expectedVersion": 2
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `gasPricePerGallon` | number | No | Must be > 0 and ≤ 999.9999 when provided. Null/omitted means price not available. |

**Backwards compatibility**: Existing clients that omit `gasPricePerGallon` continue to work.

---

## Modified Contract: GET /api/rides/history (Ride History Row)

Adds `gasPricePerGallon` to each ride row in the history response.

### RideHistoryRow (extended)

```json
{
  "rideId": 42,
  "rideDateTimeLocal": "2026-03-31T07:30:00",
  "miles": 5.2,
  "rideMinutes": 22,
  "temperature": 58.0,
  "gasPricePerGallon": 3.1860
}
```

**Backwards compatibility**: New nullable field; existing consumers that ignore it continue to work.
