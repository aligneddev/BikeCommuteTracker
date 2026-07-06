# Phase 0 Research: Year Stats Dashboard

All items below were "NEEDS CLARIFICATION" candidates from the Technical Context template. Each is resolved by direct inspection of the existing codebase rather than external research, since this feature reuses existing infrastructure end-to-end.

## Decision 1: How should "year-scoped" differ from the existing rolling/calendar windows?

- **Decision**: Year-scoped series are a fixed Jan 1–Dec 31 window for the *selected* year, built the same way `GetDashboardService.BuildMileageSeries`/`BuildSavingsSeries` build a rolling 12-month window — by enumerating 12 `DateTime` month buckets and summing ride data per bucket — except the enumeration starts at `new DateTime(year, 1, 1)` instead of `nowLocal.AddMonths(-11)`.
- **Rationale**: Keeps the same per-month aggregation shape and DTO structure the frontend chart components already consume (`MonthKey`, `Label`, `Miles`, `MileageRateSavings`, etc.), minimizing frontend changes to prop-threading only.
- **Alternatives considered**: Reusing `GetDashboardService.EnumerateRollingMonths` with a parameter — rejected because that method is anchored to "now" and used by production rolling-window behavior; changing its signature risks regressing FR-005/SC-003. A parallel, year-anchored enumeration in the new service avoids any shared-code risk to the existing dashboard.

## Decision 2: Do the existing chart components need to be physically moved into a new "components" directory?

- **Decision**: No physical move is required. `dashboard-chart-section.tsx` (mileage/savings charts) and `DifficultyAnalyticsSection.tsx` (difficulty/wind charts) already only consume props (`mileageByMonth`, `savingsByMonth`, `section`) with no internal data fetching or hooks — confirmed by direct inspection. "Extraction into reusable, year-parameterized components" (FR-004) is satisfied by adding an optional `year`/label prop to `dashboard-chart-section.tsx` for cosmetic differences (e.g., replacing "Rolling 12 Months" copy with the selected year) while leaving the rendering logic and `DifficultyAnalyticsSection.tsx` untouched.
- **Rationale**: Avoids unnecessary file churn and merge risk; satisfies the spec's intent (single source of truth for chart rendering, reused by two pages) without a large refactor.
- **Alternatives considered**: Moving chart internals into a new `src/components/charts/` directory and having both `dashboard-chart-section.tsx` and the new page import from there — rejected as unnecessary scope; the components are already reusable as-is, only their *data source* differs (rolling vs. year-scoped), which is a backend/service concern, not a component-location concern.

## Decision 3: Where does year-filtering belong — F# domain or C# application service?

- **Decision**: Year filtering of the rider's ride list happens in the new C# `GetYearStatsDashboardService`, before calling into existing F# pure functions (`AdvancedDashboardCalculations.calculateDifficultyByMonth`, `calculateWindResistanceDistribution`, `calculateOverallAverageDifficulty`). No F# module changes.
- **Rationale**: The F# functions already accept a caller-supplied `RideDifficultySnapshot list` / `RideSnapshot list` with no embedded time-window assumption — filtering by year is a data-selection/orchestration concern, not a domain calculation rule. This matches `docs/agent/architecture-principles.md` ("keep domain and application logic isolated... separate orchestration, business rules, and I/O concerns") and avoids growing the F# API surface for a concern that's inherently about "which rides to look at," not "how to calculate on rides."
- **Alternatives considered**: Adding a `year: int option` parameter to each F# function — rejected; it would require touching multiple existing, already-tested pure functions and their C# call sites (`GetAdvancedDashboardService`) purely to add a filter that can be applied identically and more simply by the C# caller with a single `.Where(...)`.

## Decision 4: How should "no data for this year" be represented in the API contract?

- **Decision**: Add explicit boolean flags to the response (e.g., `HasDataForYear` at the top level, or per-section flags if sections can independently be empty) rather than relying on the frontend to infer emptiness from zero-filled series.
- **Rationale**: `docs/agent/domain-and-error-handling.md` requires expected outcomes (here: "no rides this year" is an entirely expected, common case) to be represented as explicit data, not inferred or thrown. This also directly satisfies FR-007 ("MUST show an explicit empty/no-data state rather than an error or a misleading blank chart").
- **Alternatives considered**: Returning `null` arrays and letting the frontend treat `null`/`[]` as "no data" — rejected; ambiguous with legitimate zero-mileage months within an otherwise active year, and less explicit than a dedicated flag.

## Decision 5: How should the year selector's option list be sourced?

- **Decision**: New `GetAvailableYearsAsync` on the same service queries `SELECT DISTINCT YEAR(RideDateTimeLocal)` (via LINQ `.Select(r => r.RideDateTimeLocal.Year).Distinct()`) for the rider, sorted descending, falling back to `[DateTime.Now.Year]` when the rider has no rides at all.
- **Rationale**: Directly matches FR-002/FR-008 and the spec's edge cases (never offer a year with zero data unless the rider has no data at all, in which case offer the current year as a usable fallback default).
- **Alternatives considered**: Computing available years client-side from an already-fetched full ride list — rejected; no such full-ride-list fetch exists on any dashboard page today (dashboards are pre-aggregated server-side), and doing so would pull unnecessary data across the wire.

## Decision 6: Should the new endpoints live in `DashboardEndpoints.cs` or a new file?

- **Decision**: Extend the existing `DashboardEndpoints.cs` with two new routes (`GET /api/dashboard/year-stats`, `GET /api/dashboard/year-stats/years`), following the same `MapGet(...).RequireAuthorization().WithName(...).WithSummary(...).Produces<...>()` chain already used for `/api/dashboard` and `/api/dashboard/advanced`.
- **Rationale**: All three dashboard flavors (main, advanced, year-scoped) are conceptually one route group; keeping them together matches the existing file's single-responsibility ("dashboard endpoints") and avoids fragmenting route registration across files for what is a small addition (2 routes).
- **Alternatives considered**: A dedicated `YearStatsDashboardEndpoints.cs` — rejected as unnecessary for two small GET routes; would be reconsidered only if the year-stats surface grows substantially (e.g., mutation endpoints).

## Open Items

None — all Technical Context unknowns resolved by direct codebase inspection; no external library research or spike required since the feature is additive and reuses existing patterns exclusively.
