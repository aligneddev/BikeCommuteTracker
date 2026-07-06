# Phase 1 Data Model: Year Stats Dashboard

This feature introduces **no new persisted entities and no schema migrations**. It is a read-only projection over existing data. This document describes the entities read, the new response shapes returned by the API, and validation/state rules.

## Existing Entities Read (unchanged)

### `RideEntity` (`src/BikeTracking.Api/Infrastructure/Persistence/Entities`)
Fields relevant to this feature (all pre-existing, no changes):
- `RiderId: long` — scoping filter.
- `RideDateTimeLocal: DateTime` — used to bucket rides into the selected year's Jan–Dec months, and to compute the distinct-years list for the year selector.
- `Miles: decimal` — summed per month for the mileage trend chart.
- `SnapshotMileageRateCents: decimal?` — historical mileage-rate-in-effect at ride time; used unchanged for mileage-rate savings (FR-006).
- `SnapshotAverageCarMpg: decimal?` — historical average car MPG in effect at ride time; used unchanged for fuel-cost-avoided/gallons-avoided savings (FR-006).
- `GasPricePerGallon: decimal?` — used with `SnapshotAverageCarMpg` for fuel-cost-avoided.
- Difficulty/wind fields (`Difficulty`, `WindResistanceRating`, or equivalent wind-direction/speed inputs) already consumed by `GetAdvancedDashboardService` and `AdvancedDashboardCalculations.fs` — read as-is, no changes.

### `UserSettingsEntity`
- Not used for historical savings math (that comes from per-ride snapshots), but may still be read if the year-stats page reuses any current-settings-driven suggestion/goal widgets in the future. Out of scope for this feature's charts.

## New Response DTOs (`src/BikeTracking.Api/Contracts`)

These mirror the naming/shape conventions of existing `DashboardMileagePoint` / `DashboardSavingsPoint` / advanced-dashboard difficulty DTOs, adding an explicit year and empty-state signal.

```text
YearStatsDashboardResponse
├── Year: int                                  # the year this response describes
├── HasDataForYear: bool                        # true if the rider has ≥1 ride in this year
├── MileageByMonth: YearStatsMileagePoint[]      # always 12 entries, Jan..Dec of Year
├── SavingsByMonth: YearStatsSavingsPoint[]      # always 12 entries, Jan..Dec of Year
├── Difficulty: YearStatsDifficultySection        # difficulty-by-month + most-difficult-months
└── WindResistance: YearStatsWindResistanceSection # wind resistance distribution bins

YearStatsMileagePoint
├── MonthKey: string        # "yyyy-MM", e.g. "2026-03"
├── Label: string           # "Mar"
└── Miles: decimal          # 0 for months with no rides (not omitted)

YearStatsSavingsPoint
├── MonthKey: string
├── Label: string
├── MileageRateSavings: decimal?   # null if no qualifying ride that month
├── FuelCostAvoided: decimal?      # null if no qualifying ride that month
└── CombinedSavings: decimal?      # null if both components null

YearStatsDifficultySection
├── HasData: bool
├── OverallAverageDifficulty: decimal?
├── ByMonth: YearStatsDifficultyByMonthPoint[]   # only months with ≥1 difficulty-rated ride
└── MostDifficultMonths: YearStatsDifficultyByMonthPoint[]  # top N, existing ranking rule reused

YearStatsDifficultyByMonthPoint
├── MonthKey: string
├── Label: string
└── AverageDifficulty: decimal

YearStatsWindResistanceSection
├── HasData: bool
└── Bins: YearStatsWindResistanceBin[]     # reuses WindResistance.fs bin shape

YearStatsWindResistanceBin
├── Label: string     # existing bin label convention (e.g. "Headwind", "Tailwind", "Crosswind")
└── Count: int

AvailableYearsResponse
└── Years: int[]      # distinct years descending; [currentYear] if rider has no rides
```

## Validation Rules

- `year` query parameter (on `GET /api/dashboard/year-stats?year={yyyy}`):
  - MUST parse as a 4-digit integer.
  - MUST be within a sane bound (e.g., `1900 <= year <= currentYear + 1`) — reject with `400 Bad Request` otherwise (mirrors existing `from`/`to` parsing style in `RidesEndpoints.cs`).
- No rider input is written; this is a pure read/aggregation feature, so no write-side validation, no audit log entries, and no state transitions apply.

## State / Empty-State Rules

- A month within the selected year with zero rides still appears in `MileageByMonth`/`SavingsByMonth` with `Miles: 0` / null savings fields — it is **not omitted** from the 12-entry array, so the frontend can render a flat/zero bar rather than a gap (matches the in-progress-year edge case: elapsed months with real zero mileage vs. future months are visually indistinguishable by design, since the spec only requires not fabricating projected data, not distinguishing "zero" from "future").
- `HasDataForYear = false` when the rider has zero rides in the selected year at all — the frontend renders the FR-007 "no data for this year" state for every chart section in that case instead of a set of empty bars.
- `Difficulty.HasData` / `WindResistance.HasData` are independently false when the rider has rides that year but none have difficulty/wind data recorded — allowing partial empty-states (e.g., mileage/savings render normally while difficulty section shows "no data").

## Relationships

No new relationships. All data flows one-directional: `RideEntity` (existing) → year filter (new service) → existing F# pure functions (unchanged) → new response DTOs (new) → existing/threaded React chart components (extended with `year` prop).
