# API Contract: Year Stats Dashboard

Base path: `/api/dashboard` (extends existing `DashboardEndpoints.cs` route group). All routes require authentication (existing `"sub"` claim → `riderId` resolution pattern) and return `401 Unauthorized` if the claim is missing/invalid, matching `/api/dashboard` and `/api/dashboard/advanced`.

## `GET /api/dashboard/year-stats/years`

Returns the list of years selectable in the year selector.

**Auth**: Required (cookie/session, same as other dashboard endpoints).

**Request**: No parameters.

**Response `200 OK`**:
```json
{
  "years": [2026, 2025, 2024]
}
```
- `years` is descending, contains only years with ≥1 recorded ride for the authenticated rider.
- If the rider has zero rides, `years` is `[<currentYear>]` (fallback default per FR-002/FR-008).

**Response `401 Unauthorized`**: same shape as existing dashboard endpoints' unauthorized response.

---

## `GET /api/dashboard/year-stats?year={yyyy}`

Returns the year-scoped dashboard: mileage trend, savings breakdown, difficulty-by-month, most-difficult-months, and wind resistance distribution — all limited to the given calendar year.

**Auth**: Required.

**Query parameters**:
| Name | Type | Required | Notes |
|------|------|----------|-------|
| `year` | integer | Yes | 4-digit calendar year. Must satisfy `1900 <= year <= currentYear + 1`. |

**Response `200 OK`** (`YearStatsDashboardResponse`, see `data-model.md` for full field descriptions):
```json
{
  "year": 2025,
  "hasDataForYear": true,
  "mileageByMonth": [
    { "monthKey": "2025-01", "label": "Jan", "miles": 142.5 },
    { "monthKey": "2025-02", "label": "Feb", "miles": 98.0 }
    // ... 12 entries total, Jan..Dec of `year`
  ],
  "savingsByMonth": [
    {
      "monthKey": "2025-01",
      "label": "Jan",
      "mileageRateSavings": 12.34,
      "fuelCostAvoided": 5.10,
      "combinedSavings": 17.44
    }
    // ... 12 entries total
  ],
  "difficulty": {
    "hasData": true,
    "overallAverageDifficulty": 3.2,
    "byMonth": [
      { "monthKey": "2025-01", "label": "Jan", "averageDifficulty": 2.8 }
    ],
    "mostDifficultMonths": [
      { "monthKey": "2025-07", "label": "Jul", "averageDifficulty": 4.1 }
    ]
  },
  "windResistance": {
    "hasData": true,
    "bins": [
      { "label": "Headwind", "count": 12 },
      { "label": "Tailwind", "count": 9 },
      { "label": "Crosswind", "count": 20 }
    ]
  }
}
```

**Empty-year example** (`hasDataForYear: false`):
```json
{
  "year": 2019,
  "hasDataForYear": false,
  "mileageByMonth": [ /* 12 entries, all miles: 0 */ ],
  "savingsByMonth": [ /* 12 entries, all savings fields null */ ],
  "difficulty": { "hasData": false, "overallAverageDifficulty": null, "byMonth": [], "mostDifficultMonths": [] },
  "windResistance": { "hasData": false, "bins": [] }
}
```

**Response `400 Bad Request`**: `year` missing, non-numeric, or out of bounds.

**Response `401 Unauthorized`**: same as other dashboard endpoints.

---

## Consumers

- `year-stats-dashboard-page.tsx` calls `getAvailableYears()` on mount, then `getYearStatsDashboard(selectedYear)` whenever `selectedYear` changes.
- `dashboard-chart-section.tsx` consumes `mileageByMonth` / `savingsByMonth` via its existing props shape (field names kept 1:1 with `DashboardMileagePoint`/`DashboardSavingsPoint` naming conventions to minimize prop-mapping code).
- `DifficultyAnalyticsSection.tsx` consumes `difficulty` + `windResistance` via the same `section`-shaped prop it already accepts from the advanced dashboard, adapted 1:1 by the new page.

## Non-goals

- No write/mutation endpoints are introduced.
- No changes to `GET /api/dashboard` or `GET /api/dashboard/advanced` response shapes or behavior.
