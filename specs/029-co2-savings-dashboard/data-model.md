# Phase 1 Data Model: CO2 Savings on Advanced Dashboard

No new persisted entities or migrations are required. This feature adds a derived (request-time-only) metric to an existing read model.

## Existing Entities Read

### `RideEntity` (unchanged schema)
- `Miles: decimal` — the only input CO2 depends on; already aggregated per window as `TotalMiles` in `GetAdvancedDashboardService`.
- `RideDateTimeLocal: DateTime` — already used to bucket rides into the weekly/monthly/yearly/all-time windows; unchanged by this feature.

No other ride fields (MPG snapshot, mileage-rate snapshot, gas price) are read for CO2 — the emission factor is fixed and independent of user settings (FR-007).

## New Domain Constant

### `Co2PerMileLbs`
- **Value**: `0.90m` (lb CO2 per mile; EPA average passenger-vehicle emission factor, ~404 g/mile)
- **Location**: `AdvancedDashboardCalculations.fs`
- **Rules**: Fixed constant; never varies by user, ride, MPG, or vehicle settings.

## Feature-Level Derived Metrics

### CO2 Saved (per window)
- **Formula**: `windowTotalMiles * Co2PerMileLbs`, rounded to 2 decimal places via `RoundTo2` (`Math.Round(value, 2, MidpointRounding.AwayFromZero)`)
- **Computed for**: weekly, monthly, yearly (current-calendar-year), and all-time windows — same four windows already produced by `GetAdvancedDashboardService`
- **Validation/Rules**:
  - Always a non-null `decimal` — never null, NaN, or an error (FR-006).
  - Zero window miles → `0.00` lb (not blank/omitted).
  - Not persisted or cached; recomputed on every dashboard request (FR-005, SC-004).
  - Does not depend on `SnapshotAverageCarMpg`, `SnapshotMileageRateCents`, or any user setting (FR-007).

### CO2 Saved Per Mile
- **Formula**: `Co2PerMileLbs` itself (rounded to 2 decimal places = `0.90`), returned once at the response level (not per window).
- **Validation/Rules**:
  - Always present, even when the rider has zero rides (independent of ride count/miles — Acceptance Scenario 3, User Story 2).
  - Multiplying this value by any window's `TotalMiles` MUST reproduce that window's `Co2Saved` within 0.01 lb (SC-003).

## Contract Shape Changes

### `AdvancedSavingsWindow` (`src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs`)
- **Add**: `Co2Saved: decimal` — non-nullable (unlike `GallonsSaved`/`FuelCostAvoided`, which are nullable due to optional user settings; CO2 has no such dependency).

### `AdvancedDashboardResponse` (same file)
- **Add**: `Co2SavedPerMileLbs: decimal` — the fixed per-mile constant, exposed once per response.

## Presentation State Rules (Frontend)

- `SavingsWindowsTable` renders a new "CO2 Saved" column for all four window rows, formatted as `"{value.toFixed(2)} lb"` (or equivalent, consistent with existing `formatGallons`-style helpers).
- The per-mile factor (`co2SavedPerMile`) is rendered once, near the CO2 totals (e.g., in a caption/subheading), not per row.
- Zero values render as `"0.00 lb"`, not blank or `"—"` (CO2 is never null, unlike `gallonsSaved`/`fuelCostAvoided`).

## Relationship/Flow

`RideEntity.Miles` (aggregated as window `TotalMiles`, already computed) → `AdvancedDashboardCalculations.calculateCo2Saved` (F#, pure) → `GetAdvancedDashboardService.BuildWindow` → `AdvancedSavingsWindow.Co2Saved` / `AdvancedDashboardResponse.Co2SavedPerMileLbs` → `advanced-dashboard-api.ts` typed model → `SavingsWindowsTable` display.
