# API Contracts: Rider Dashboard Statistics

**Feature**: 012-dashboard-stats  
**Date**: 2026-04-06  
**Primary base paths**: `/api/dashboard`, `/api/users/me/settings`

---

## New Endpoint

### `GET /api/dashboard`

Authenticated rider-only endpoint returning the full dashboard view model.

```csharp
public sealed record DashboardResponse(
    DashboardTotals Totals,
    DashboardAverages Averages,
    DashboardCharts Charts,
    IReadOnlyList<DashboardMetricSuggestion> Suggestions,
    DashboardMissingData MissingData,
    DateTime GeneratedAtUtc
);

public sealed record DashboardTotals(
    DashboardMileageMetric CurrentMonthMiles,
    DashboardMileageMetric YearToDateMiles,
    DashboardMileageMetric AllTimeMiles,
    DashboardMoneySaved MoneySaved
);

public sealed record DashboardMileageMetric(
    decimal Miles,
    int RideCount,
    string Period
);

public sealed record DashboardMoneySaved(
    decimal? MileageRateSavings,
    decimal? FuelCostAvoided,
    decimal? CombinedSavings,
    int QualifiedRideCount
);

public sealed record DashboardAverages(
    decimal? AverageTemperature,
    decimal? AverageMilesPerRide,
    decimal? AverageRideMinutes
);

public sealed record DashboardCharts(
    IReadOnlyList<DashboardMileagePoint> MileageByMonth,
    IReadOnlyList<DashboardSavingsPoint> SavingsByMonth
);

public sealed record DashboardMileagePoint(
    string MonthKey,
    string Label,
    decimal Miles
);

public sealed record DashboardSavingsPoint(
    string MonthKey,
    string Label,
    decimal? MileageRateSavings,
    decimal? FuelCostAvoided,
    decimal? CombinedSavings
);

public sealed record DashboardMetricSuggestion(
    string MetricKey,
    string Title,
    string Description,
    bool IsEnabled
);

public sealed record DashboardMissingData(
    int RidesMissingSavingsSnapshot,
    int RidesMissingGasPrice,
    int RidesMissingTemperature,
    int RidesMissingDuration
);
```

**Behavior**:
- `200 OK` for authenticated riders, even when no rides exist.
- `401 Unauthorized` when the caller is unauthenticated.
- Empty-state responses still contain empty chart arrays or zeroed mileage cards instead of errors.

---

## Modified Existing Contract: `UserSettingsUpsertRequest`

File: `src/BikeTracking.Api/Contracts/UsersContracts.cs`

```csharp
public sealed record UserSettingsUpsertRequest(
    decimal? AverageCarMpg,
    decimal? YearlyGoalMiles,
    decimal? OilChangePrice,
    decimal? MileageRateCents,
    string? LocationLabel,
    decimal? Latitude,
    decimal? Longitude,
    bool? DashboardGallonsAvoidedEnabled,
    bool? DashboardGoalProgressEnabled
);
```

**Semantics**:
- Both new fields participate in the existing partial-update semantics.
- Omitting a field leaves the prior persisted value unchanged.

---

## Modified Existing Contract: `UserSettingsView`

```csharp
public sealed record UserSettingsView(
    decimal? AverageCarMpg,
    decimal? YearlyGoalMiles,
    decimal? OilChangePrice,
    decimal? MileageRateCents,
    string? LocationLabel,
    decimal? Latitude,
    decimal? Longitude,
    bool DashboardGallonsAvoidedEnabled,
    bool DashboardGoalProgressEnabled,
    DateTime? UpdatedAtUtc
);
```

These fields allow the frontend to render suggestion state and settings defaults consistently.

---

## Modified Existing Event Payload Factories

Files:
- `RideRecordedEventPayload.cs`
- `RideEditedEventPayload.cs`

New additive optional fields:

```csharp
decimal? SnapshotAverageCarMpg = null,
decimal? SnapshotMileageRateCents = null,
decimal? SnapshotYearlyGoalMiles = null,
decimal? SnapshotOilChangePrice = null
```

These are additive and backwards-compatible for existing call sites.

---

## Frontend TypeScript Contracts

### `dashboard-api.ts`

```typescript
export interface DashboardResponse {
  totals: DashboardTotals;
  averages: DashboardAverages;
  charts: DashboardCharts;
  suggestions: DashboardMetricSuggestion[];
  missingData: DashboardMissingData;
  generatedAtUtc: string;
}

export interface DashboardTotals {
  currentMonthMiles: DashboardMileageMetric;
  yearToDateMiles: DashboardMileageMetric;
  allTimeMiles: DashboardMileageMetric;
  moneySaved: DashboardMoneySaved;
}

export interface DashboardMileageMetric {
  miles: number;
  rideCount: number;
  period: string;
}

export interface DashboardMoneySaved {
  mileageRateSavings: number | null;
  fuelCostAvoided: number | null;
  combinedSavings: number | null;
  qualifiedRideCount: number;
}

export interface DashboardAverages {
  averageTemperature: number | null;
  averageMilesPerRide: number | null;
  averageRideMinutes: number | null;
}

export interface DashboardCharts {
  mileageByMonth: DashboardMileagePoint[];
  savingsByMonth: DashboardSavingsPoint[];
}

export interface DashboardMileagePoint {
  monthKey: string;
  label: string;
  miles: number;
}

export interface DashboardSavingsPoint {
  monthKey: string;
  label: string;
  mileageRateSavings: number | null;
  fuelCostAvoided: number | null;
  combinedSavings: number | null;
}

export interface DashboardMetricSuggestion {
  metricKey: "gallonsAvoided" | "goalProgress";
  title: string;
  description: string;
  isEnabled: boolean;
}

export interface DashboardMissingData {
  ridesMissingSavingsSnapshot: number;
  ridesMissingGasPrice: number;
  ridesMissingTemperature: number;
  ridesMissingDuration: number;
}
```

### `users-api.ts`

Add to both request and response interfaces:

```typescript
dashboardGallonsAvoidedEnabled?: boolean | null;
dashboardGoalProgressEnabled?: boolean | null;
```

For the view shape:

```typescript
dashboardGallonsAvoidedEnabled: boolean;
dashboardGoalProgressEnabled: boolean;
```

---

## Compatibility Notes

- Existing user settings callers remain compatible because the new fields are additive.
- Existing ride-history API consumers remain unchanged.
- The dashboard no longer depends on ride-history pagination hacks, but `/miles` can be preserved as
  a client-side redirect to the new dashboard route for continuity.
