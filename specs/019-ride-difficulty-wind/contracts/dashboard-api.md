# API Contract: Advanced Dashboard Endpoint (Extended)

**Feature**: `019-ride-difficulty-wind`  
**File to change**: `src/BikeTracking.Api/Contracts/DashboardContracts.cs`  
**Date**: 2026-04-24

The existing `AdvancedDashboardResponse` gains a new `DifficultySection` property. All existing fields are preserved; existing API clients receive the new field as an optional extension.

---

## 1. AdvancedDashboardResponse (modified)

```csharp
// Current shape (condensed — all existing fields unchanged):
public sealed record AdvancedDashboardResponse(
    AdvancedSavingsWindows SavingsWindows,
    IReadOnlyList<AdvancedDashboardSuggestion> Suggestions,
    AdvancedDashboardReminders Reminders,
    DateTime GeneratedAtUtc,

    // NEW — nullable; null when no qualifying ride data exists (empty state)
    AdvancedDashboardDifficultySection? DifficultySection = null
);
```

---

## 2. New Record Types

```csharp
/// <summary>
/// Difficulty analytics section of the Advanced Dashboard.
/// Null when the rider has no rides with resolvable difficulty (stored, computed from rating,
/// or computable from wind speed + direction).
/// </summary>
public sealed record AdvancedDashboardDifficultySection(

    /// <summary>
    /// Overall average difficulty across all qualifying rides (1 decimal place).
    /// Null when no qualifying rides exist.
    /// </summary>
    decimal? OverallAverageDifficulty,

    /// <summary>
    /// Average difficulty by calendar month (January–December, all years combined).
    /// At most 12 entries; months with no qualifying rides are omitted.
    /// Sorted by month number ascending.
    /// </summary>
    IReadOnlyList<DifficultyByMonth> DifficultyByMonth,

    /// <summary>
    /// Same months ranked by average difficulty descending (most difficult first).
    /// At most 12 entries.
    /// </summary>
    IReadOnlyList<DifficultyByMonth> MostDifficultMonths,

    /// <summary>
    /// Distribution of rides across wind resistance bins −4 to +4.
    /// Always 9 entries (one per bin), even when count is 0.
    /// Bins with count 0 are included so the chart renders correctly.
    /// </summary>
    IReadOnlyList<WindResistanceBin> WindResistanceDistribution,

    /// <summary>
    /// True when the section is showing an empty state (no qualifying data).
    /// Frontend renders empty state message instead of charts.
    /// </summary>
    bool IsEmpty
);

/// <summary>
/// Average difficulty for a calendar month.
/// </summary>
public sealed record DifficultyByMonth(
    /// <summary>Month number 1–12.</summary>
    int MonthNumber,
    /// <summary>Full month name, e.g. "January".</summary>
    string MonthName,
    /// <summary>Average difficulty for this month across all years (1 decimal place).</summary>
    decimal AverageDifficulty,
    /// <summary>Number of qualifying rides in this month group.</summary>
    int RideCount
);

/// <summary>
/// Count of rides at a given wind resistance level.
/// </summary>
public sealed record WindResistanceBin(
    /// <summary>Wind resistance rating (−4 to +4).</summary>
    int Rating,
    /// <summary>Number of rides with this stored WindResistanceRating.</summary>
    int RideCount,
    /// <summary>Label for display: "−4 (strong tailwind)" … "+4 (strong headwind)".</summary>
    string Label,
    /// <summary>True when rating is negative (tailwind/assisted). Used for visual distinction (FR-024).</summary>
    bool IsAssisted
);
```

---

## 3. GET /api/advanced-dashboard — Response Shape

**Route**: `GET /api/advanced-dashboard`  
**Auth**: Required  
**Change type**: Additive — new `difficultySection` field added to response JSON

**Full extended response (JSON)**:

```json
{
  "savingsWindows": { ... },
  "suggestions": [ ... ],
  "reminders": { ... },
  "generatedAtUtc": "2026-04-24T12:00:00Z",
  "difficultySection": {
    "overallAverageDifficulty": 3.2,
    "difficultyByMonth": [
      { "monthNumber": 1, "monthName": "January", "averageDifficulty": 3.8, "rideCount": 12 },
      { "monthNumber": 2, "monthName": "February", "averageDifficulty": 4.1, "rideCount": 9 }
    ],
    "mostDifficultMonths": [
      { "monthNumber": 2, "monthName": "February", "averageDifficulty": 4.1, "rideCount": 9 },
      { "monthNumber": 1, "monthName": "January", "averageDifficulty": 3.8, "rideCount": 12 }
    ],
    "windResistanceDistribution": [
      { "rating": -4, "rideCount": 3, "label": "−4 (strong tailwind)", "isAssisted": true },
      { "rating": -3, "rideCount": 7, "label": "−3 (tailwind)", "isAssisted": true },
      { "rating": -2, "rideCount": 14, "label": "−2 (tailwind)", "isAssisted": true },
      { "rating": -1, "rideCount": 21, "label": "−1 (light tailwind)", "isAssisted": true },
      { "rating": 0,  "rideCount": 35, "label": "0 (neutral)", "isAssisted": false },
      { "rating": 1,  "rideCount": 28, "label": "+1 (light headwind)", "isAssisted": false },
      { "rating": 2,  "rideCount": 19, "label": "+2 (headwind)", "isAssisted": false },
      { "rating": 3,  "rideCount": 8,  "label": "+3 (headwind)", "isAssisted": false },
      { "rating": 4,  "rideCount": 2,  "label": "+4 (strong headwind)", "isAssisted": false }
    ],
    "isEmpty": false
  }
}
```

**Empty state response** (FR-025: no difficulty data, no wind data):

```json
{
  "difficultySection": {
    "overallAverageDifficulty": null,
    "difficultyByMonth": [],
    "mostDifficultMonths": [],
    "windResistanceDistribution": [
      { "rating": -4, "rideCount": 0, "label": "−4 (strong tailwind)", "isAssisted": true },
      ...
      { "rating": 4, "rideCount": 0, "label": "+4 (strong headwind)", "isAssisted": false }
    ],
    "isEmpty": true
  }
}
```

---

## 4. Frontend Types (advanced-dashboard-api.ts)

```typescript
export interface DifficultyByMonth {
  monthNumber: number;
  monthName: string;
  averageDifficulty: number;
  rideCount: number;
}

export interface WindResistanceBin {
  rating: number;        // −4 to +4
  rideCount: number;
  label: string;
  isAssisted: boolean;
}

export interface AdvancedDashboardDifficultySection {
  overallAverageDifficulty: number | null;
  difficultyByMonth: DifficultyByMonth[];
  mostDifficultMonths: DifficultyByMonth[];
  windResistanceDistribution: WindResistanceBin[];
  isEmpty: boolean;
}

// Extended AdvancedDashboardResponse
export interface AdvancedDashboardResponse {
  savingsWindows: AdvancedSavingsWindows;
  suggestions: AdvancedDashboardSuggestion[];
  reminders: AdvancedDashboardReminders;
  generatedAtUtc: string;
  difficultySection: AdvancedDashboardDifficultySection | null;  // NEW
}
```
