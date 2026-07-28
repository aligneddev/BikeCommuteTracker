# API Contracts: Export Endpoints

**Route group**: `/api/exports`

**Auth**: All endpoints require the `X-User-Id` header (existing scheme). Returns `401 Unauthorized` if header is absent or invalid. Data is always scoped to the authenticated rider.

---

## GET /api/exports/expenses

Downloads all expense records for the authenticated user as a single CSV file.

### Request

```http
GET /api/exports/expenses HTTP/1.1
X-User-Id: {userId}
```

No query parameters. No request body.

### Success Response

**Status**: `200 OK`

**Headers**:
```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="expenses-export.csv"
```

**Body**: UTF-8 CSV file with BOM-free encoding.

```
Date,Amount,Notes,CreatedAtUtc
2026-01-15,49.95,Chain replacement,2026-01-15T10:23:00Z
2026-02-03,12.00,,2026-02-03T08:00:00Z
2026-03-10,7.50,"Tyre, inner tube",2026-03-10T12:00:00Z
```

**Column definitions**:
| Column       | Format                        | Nullable |
|--------------|-------------------------------|----------|
| `Date`       | `yyyy-MM-dd`                  | No       |
| `Amount`     | Decimal (no currency symbol)  | No       |
| `Notes`      | String, RFC 4180 quoted       | Yes (blank) |
| `CreatedAtUtc` | ISO 8601 (`yyyy-MM-ddTHH:mm:ssZ`) | No |

**Empty dataset**: Returns a CSV with only the header row (no data rows).

### Error Responses

| Status | Condition |
|--------|-----------|
| `401 Unauthorized` | Missing or invalid `X-User-Id` header |
| `500 Internal Server Error` | Unexpected server failure |

---

## GET /api/exports/rides

Downloads all ride records for the authenticated user as a ZIP archive containing one CSV file per calendar year.

### Request

```http
GET /api/exports/rides HTTP/1.1
X-User-Id: {userId}
```

No query parameters. No request body.

### Success Response

**Status**: `200 OK`

**Headers**:
```http
Content-Type: application/zip
Content-Disposition: attachment; filename="ride-history-export.zip"
```

**Body**: Binary ZIP file.

**ZIP contents**:
```
ride-history-export.zip
├── 2024.csv    ← all rides with RideDateTimeLocal.Year == 2024
├── 2025.csv    ← all rides with RideDateTimeLocal.Year == 2025
└── 2026.csv    ← all rides with RideDateTimeLocal.Year == 2026
```

Each per-year CSV format:
```
Date,Miles,RideMinutes,Temperature,GasPricePerGallon,WindSpeedMph,WindDirectionDeg,RelativeHumidityPercent,CloudCoverPercent,PrecipitationType,Note,WeatherUserOverridden,Difficulty,PrimaryTravelDirection,WindResistanceRating,ImportSource,SnapshotAverageCarMpg,SnapshotMileageRateCents,SnapshotYearlyGoalMiles,SnapshotOilChangePrice,CreatedAtUtc
2025-06-15T07:30:00,12.5,45,68.0,3.459,8.2,45,55,10,,Morning commute,false,3,NE,2,,25.0,6700,2000,79.00,2025-06-15T12:35:00Z
2025-06-16T07:28:00,12.5,43,71.0,,,,,,,,"Windy, tough ride",false,5,North,4,,,,,2025-06-16T12:30:00Z
```

**Column definitions**:
| Column                    | Format                         | Nullable      |
|---------------------------|--------------------------------|---------------|
| `Date`                    | `yyyy-MM-ddTHH:mm:ss`          | No            |
| `Miles`                   | Decimal                        | No            |
| `RideMinutes`             | Integer                        | Yes (blank)   |
| `Temperature`             | Decimal (°F)                   | Yes (blank)   |
| `GasPricePerGallon`       | Decimal                        | Yes (blank)   |
| `WindSpeedMph`            | Decimal                        | Yes (blank)   |
| `WindDirectionDeg`        | Integer (0–360)                | Yes (blank)   |
| `RelativeHumidityPercent` | Integer (0–100)                | Yes (blank)   |
| `CloudCoverPercent`       | Integer (0–100)                | Yes (blank)   |
| `PrecipitationType`       | String, RFC 4180 quoted        | Yes (blank)   |
| `Note`                    | String, RFC 4180 quoted        | Yes (blank)   |
| `WeatherUserOverridden`   | `true` / `false`               | No            |
| `Difficulty`              | Integer (1–5)                  | Yes (blank)   |
| `PrimaryTravelDirection`  | String                         | Yes (blank)   |
| `WindResistanceRating`    | Integer (−4 to +4)             | Yes (blank)   |
| `ImportSource`            | String                         | Yes (blank)   |
| `SnapshotAverageCarMpg`   | Decimal                        | Yes (blank)   |
| `SnapshotMileageRateCents`| Decimal                        | Yes (blank)   |
| `SnapshotYearlyGoalMiles` | Decimal                        | Yes (blank)   |
| `SnapshotOilChangePrice`  | Decimal                        | Yes (blank)   |
| `CreatedAtUtc`            | ISO 8601 (`yyyy-MM-ddTHH:mm:ssZ`) | No         |

**Empty dataset**: If the user has no rides, the ZIP contains a single `{currentYear}.csv` with only the header row.

### Error Responses

| Status | Condition |
|--------|-----------|
| `401 Unauthorized` | Missing or invalid `X-User-Id` header |
| `500 Internal Server Error` | Unexpected server failure |

---

## Notes

- Both endpoints are registered in `ExportEndpoints.cs` under `.RequireAuthorization()`.
- Neither endpoint modifies any data.
- Both endpoints use `Results.File(...)` (or equivalent `FileStreamResult`) to stream binary content directly.
- `Content-Disposition` uses the `attachment` disposition type so all browsers/fetch clients treat the response as a download rather than an inline render.
