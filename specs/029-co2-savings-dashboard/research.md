# Phase 0 Research: CO2 Savings on Advanced Dashboard

## Decision 1: "Currently selected year" maps to the advanced dashboard's existing yearly window (no new year selector)

- **Decision**: The advanced dashboard's yearly window (`GetAdvancedDashboardService.BuildWindow("yearly", ...)`) already scopes to the current calendar year (`nowLocal.Year`, Jan 1–Dec 31) with no persisted, user-facing year-picker control on that page today (year selection exists only on the separate year-stats dashboard, `GetYearStatsDashboardService`). This feature adds CO2 to the existing yearly window computation as-is; it does not introduce a new year selector or change which year the yearly window covers.
- **Rationale**: The spec's acceptance scenarios describe CO2 recalculating "when the user changes the selected year" as a restatement of existing yearly-window behavior (rides table dates changing, dashboard reloading) rather than a request for a new UI control — the assumptions section explicitly says this feature "does not introduce a new year selector." Reusing the existing per-window computation keeps the change additive and avoids scope creep into an unrelated dashboard.
- **Alternatives considered**: Adding a year-select control to the advanced dashboard yearly window (rejected — explicitly out of scope per spec assumptions and would require its own dedicated feature/spec); wiring CO2 into the year-stats dashboard instead (rejected — spec explicitly targets "the advanced dashboard's overall/yearly saved section").

## Decision 2: Compute CO2 as a pure F# function alongside existing per-ride/window calculations

- **Decision**: Add `calculateCo2Saved` (and a `Co2PerMileLbs = 0.90m` constant) to `AdvancedDashboardCalculations.fs`, following the same shape as `calculateGallonsSaved`/`calculateMileageRateSavings`: takes total window miles (or a `RideSnapshot list`), returns a rounded `decimal`, and never returns `None`/null/NaN — zero miles yields `0m` per FR-006.
- **Rationale**: Keeps the calculation pure, unit-testable in isolation, and consistent with the existing domain-layer pattern (ports-and-adapters: pure F# domain calculations, C# service orchestrates and reads/writes). Unlike `calculateGallonsSaved` (which needs `Option` because it depends on a user-configured MPG that may be missing), CO2 has no missing-data case — it only depends on `TotalMiles`, which is always a known decimal — so the function returns a plain `decimal`, not `decimal option`.
- **Alternatives considered**: Computing CO2 inline in `GetAdvancedDashboardService.BuildWindow` as a one-line expression (rejected — the constitution favors pure domain-layer calculations for the F# module, and this keeps CO2 unit-testable the same way as the other savings metrics); making it dependent on user MPG/vehicle settings (rejected — explicitly forbidden by FR-007).

## Decision 3: Expose CO2 via existing per-window contract plus one new response-level constant

- **Decision**: Add `Co2Saved: decimal` (non-nullable, since it's always computable) to `AdvancedSavingsWindow`, and add `Co2SavedPerMileLbs: decimal` as a single constant field on `AdvancedDashboardResponse` (not per-window, since the per-mile factor is fixed and window-independent per FR-004/Acceptance Scenario 2 in User Story 2).
- **Rationale**: Matches the existing pattern of extending `AdvancedSavingsWindow` per new metric (e.g., `OilChangeSavings`, `NetSavings`) while avoiding needless repetition of a constant value across four windows. Placing the per-mile factor once at the response level directly satisfies "per-mile value... displayed alongside the total CO2 saved figures" without suggesting it varies by window.
- **Alternatives considered**: Repeating the per-mile factor on every `AdvancedSavingsWindow` (rejected — redundant, and risks the four values silently drifting if the constant is ever refactored); returning `Co2Saved` as nullable to mirror `GallonsSaved`/`FuelCostAvoided` (rejected — those are nullable because they depend on optional user settings; CO2 has no such dependency and FR-006 requires zero, not null, for empty windows).

## Decision 4: Rounding and unit conventions match existing savings metrics

- **Decision**: Round `Co2Saved` and `Co2SavedPerMileLbs` to 2 decimal places using `Math.Round(value, 2, MidpointRounding.AwayFromZero)` — the same helper (`RoundTo2`) already used for `GallonsSaved`, `FuelCostAvoided`, `MileageRateSavings`, etc. Units are pounds (lb) of CO2, consistent with the spec's fixed choice of US customary units matching existing gallons/miles conventions.
- **Rationale**: FR-009 explicitly requires the same 2-decimal-place convention already used for gallons/currency; reusing `RoundTo2` guarantees consistent behavior and avoids introducing a second rounding helper.
- **Alternatives considered**: Kilograms of CO2 (rejected — spec assumption explicitly calls for pounds, consistent with existing miles/gallons US-customary convention); more/fewer decimal places (rejected — spec clarification session fixed 2 decimal places).

## Open Items

None. All NEEDS CLARIFICATION items are resolved either by the spec's own Clarifications session (emission factor, decimal precision) or by the decisions above (year-selector mapping, calculation placement, contract shape, rounding).

## Post-Implementation Notes

_To be filled in during/after implementation if any decisions above change._
