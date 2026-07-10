# Phase 0 Research: Split Savings Display Metrics

## Decision 1: Keep scope to existing dashboard/results path

- **Decision**: Limit changes to the existing dashboard summary savings presentation and its direct backend aggregation/contract path (`GetDashboardService`, `DashboardContracts`, dashboard page/types/tests).
- **Rationale**: The spec is narrowly focused on splitting displayed savings metrics and preserving existing behavior elsewhere.
- **Alternatives considered**: Broad dashboard-wide savings redesign (rejected as out-of-scope).

## Decision 2: Treat spec formulas as authoritative for this feature

- **Decision**: Use the formulas defined in the feature spec as the source of truth:
  - Mileage rate savings = `mileageRate * miles` (using ride snapshot mileage rate when available).
  - Gallons-based savings = `gallonsSaved * miles`.
- **Rationale**: The user requested that planning stay tight and use formulas already defined in spec #27.
- **Alternatives considered**: Preserving legacy merged-savings semantics only (rejected because it conflicts with FR-001..FR-004).

## Decision 3: Preserve formatting/rounding rules by reusing current formatting utilities

- **Decision**: Keep existing currency/unit/rounding behavior in the frontend formatter and backend rounding utilities; only split labeling/value wiring.
- **Rationale**: FR-005 explicitly requires unchanged presentation conventions.
- **Alternatives considered**: Introducing new formatting logic for split metrics (rejected to avoid regressions).

## Decision 4: Keep contract alignment explicit

- **Decision**: Document and validate the `/api/dashboard` money-saved fields used for split display, and synchronize backend/frontend tests if any field semantics are adjusted.
- **Rationale**: FR-007/FR-008 require contract and test synchronization across layers.
- **Alternatives considered**: Frontend-only change without contract verification (rejected because it can hide backend/frontend drift).

## Open Items

None. Technical context clarifications are resolved for planning scope.

## Post-Implementation Notes

### Confirmed Decisions

- Dashboard `moneySaved` contract remains split-only (`mileageRateSavings`, `fuelCostAvoided`, `qualifiedRideCount`) and omits `combinedSavings` for this endpoint.
- Split savings rows continue using existing currency formatting and away-from-zero rounding conventions.
- Ride-entry create/edit behavior remains unchanged; no new ride contracts, entities, or migrations were introduced.

### Non-Goals Reaffirmed

- No redesign of advanced dashboard or year-stats savings contracts.
- No schema or migration work for ride-entry persistence.
- No changes to gas-price/weather collection behavior outside existing ride-entry flows.
