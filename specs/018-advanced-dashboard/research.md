# Research: Advanced Statistics Dashboard

**Branch**: `018-advanced-dashboard` | **Date**: 2026-04-22

## Summary

All technical unknowns resolved from codebase inspection and spec clarifications. No external API research required — all data comes from existing SQLite tables (`Rides`, `UserSettings`, `GasPriceLookups`).

---

## Decision 1: Time Window Definitions

**Question**: Should weekly/monthly/yearly windows use calendar periods or rolling windows?

**Decision**: Use calendar periods consistent with the existing dashboard service (`GetDashboardService`):
- **Weekly**: current calendar week (Monday–Sunday, ISO week)
- **Monthly**: current calendar month (1st to last day of current month)
- **Yearly**: current calendar year (Jan 1 to Dec 31)
- **All-time**: all rides regardless of date

**Rationale**: The existing dashboard service uses `currentMonthStart = new DateTime(nowLocal.Year, nowLocal.Month, 1)` and `currentYearStart = new DateTime(nowLocal.Year, 1, 1)` — calendar windows. Consistency prevents user confusion when comparing the two dashboards. Rolling windows would give subtly different numbers than the main dashboard's existing month/year totals.

**Alternatives considered**: Rolling 7-day, 30-day, 365-day windows — rejected because they produce values that diverge from the intuitive "this week / this month / this year" mental model.

---

## Decision 2: MPG Source for Gallons-Saved Calculation

**Question**: Should the advanced dashboard use per-ride snapshotted MPG (`SnapshotAverageCarMpg`) or the user's current `AverageCarMpg` setting?

**Decision**: Use **per-ride `SnapshotAverageCarMpg`** for all historical savings calculations, identical to the existing `CalculateGallonsAvoided` method in `GetDashboardService`. Show the current `AverageCarMpg` user setting in the reminder card when it is null, so users understand what drives the calculation.

**Rationale**: Spec 012 established the snapshot pattern to preserve historical accuracy — if the user changes their MPG setting, past ride savings should not change retroactively. Gallons saved formula: `miles / snapshotMpg` per ride, summed. Already proven in `GetDashboardService.CalculateGallonsAvoided`.

**Alternatives considered**: Using current user setting for simplicity — rejected because it causes retroactive recalculation of historical data, violating the immutable-events principle.

---

## Decision 3: Estimated Gas Price Flag

**Question**: How to determine if money-saved values used fallback gas prices?

**Decision**: A ride is considered to have a **known gas price** when `GasPricePerGallon IS NOT NULL` on the ride record. For rides where `GasPricePerGallon IS NULL`, the advanced dashboard service queries `GasPriceLookups` for the most recent entry before or on the ride date and uses that price (fallback). If even the fallback is unavailable, that ride contributes $0 to fuel-cost avoided.

The response includes `FuelCostEstimated = true` for a given time window when any ride in that window used a fallback gas price (i.e., had `GasPricePerGallon IS NULL`). This matches the spec requirement: "label money-saved values as estimated when fallback gas prices are used".

**Rationale**: `GasPricePerGallon` is already stored per ride as of spec 010. Rides pre-spec-010 or rides where the user didn't have a gas price set will have NULL. `GasPriceLookups` already exists as a cache table from spec 010's `GasPriceLookupService`.

**Alternatives considered**: Storing a separate `GasPriceWasEstimated` boolean per ride — rejected because it requires a new migration and the NULL check achieves the same result without schema changes.

---

## Decision 4: Mileage-Rate Savings Calculation

**Question**: What is the formula and data source for mileage-rate savings?

**Decision**: Mileage-rate savings use **per-ride `SnapshotMileageRateCents`** (already stored as of spec 012). Formula per ride: `miles × snapshotMileageRateCents / 100`. Summed across all rides in a window.

If `SnapshotMileageRateCents IS NULL` for a ride, that ride contributes $0 to mileage-rate savings. If the user's current `MileageRateCents` setting is NULL, the reminder card is shown. The reminder flag is derived from `UserSettings.MileageRateCents IS NULL` — not from ride snapshots (a user may have set it after early rides).

**Rationale**: Consistent with how spec 012's `GetDashboardService.CalculateSavings` already operates — it uses snapshots for historical accuracy. The snapshot is set at ride creation time from the user's current setting.

**Alternatives considered**: Using current `MileageRateCents` setting for all rides — rejected for the same retroactive-recalculation reason as MPG.

---

## Decision 5: Rule-Based Suggestion Types (MVP)

**Question**: What are the exact rules for the three suggestion types?

**Decision**:

| Type | MetricKey | Trigger Condition | Message Pattern |
|------|-----------|-------------------|-----------------|
| Consistency | `consistency` | User has ≥ 1 ride in the current calendar week | "You've biked {n} time(s) this week — great consistency!" |
| Milestone | `milestone` | All-time savings (combined) crosses a $10/$50/$100/$500 threshold for the first time this session | "You've saved over ${threshold} biking instead of driving!" |
| Comeback | `comeback` | Last ride was > 7 days ago (and user has ≥ 1 prior ride) | "It's been {n} days since your last ride — hop back on!" |

All three suggestions are always returned in the response; `IsEnabled = true` when the condition is met, `IsEnabled = false` otherwise. This matches the existing `DashboardMetricSuggestion` contract pattern used by spec 012.

**Rationale**: Three deterministic rules with clear, testable trigger conditions. No AI or ML required. Milestone thresholds are chosen to feel achievable and progressive. Comeback is triggered at 7 days (a week gap) which is meaningful without being guilt-inducing.

**Alternatives considered**: More complex scoring or personalisation — deferred per spec clarification (suggestions scope = 3 rule-based MVP only).

---

## Decision 6: App Navigation Placement

**Question**: Where exactly should the navigation links appear?

**Decision**:
1. **Top nav** (`app-header.tsx`): Add a `NavLink` to `/dashboard/advanced` labeled "Advanced Stats" after the existing "Dashboard" NavLink, following the same `nav-link`/`nav-link-active` class pattern.
2. **Dashboard card action** (`dashboard-page.tsx`): Add a `<Link to="/dashboard/advanced">View Advanced Stats →</Link>` styled as a secondary card action below the existing savings summary, using existing CSS class patterns (not new CSS).

**Rationale**: Both entry points increase discoverability per FR-006 and FR-013. The card action contextualises the link within the savings section. The top nav provides persistent access from any page.

**Alternatives considered**: Only top nav — rejected because the spec requires both (Option D clarification). Only card — rejected for the same reason.
