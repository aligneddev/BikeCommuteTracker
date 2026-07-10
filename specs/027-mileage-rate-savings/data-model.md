# Phase 1 Data Model: Split Savings Display Metrics

No new persisted entities or migrations are required. This feature updates computed/read models used by dashboard/results presentation.

## Existing Entities Read

### `RideEntity` (unchanged schema)
- `Miles: decimal`
- `SnapshotMileageRateCents: decimal?`
- Inputs required to derive gallons-based metric as defined in spec (`gallonsSaved` source from existing ride snapshot-derived data path)

### `DashboardMoneySaved` projection (`src/BikeTracking.Api/Contracts/DashboardContracts.cs`)
- `MileageRateSavings: decimal?`
- `FuelCostAvoided: decimal?` (mapped to displayed "Gallons-based savings" metric)
- `QualifiedRideCount: int`

## Feature-Level Derived Metrics

### Mileage Rate Savings
- **Label**: `Mileage rate savings`
- **Formula**: `mileageRate * miles`
- **Validation/Rules**:
  - Uses ride snapshot mileage rate for historical correctness when present.
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

`RideEntity snapshot inputs` → `GetDashboardService` aggregation → `DashboardMoneySaved contract` → `dashboard-api.ts typed model` → `dashboard-page.tsx split metric display`
