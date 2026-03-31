# Data Model: Gas Price Lookup at Ride Entry

**Feature**: 010-gas-price-lookup  
**Branch**: `010-gas-price-lookup`  
**Date**: 2026-03-31

---

## New Entity: GasPriceLookup

The durable cache for EIA gas price responses. One row per calendar date. Immutable after creation.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `GasPriceLookupId` | `INTEGER` PK | NOT NULL, AUTOINCREMENT | Surrogate key |
| `PriceDate` | `TEXT` (date) | NOT NULL, UNIQUE | Calendar date the price applies to (YYYY-MM-DD). Unique index — one price per date. |
| `PricePerGallon` | `DECIMAL(10,4)` | NOT NULL | National average retail price in USD per gallon; 4 decimal places. |
| `DataSource` | `TEXT(64)` | NOT NULL | Identifier for the source (e.g., `"EIA_EPM0_NUS_Weekly"`) |
| `EiaPeriodDate` | `TEXT` (date) | NOT NULL | The actual EIA `period` date returned (the Monday of the surveyed week). May differ from `PriceDate` when the lookup uses the nearest prior week. |
| `RetrievedAtUtc` | `TEXT` (datetime) | NOT NULL | When the cache entry was written. |

**Indexes**:
- `UNIQUE (PriceDate)` — enforced at DB level to prevent duplicate cache entries for the same date.

---

## Modified Entity: Ride

New column added to `Rides` table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `GasPricePerGallon` | `DECIMAL(10,4)` | NULLABLE | The gas price per gallon in effect at the time of the ride date. Null if unavailable at time of creation/edit. |

---

## Modified Domain Events

### RideRecordedEventPayload (C# record)

Add field:

| Field | Type | Notes |
|---|---|---|
| `GasPricePerGallon` | `decimal?` | Optional. The gas price stored with this ride creation event. |

### RideEditedEventPayload (C# record)

Add field:

| Field | Type | Notes |
|---|---|---|
| `GasPricePerGallon` | `decimal?` | Optional. The gas price stored with this ride edit event. Reflects the price for the (possibly changed) ride date. |

---

## Modified API Contracts (C#)

### RecordRideRequest

Add field:

| Field | Type | Validation | Notes |
|---|---|---|---|
| `GasPricePerGallon` | `decimal?` | `[Range(0.01, 999.9999)]` optional | User-submitted gas price from the form field. Null if the user left the field empty. |

### EditRideRequest

Add field:

| Field | Type | Validation | Notes |
|---|---|---|---|
| `GasPricePerGallon` | `decimal?` | `[Range(0.01, 999.9999)]` optional | User-submitted gas price from the form field. Null if left empty. |

### RideDefaultsResponse

Add field:

| Field | Type | Notes |
|---|---|---|
| `DefaultGasPricePerGallon` | `decimal?` | The gas price from the most recent saved ride for this user. Null if no prior rides or no prior price. |

### New: GasPriceResponse

Returned by `GET /api/rides/gas-price?date=YYYY-MM-DD`.

| Field | Type | Notes |
|---|---|---|
| `Date` | `string` (YYYY-MM-DD) | The requested date. |
| `PricePerGallon` | `decimal?` | The retrieved or cached price. Null if unavailable. |
| `IsAvailable` | `bool` | `true` when a price was found; `false` otherwise. |
| `DataSource` | `string?` | Identifier for the source (e.g., `"EIA_EPM0_NUS_Weekly"`). Null when unavailable. |

---

## Modified Frontend TypeScript Interfaces

### RecordRideRequest (TypeScript)
```typescript
gasPricePerGallon?: number;
```

### EditRideRequest (TypeScript)
```typescript
gasPricePerGallon?: number;
```

### RideDefaultsResponse (TypeScript)
```typescript
defaultGasPricePerGallon?: number;
```

### RideHistoryRow (TypeScript)
```typescript
gasPricePerGallon?: number;
```

### New: GasPriceResponse (TypeScript)
```typescript
interface GasPriceResponse {
  date: string;
  pricePerGallon: number | null;
  isAvailable: boolean;
  dataSource: string | null;
}
```

---

## State Transitions

```
Ride form loads
  ├─ Call GET /api/rides/defaults
  │   └─ Returns DefaultGasPricePerGallon from last ride (or null)
  │       └─ Pre-populate gas price field
  │
  ├─ User changes ride date (debounced 300ms)
  │   └─ Call GET /api/rides/gas-price?date=NEW_DATE
  │       ├─ Cache HIT → return cached price → update field
  │       ├─ Cache MISS → fetch EIA API → store in cache → return price → update field
  │       └─ EIA unavailable / no data → return isAvailable=false → field unchanged (retains default/prior value)
  │
  └─ User submits form
      └─ gasPricePerGallon = current field value (or null)
          └─ Stored in RideRecordedEvent / RideEditedEvent + RideEntity
```

---

## Database Migration

**Migration name pattern**: `YYYYMMDDHHMMSS_AddGasPriceToRidesAndLookupCache`

Changes:
1. Create `GasPriceLookups` table with columns above.
2. Add `GasPricePerGallon DECIMAL(10,4) NULL` column to `Rides` table.
3. Create unique index on `GasPriceLookups(PriceDate)`.
