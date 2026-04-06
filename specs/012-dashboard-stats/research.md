# Research: Rider Dashboard Statistics

**Feature**: 012-dashboard-stats  
**Date**: 2026-04-06  
**Status**: Complete

---

## Decision 1: Use a dedicated dashboard API endpoint

**Decision**: Add an authenticated `GET /api/dashboard` endpoint instead of continuing to build the
dashboard from `GET /api/rides/history?page=1&pageSize=1`.

**Rationale**:
- The current miles page only gets summary cards by abusing the ride-history endpoint with a
  one-row page request; that is not a stable contract for charts, averages, missing-data notices,
  or optional metric suggestions.
- A dedicated query endpoint keeps dashboard-specific aggregation logic in one place and avoids
  leaking UI concerns into ride-history pagination.
- The contract can return headline totals, averages, chart series, and suggestion state together,
  which reduces frontend orchestration complexity.

**Alternatives considered**:
- **Keep extending `GET /api/rides/history`**: rejected because ride history is a list-focused read
  model, not a dashboard view model, and it would accumulate unrelated responsibilities.
- **Compute all aggregations in the frontend**: rejected because historical-snapshot fallbacks and
  savings formulas belong on the server for consistency and testability.

---

## Decision 2: Snapshot settings on each ride and in each ride event

**Decision**: Persist the calculation-relevant user settings on every ride at create/edit time and
also include the same snapshot in `RideRecordedEventPayload` and `RideEditedEventPayload`.

**Snapshot fields**:
- `AverageCarMpg`
- `MileageRateCents`
- `YearlyGoalMiles`
- `OilChangePrice` for forward compatibility, even though the current dashboard does not yet use it

**Rationale**:
- The user explicitly requested historical accuracy when settings change later.
- The current system stores mutable user settings separately from rides; relying on current
  settings would retroactively alter old savings calculations.
- Persisting snapshots both on the ride row and in the event payload matches the repo’s practical
  architecture: events preserve the audit trail and ride rows remain queryable without replay.

**Alternatives considered**:
- **Store only settings-changed events and reconstruct during dashboard queries**: rejected because
  the current app does not materialize dashboard read models from event replay, and the extra
  complexity is not justified for a local single-user application.
- **Store snapshots only in events**: rejected because the dashboard currently queries ride rows,
  not event streams, and replaying events on every dashboard load would be a structural rewrite.

---

## Decision 3: Persist optional metric approvals inside user settings

**Decision**: Extend `UserSettingsEntity`, `UserSettingsUpsertRequest`, and `UserSettingsView` with
 booleans for dashboard optional metrics, starting with:
- `DashboardGallonsAvoidedEnabled`
- `DashboardGoalProgressEnabled`

**Rationale**:
- Optional metric approval is a current rider preference, not historical ride data.
- The app already has a per-user settings record and a partial-update settings endpoint; reusing it
  is the smallest coherent change.
- Two explicit booleans are simpler and clearer than introducing a generic JSON preference bag for
  only two approved optional metrics.

**Alternatives considered**:
- **Create a separate dashboard preferences table**: rejected because it adds another entity and
  migration without functional gain at this scale.
- **Keep approvals only in browser storage**: rejected because the user expects the app to ask once
  and then respect the decision across sessions and devices/worktrees.

---

## Decision 4: Use Recharts with locally adapted ShadCN-style chart primitives

**Decision**: Implement charts with `recharts` and add a local `components/ui/chart.tsx` wrapper
patterned after ShadCN’s chart primitives, but adapted to the existing CSS approach instead of
introducing Tailwind.

**Rationale**:
- The user explicitly asked for graphs from ShadCN.
- This frontend does not use Tailwind, `class-variance-authority`, or the normal shadcn/ui setup;
  a full shadcn installation would force a large unrelated architectural change.
- ShadCN charts are fundamentally Recharts plus styling helpers; the visual and interaction pattern
  can be preserved with local wrappers and CSS variables.

**Alternatives considered**:
- **Install the full shadcn/ui + Tailwind stack**: rejected because it is high churn for one
  feature and violates the project’s existing frontend patterns.
- **Use plain Recharts with no ShadCN-style wrapper**: rejected because it would not meet the user’s
  stated design direction.

---

## Decision 5: Legacy rides without snapshots degrade safely, not retroactively

**Decision**: For rides created before snapshot support exists, the dashboard will:
- continue to include them in mileage totals and ride-count-based averages
- exclude them from exact savings totals when required snapshot data is missing
- expose missing-data counts so the UI can explain why savings totals may be partial

**Rationale**:
- Using current settings for old rides would misstate historical values.
- Backfilling old rides with guessed snapshots would fabricate historical assumptions.
- Treating missing values as zero would understate savings and hide data quality issues.

**Alternatives considered**:
- **Use current settings as fallback for old rides**: rejected because it violates the core feature
  requirement for historical accuracy.
- **Backfill all old rides during migration**: rejected because no reliable historical settings
  record exists.

---

## Decision 6: Expose two baseline savings calculations plus a combined total

**Decision**: The dashboard money-saved model will include:
- `MileageRateSavings`: `miles * mileageRateCents / 100`
- `FuelCostAvoided`: `(miles / averageCarMpg) * gasPricePerGallon`
- `CombinedSavings`: sum of the two only when both components are calculable for the included rides

**Rationale**:
- The user explicitly asked for money saved from mileage and MPG.
- Keeping both components visible prevents a “black box” combined number and makes partial-data
  cases easier to explain.
- A combined total is still useful as a headline metric when both component formulas are available.

**Alternatives considered**:
- **Show only one combined number**: rejected because riders would not be able to distinguish the
  reimbursement-style number from fuel-cost avoidance.
- **Show only one savings formula**: rejected because it would not satisfy the request for both
  mileage-based and MPG-based savings.

---

## Decision 7: Baseline chart set is monthly mileage trend + monthly savings trend

**Decision**: The first dashboard implementation will render:
- a monthly mileage trend chart over the last 12 months
- a monthly savings trend chart over the last 12 months using the same monthly buckets

Average temperature remains a headline metric rather than a baseline chart series.

**Rationale**:
- This satisfies the requirement for one mileage trend chart and one savings-or-conditions trend
  chart with the clearest user value.
- Monthly buckets are stable, easy to read, and match the requested current-month/year/total mental
  model better than daily chart noise.
- This avoids making the first version visually dense while still supporting later optional metrics.

**Alternatives considered**:
- **Daily charts**: rejected because local commute logging can be sparse and visually noisy.
- **Temperature trend as the second baseline chart**: rejected because money saved is more central
  to the requested dashboard value.
