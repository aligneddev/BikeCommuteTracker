# Contract: Riding Time Totals

This feature extends three existing authenticated dashboard endpoints with one additive, non-nullable integer field each. No new endpoint, query parameter, or request body is introduced. Existing fields are unchanged.

All values are **total minutes** (`int`, `>= 0`), summed over the rider's rides that have a recorded `rideMinutes`. Rides without a duration are excluded. The value is `0`, never `null`, when nothing qualifies. Clients format it for display (see [data-model.md](../data-model.md#display-projection-frontend-only)).

---

## 1. `GET /api/dashboard` — main dashboard

**Field added**: `totals.totalRideMinutes` (all-time scope)

```json
{
  "totals": {
    "currentMonthMiles": { "miles": 42.5, "rideCount": 5, "period": "thisMonth" },
    "yearToDateMiles":   { "miles": 812.0, "rideCount": 96, "period": "thisYear" },
    "allTimeMiles":      { "miles": 3120.4, "rideCount": 380, "period": "allTime" },
    "moneySaved":        { "...": "unchanged" },
    "expenseSummary":    { "...": "unchanged" },
    "totalRideMinutes": 2535
  },
  "missingData": {
    "ridesMissingSavingsSnapshot": 0,
    "ridesMissingGasPrice": 0,
    "ridesMissingTemperature": 3,
    "ridesMissingDuration": 12
  }
}
```

- `missingData.ridesMissingDuration` (existing) tells the client that `totalRideMinutes` excludes some rides.
- No rides → `totalRideMinutes: 0`.

---

## 2. `GET /api/dashboard/advanced` — advanced dashboard

**Field added**: top-level `totalRideMinutes` (all-time scope only; **not** added to any `savingsWindows.*` entry)

```json
{
  "savingsWindows": {
    "weekly":  { "...": "unchanged" },
    "monthly": { "...": "unchanged" },
    "yearly":  { "...": "unchanged" },
    "allTime": { "...": "unchanged" }
  },
  "suggestions": [ "...unchanged" ],
  "reminders": { "...": "unchanged" },
  "generatedAtUtc": "2026-10-06T14:00:00Z",
  "co2SavedPerMileLbs": 0.90,
  "totalRideMinutes": 2535,
  "difficultySection": { "...": "unchanged" }
}
```

- Must equal `/api/dashboard` → `totals.totalRideMinutes` for the same rider at the same moment (SC-002).
- C# positional record: the parameter goes after `Co2SavedPerMileLbs` and before the defaulted `DifficultySection`.

---

## 3. `GET /api/dashboard/year-stats?year={yyyy}` — year stats

**Field added**: `totals.totalRideMinutes` (scope: rides with `rideDateTimeLocal` in `[yyyy-01-01, yyyy+1-01-01)`)

```json
{
  "year": 2025,
  "hasDataForYear": true,
  "totals": {
    "totalMiles": 1450.2,
    "totalCombinedSavings": 312.55,
    "expenseSummary": { "...": "unchanged" },
    "totalRideMinutes": 6015
  },
  "mileageByMonth": [ "...unchanged" ],
  "savingsByMonth": [ "...unchanged" ],
  "difficulty": { "...": "unchanged" },
  "windResistance": { "...": "unchanged" }
}
```

| Case | `hasDataForYear` | `totals.totalRideMinutes` | UI |
|------|------------------|---------------------------|----|
| Year with rides, some with duration | `true` | sum of those durations | `"100h 15m"` |
| Year with rides, none with duration | `true` | `0` | `"0h 0m"` (Edge Case 4) |
| Year with no rides | `false` | `0` | existing "No ride data for {year}." (US3 AC2) |

---

## Compatibility

- All changes are additive JSON properties. Older clients that ignore unknown properties are unaffected.
- No auth, route, status-code, or error-shape changes. Unauthenticated behavior stays exactly as it is today for all three endpoints.

## UI Contract

| Surface | Element | Accessible name / text | Value |
|---------|---------|------------------------|-------|
| Main dashboard (`/dashboard`) | `DashboardSummaryCard` in "Dashboard summary cards" region | title "Riding Time", eyebrow "All time" | `formatHoursMinutes(totals.totalRideMinutes)`; detail = "1 ride missing duration" / "{n} rides missing duration" when `missingData.ridesMissingDuration > 0`, else all-time ride count |
| Advanced dashboard (`/dashboard/advanced`) | line in "Savings breakdown by time window" section | "All-time riding time" | `formatHoursMinutes(totalRideMinutes)` |
| Year stats (`/dashboard/year-stats`) | `<dt>`/`<dd>` in `year-stats-summary` | `dt` "Total riding time" | `formatHoursMinutes(totals.totalRideMinutes)`; rendered only when `hasDataForYear` |
