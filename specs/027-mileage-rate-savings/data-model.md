# Phase 1 Data Model: Split Savings Display Metrics

No new persisted entities or migrations are required. This feature updates computed/read models used by dashboard/results presentation.

## Existing Entities Read

### `RideEntity` (unchanged schema)
- `Miles: decimal`
- Inputs required to derive gallons-based metric as defined in spec (`gallonsSaved` source from existing ride snapshot-derived data path)

### `UserSettingsEntity` (unchanged schema)
- `MileageRateCents: decimal?` (rate source for dashboard month/year mileage-rate savings aggregation)

### `DashboardMoneySaved` projection (`src/BikeTracking.Api/Contracts/DashboardContracts.cs`)
- `MileageRateSavings: decimal?`
- `FuelCostAvoided: decimal?` (mapped to displayed "Gallons-based savings" metric)
- `QualifiedRideCount: int`

## Feature-Level Derived Metrics

### Mileage Rate Savings
- **Label**: `Mileage rate savings`
- **Formula**: `configuredMileageRate * periodMiles`
- **Validation/Rules**:
  - Uses current user settings `MileageRateCents` as rate source for dashboard period totals.
  - Renders as formatted currency with current rounding rules.
  - Zero values still render.

### Gallons-Based Savings
- **Label**: `Gallons-based savings`
- **Formula**: `gallonsSaved * miles`
- **Validation/Rules**:
  - Uses the existing dashboard savings data path for `gallonsSaved` derivation.
  - Renders as formatted currency with current rounding rules.
  - Zero values still render.

## Presentation State Rules

- Two separate lines must always be rendered together in the dashboard/results summary section.
- The target view must not show a merged single-total savings value.
- Existing formatting/rounding and missing-data fallback behavior remain unchanged.

## Relationship/Flow

`UserSettingsEntity.MileageRateCents` + `RideEntity.Miles` → `GetDashboardService` / `GetYearStatsDashboardService` aggregation → `DashboardMoneySaved` / `YearStatsSavingsPoint` contract → frontend typed model → split metric display
