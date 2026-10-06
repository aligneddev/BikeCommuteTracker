# Research: Riding Time Totals

**Feature**: `031-ride-time-stats` | **Date**: 2026-10-06

The Technical Context had no `NEEDS CLARIFICATION` items: the stack, storage, and test tooling are all existing and unchanged. The decisions below settle the design choices that the spec left open.

## Decision 1: API returns integer total minutes; the frontend formats hours and minutes

- **Decision**: Each response gets a non-nullable `int TotalRideMinutes` (raw minutes). The frontend turns it into `"{h}h {m}m"`.
- **Rationale**: Matches existing conventions. The API returns raw numeric values (`AverageRideMinutes`, `TotalMiles`, `Co2Saved`), and pages own presentation (`formatMiles`, `formatCurrency`, `formatCo2`, `formatRideDuration`). Raw minutes keep the contract unit-stable and easy to assert in API tests, and display wording can change later without an API change. `int` is enough: `RideMinutes` is `int?`, and `int.MaxValue` minutes is about 4,000 years of riding.
- **Alternatives considered**:
  - *Separate `Hours` + `Minutes` fields*: rejected. Two fields to keep consistent, and an awkward shape for future reuse (e.g. charts).
  - *Pre-formatted string from the API*: rejected. Mixes presentation into the contract, and no other dashboard field does this.
  - *Decimal hours*: rejected. FR-006 explicitly forbids decimal-hours display, and converting back to minutes would add rounding error.
  - *`long`*: unnecessary given the bounds above, and it diverges from the `int?` source column.

## Decision 2: Non-nullable `0` instead of `null` for "nothing to sum"

- **Decision**: `TotalRideMinutes` is `0` when the scope has no rides or no rides with a duration. The UI renders `0h 0m`.
- **Rationale**: A sum over an empty set is naturally zero, and the existing totals (`TotalMiles`, `RideCount`, `Co2Saved`) are non-nullable for the same reason. The 029 CO2 feature made the same choice ("`0` (not `null`) when the window has zero ride miles"). This meets FR-005 and SC-003: no error and no blank value. On year stats, the "no data for this year" case is already handled by `HasDataForYear == false`, which hides the whole summary and shows the existing empty-state message (US3 AC2). A year that has rides but no durations shows `0h 0m`, exactly as Edge Case 4 requires. The main dashboard's existing `MissingData.RidesMissingDuration` count continues to flag an incomplete total (US1 AC3), so nullability isn't needed to signal partial data.
- **Alternatives considered**:
  - *`int?` with `null` when no ride has a duration*: rejected. It would make year stats render "—" for a year with rides but no durations, contradicting Edge Case 4. It also adds a null branch on three pages for no user benefit.

## Decision 3: Keep the calculation in a C# `Application/Dashboard` helper, not the F# domain

- **Decision**: Add `internal static class RidingTimeRules` with `SumRecordedRideMinutes(IEnumerable<RideEntity> rides) => rides.Where(r => r.RideMinutes.HasValue).Sum(r => r.RideMinutes!.Value)`, next to `SavingsCalculationRules.cs`.
- **Rationale**: All three services already compute sibling aggregations (`rides.Sum(r => r.Miles)`, `CalculateAverageRideMinutes`) in C# directly over `RideEntity` lists. A null-excluding sum has no policy, constants, or business rule beyond FR-004. The CO2 feature (029) used F# because it introduced a domain constant (0.90 lb/mile) and an emission rule. A shared helper, rather than three inline `Sum` calls, guarantees the three surfaces agree (SC-002) and gives FR-004 one unit-testable home. It follows the established `SavingsCalculationRules` pattern.
- **Alternatives considered**:
  - *Add `calculateTotalRideMinutes` to `AdvancedDashboardCalculations.fs`*: rejected. It requires projecting `RideEntity` into an F# snapshot type at three call sites for a one-line sum. That is more ceremony than value, and inconsistent with how mileage totals are computed.
  - *Inline `Sum` in each service*: rejected. It triplicates the FR-004 filtering rule and invites drift.
  - *Database-side `SumAsync`*: rejected. Every service already materializes the rider's rides for other sections, so an extra query would add a round-trip for no gain.

## Decision 4: Advanced dashboard — one response-level all-time value, not per-window

- **Decision**: Add `TotalRideMinutes` to `AdvancedDashboardResponse` (computed from all rides), placed after `Co2SavedPerMileLbs` and before the optional `DifficultySection` parameter. Render it as an "All-time riding time: 42h 15m" line inside the existing Savings Breakdown section, next to the CO2-per-mile line that `SavingsWindowsTable` already shows above the table.
- **Rationale**: Spec Assumption 1 limits scope to the all-time figure. The advanced dashboard has no separate "overall summary" panel; its only all-time view is the `allTime` row of the savings windows table. Adding a column to `AdvancedSavingsWindow` would either compute weekly, monthly, and yearly values that the spec excludes, or leave three cells blank. A single response-level field keeps the contract honest about scope. The record parameter must come before `DifficultySection`, which has a default value, so the positional record still compiles.
- **Alternatives considered**:
  - *Add `TotalRideMinutes` to `AdvancedSavingsWindow` and show a column for all four windows*: cheap to build and arguably useful, but out of the spec's stated scope. It is noted as a possible follow-up, not built here.
  - *Add it only to `AllTime` as a nullable window field*: rejected. The same record shape would carry different semantics per instance, which is confusing for API consumers.

## Decision 5: Frontend formatting — shared `formatHoursMinutes` in `src/utils/ridingTime.ts`

- **Decision**: `formatHoursMinutes(totalMinutes: number): string` returns `` `${Math.floor(totalMinutes / 60).toLocaleString('en-US')}h ${totalMinutes % 60}m` ``. Examples: `0 → "0h 0m"`, `45 → "0h 45m"`, `120 → "2h 0m"`, `62_550 → "1,042h 30m"`.
- **Rationale**: Three pages need identical output (SC-002), so one helper avoids drift. `src/utils/` already holds cross-page helpers (`windResistance.ts`). The existing `formatRideDuration` in `pages/miles/history-page.helpers.ts` formats a single ride as `"45 min"` and returns `""` for missing values. Those semantics don't fit here, so it stays unchanged. The `en-US` locale matches the explicit `en-US` currency formatting used across the dashboards and gives the `"1,042h"` grouping from Edge Case 2. Always showing the `Xh Ym` form, even `0h 45m` or `2h 0m`, keeps the format predictable across all three surfaces.
- **Alternatives considered**:
  - *Drop zero parts (`"45m"`, `"2h"`)*: rejected. The output would be less uniform, and tests and E2E assertions would need more cases.
  - *Reuse or extend `formatRideDuration`*: rejected. Different semantics (single ride, minutes only, empty string for missing), and it lives in a page-scoped helper file.

## Decision 6: Placement on each page

- **Main dashboard**: a new `DashboardSummaryCard` titled "Riding Time" (eyebrow "Duration", matching the category-style eyebrows of the other cards) in `dashboard-summary-grid`, placed after the "All Time" mileage card. The value is `formatHoursMinutes(totals.totalRideMinutes)`. The detail is `"{n} rides missing duration"` when `missingData.ridesMissingDuration > 0`, and otherwise the all-time ride count. This puts the incomplete-data signal (US1 AC3) next to the number. The empty-state default object in `dashboard-page.tsx` gets `totalRideMinutes: 0`. Rationale: US1 asks for the stat "alongside the mileage and savings totals", which are the summary cards. The averages row holds per-ride averages, not totals.
- **Advanced dashboard**: see Decision 4.
- **Year stats**: a new `<div className="year-stats-summary-item"><dt>Total riding time</dt><dd>…</dd></div>` after "Total miles" in `year-stats-summary-totals`. It is inside the `hasDataForYear` branch, so it gets the existing empty-state treatment for free (US3 AC2), and it updates with the page's existing year-change fetch (US3 AC3, SC-004).
