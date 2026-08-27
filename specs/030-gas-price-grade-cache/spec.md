# Feature Specification: Gas Price Grade Selection & Cache Refresh Policy

**Feature Branch**: `030-gas-price-grade-cache`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "The current gas price lookup is always at premium and doesn't reflect my local gas price. Let the user choose regular or premium. Verify the current gas price lookup caching is correct and modify it to cache to every 3 days."

## Current Behavior (Investigation Findings)

<!--
  Grounding notes from auditing the existing implementation
  (BikeTracking.Api: Application/Rides/GasPriceLookupService.cs,
  Infrastructure/Persistence/Entities/GasPriceLookupEntity.cs,
  Application/Imports/GasPriceWeekKeyHelper.cs, Endpoints/RidesEndpoints.cs)
  before this feature was specified. Kept here so implementers understand
  what is actually changing vs. what was assumed by the request.
-->

- The gas price lookup calls the U.S. Energy Information Administration (EIA) Open Data API v2 using series `EMM_EPM0_PTE_NUS_DPG` — the **"All Grades, All Formulations"** national average, not a premium-specific series. There is no per-grade selection today; the system always returns the same all-grades average regardless of the grade the rider actually buys. The original feature spec (010-gas-price-lookup) describes this as "regular unleaded," which is itself inaccurate — the series used is an all-grades blend, not the regular-grade-only series. This explains why the displayed price can feel skewed toward premium-like (higher) values relative to a rider's local regular-grade price.
- Gas prices are cached durably in a SQLite table (`GasPriceLookups`), one row per calendar week (keyed by `WeekStartDate`, the Sunday of the ISO week containing the ride date). Once a row exists for a week, it is **never re-fetched or expired** — the cache is intentionally immutable/permanent by design (see `research.md` Decision 3 for feature 010: "Time-based cache expiry (TTL) — rejected: weekly prices don't change after publication; TTL adds complexity with no benefit").
- **Discrepancy identified**: The request describes the current caching as needing correction to "every 3 days," implying an existing but wrong refresh interval. In fact, there is no refresh interval at all today — cached entries persist forever once written. This feature introduces the first time-based refresh policy for this cache; it is not a fix to a misconfigured existing duration.
- The cache today has no concept of "grade" — the table has one row per week, with a single `PricePerGallon` value and a single `DataSource`. Adding grade selection requires the cache key and stored data to become grade-aware, since regular and premium prices differ and must not overwrite one another.
- Gas price is fetched via `GET /api/rides/gas-price?date=YYYY-MM-DD` and displayed/editable on the ride creation and edit forms; the fetched value is only a pre-filled suggestion the rider can overwrite before saving. Per-user settings (`UserSettingsEntity`) already store rider-specific preferences (e.g., `EiaGasApiKey`, `LocationLabel`) and are exposed via the Settings page — an established pattern for adding a new rider-level preference such as a preferred gas grade.

## Clarifications

### Session 2026-08-27

- Q: What happens to existing pre-feature ungraded cache rows once grade becomes part of the cache key? → A: Leave existing rows as-is (untouched, unmatched by grade-aware queries); they become inert history. First lookup for any historical week+grade after deployment triggers a fresh external call.
- Q: Should the gas-price lookup endpoint derive the grade solely from the rider's saved settings preference, or also accept an optional explicit grade query parameter that overrides the saved preference? → A: Endpoint accepts an optional `grade` query parameter that, if present, overrides the rider's saved preference for that single call (e.g., for previews/testing); when omitted, the rider's saved preference is used.
- Q: For riders who already have a settings row before this feature ships, how should their gas grade preference be established? → A: Migration backfills the new column to "Premium" explicitly for all existing rider settings rows (column is non-nullable), matching the app's current de facto all-grades/premium-like pricing behavior, so existing riders' suggested prices don't silently change at deployment. The "Regular" default (FR-002) applies only to riders who set up their settings after this feature ships and have never made an explicit choice.
- Q: When two concurrent requests both find the same cached (week, grade) entry stale at the same time, how should the refresh be handled, given SC-003 requires no more than one external lookup per (week, grade) per 3-day window? → A: Serialize/de-duplicate concurrent stale-refresh attempts for the same (week, grade) so only one external call is made; other concurrent requests wait for or reuse that in-flight refresh's result.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Preferred Gas Grade (Priority: P1)

A rider who buys regular-grade gasoline currently sees a suggested gas price that reflects an all-grades national average, which runs higher than what they actually pay. The rider wants to set their preferred grade (regular or premium) once, so that every future ride's suggested gas price reflects prices for that grade instead of the current all-grades blend.

**Why this priority**: This is the core complaint driving the feature — without grade selection, the suggested price remains inaccurate for the majority of riders (who buy regular), undermining trust in the auto-filled value and the fuel-cost-savings calculations that depend on it.

**Independent Test**: Can be fully tested by setting a gas grade preference to "Regular" in Settings, then opening the ride creation form and confirming the suggested gas price is fetched using the regular-grade price series (verifiable by inspecting the stored `DataSource`/grade on the resulting cache entry), and separately confirming a "Premium" preference yields a fetched price from the premium-grade series.

**Acceptance Scenarios**:

1. **Given** a rider signs up (or otherwise gets a settings row created) after this feature ships and has not yet set a gas grade preference, **When** they open Settings, **Then** they see a gas grade selector defaulted to "Regular" (the most common grade, and the closest match to typical local pump prices).
1a. **Given** a rider's settings row already existed before this feature shipped, **When** the feature is deployed, **Then** their gas grade preference is backfilled to "Premium" (matching the app's historical all-grades/premium-like pricing behavior) rather than "Regular", so their suggested price does not silently change at deployment; they see this "Premium" value pre-selected in Settings until they change it.
2. **Given** a rider sets their gas grade preference to "Premium" and saves it, **When** they open the ride creation form for any date, **Then** the pre-filled gas price reflects the premium-grade national average price for that date.
3. **Given** a rider previously had rides recorded using one grade's price, **When** they change their gas grade preference, **Then** only future gas price lookups use the new grade — previously recorded rides' stored gas prices are not altered retroactively.
4. **Given** a rider changes their gas grade preference and then reopens a ride form for a date already cached under the old grade, **When** the form loads, **Then** the system fetches (or reuses a cache entry for) the price for the newly selected grade, not the old grade's cached price.

---

### User Story 2 - Gas Price Cache Refreshes Every 3 Days (Priority: P2)

An administrator/operator wants gas price data to stay reasonably current without hammering the external EIA API on every request. Today the cache never refreshes once a week's price is stored. This story introduces a 3-day refresh policy so that cached prices are re-validated periodically while still avoiding redundant external calls for the same short window.

**Why this priority**: Correctness of the caching policy is important but secondary to the grade-selection fix — the cache already "works" in the sense of preventing duplicate calls; this story tightens the freshness guarantee, without which prices could theoretically go stale if the underlying EIA published a revision. It is independently valuable and independently testable regardless of whether grade selection ships.

**Independent Test**: Can be fully tested by seeding a cache entry with a `RetrievedAtUtc` timestamp older than 3 days and confirming the next lookup for that date triggers a fresh external call and updates the cache entry, while seeding an entry retrieved less than 3 days ago confirms the cached value is reused without a new external call.

**Acceptance Scenarios**:

1. **Given** a cached gas price entry (for a given date/week and grade) was retrieved less than 3 days ago, **When** a rider requests the gas price for a covered date, **Then** the cached value is returned and no external API call is made.
2. **Given** a cached gas price entry was retrieved 3 or more days ago, **When** a rider requests the gas price for a covered date, **Then** the system performs a fresh external lookup, and — if the lookup succeeds — replaces the stale cache entry with the new price and a new retrieval timestamp.
3. **Given** a cached entry is stale (3+ days old) and the refresh attempt fails or the external service is unavailable, **When** the rider requests the price, **Then** the system falls back to returning the last known (stale) cached price rather than showing no price, consistent with the existing graceful-degradation behavior for gas price lookups.
4. **Given** the app is restarted, **When** a ride form is opened for a date with a cache entry younger than 3 days, **Then** the cached price is still used (the 3-day freshness window survives restarts, since it is measured from the durable `RetrievedAtUtc` timestamp).

---

### Edge Cases

- What happens if a rider has never set a gas grade preference and the system has no default configured? → The system defaults to "Regular" (see Assumptions).
- What happens if the external EIA API does not have a distinct series for the selected grade for the requested week? → The lookup fails gracefully for that grade the same way an all-grades lookup fails today (no price, no cache write), and the existing manual-entry/fallback behavior applies.
- What happens when two different grades are requested for the same week concurrently? → Each grade is cached independently; a concurrent duplicate request for the same date+grade follows the existing "insert races to a unique constraint, re-read on conflict" pattern already used for the current cache.
- What happens when two concurrent requests both find the same cached (week, grade) entry stale at the same moment? → Stale-refresh attempts for the same (week, grade) are serialized/de-duplicated so only one external call is made; concurrent requesters wait for or reuse that in-flight refresh's result instead of each independently calling the external API, preserving the SC-003 guarantee of at most one external lookup per (week, grade) per 3-day window.
- What happens to gas prices already recorded on existing rides when this feature ships? → They are left untouched; only future lookups are affected by grade selection and the 3-day refresh policy.
- What happens to pre-feature cache rows in the `GasPriceLookups` table that predate the grade column (i.e., ungraded historical rows) once grade becomes part of the cache key? → They are left as-is, untouched and unmatched by any grade-aware query; they become inert history rather than being migrated, deleted, or backfilled with an assumed grade. The first grade-aware lookup for any historical week (regardless of grade) after deployment finds no matching row and triggers a fresh external call, which then creates a new grade-keyed cache entry for that week.
- What happens if a stale cache entry's refresh returns a price for a different grade or an implausible value (e.g., zero or negative)? → The existing validation (reject non-positive prices) applies before overwriting the cache entry; the stale entry is kept if the refreshed value is invalid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Riders MUST be able to set a preferred gas grade — "Regular" or "Premium" — as a personal setting, alongside their other rider-level preferences.
- **FR-002**: The system MUST default a rider's gas grade preference to "Regular" for any rider settings row created after this feature ships, until that rider explicitly changes it.
- **FR-002a**: For rider settings rows that already existed before this feature ships, the deployment migration MUST explicitly backfill the gas grade preference to "Premium" (not "Regular"), reflecting the all-grades/premium-like pricing the app has always shown; the gas grade preference column MUST be non-nullable after migration.
- **FR-003**: When fetching a gas price for a ride date, the system MUST use the rider's currently selected gas grade to determine which price series to request from the external gas price source.
- **FR-004**: The system MUST cache gas prices per distinct combination of price week and gas grade, so that regular and premium prices for the same week are stored and retrieved independently without overwriting one another.
- **FR-004a**: Pre-feature cache rows that predate grade-awareness (created before this feature shipped) MUST be left untouched and MUST NOT be migrated, deleted, or matched by any grade-aware lookup; they remain as inert historical rows. A grade-aware lookup for a week only previously cached without a grade MUST be treated as a cache miss and trigger a fresh external fetch, writing a new grade-keyed entry.
- **FR-005**: Changing a rider's gas grade preference MUST NOT modify gas prices already stored on previously recorded rides; it MUST only affect gas prices fetched for future lookups.
- **FR-006**: The system MUST treat a cached gas price entry as fresh for 3 days from the time it was retrieved, and MUST reuse it without an external call during that window.
- **FR-007**: The system MUST treat a cached gas price entry as stale once 3 days have elapsed since it was retrieved, and MUST attempt a fresh external lookup the next time that date/grade is requested.
- **FR-007a**: When multiple concurrent requests for the same (price week, grade) find the entry stale at the same time, the system MUST serialize or de-duplicate the refresh so only a single external lookup is performed; concurrent requesters MUST wait for or reuse that in-flight refresh's result rather than each independently calling the external source.
- **FR-008**: When a stale cache entry is successfully refreshed, the system MUST replace the stored price and update the retrieval timestamp, while preserving the price history behavior riders and reporting depend on (i.e., prior successfully-recorded ride prices remain unaffected, per FR-005).
- **FR-009**: When a refresh attempt for a stale cache entry fails (external service unavailable or returns no usable data), the system MUST continue to serve the last known cached price rather than returning no price, matching the existing degraded-mode behavior.
- **FR-010**: The system MUST continue to reject non-positive or otherwise invalid fetched prices, discarding them without overwriting an existing valid cache entry.
- **FR-011**: The gas price lookup endpoint and underlying service MUST expose/accept the grade being requested so the correct cached or freshly-fetched price is returned for the rider's selected grade. The endpoint MUST accept an optional `grade` query parameter that, when present, overrides the rider's saved gas grade preference for that single request (e.g., for previews or testing); when the parameter is omitted, the endpoint MUST use the rider's currently saved gas grade preference.

### Key Entities *(include if feature involves data)*

- **Gas Grade Preference**: A rider-level setting indicating which grade ("Regular" or "Premium") should be used for that rider's gas price lookups. Stored alongside existing rider settings (e.g., API keys, location).
- **Gas Price Lookup (Cache Entry)**: Represents a single gas price retrieved for a calendar week and a specific gas grade. Key attributes: price week start date, gas grade, price per gallon (decimal, USD), data source identifier, retrieval timestamp. Distinguishing attribute from the current design: previously one entry existed per week; going forward, one entry exists per (week, grade) pair, and each entry now has a defined freshness window (3 days) rather than being permanently immutable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Riders who select "Regular" as their gas grade see a suggested gas price sourced from the regular-grade price series, distinct from the previous all-grades value, for 100% of new gas price lookups.
- **SC-002**: Riders can change their gas grade preference and see the new grade reflected in the next gas price suggestion within the same session, with no restart or additional action required.
- **SC-003**: No more than one external gas price lookup occurs per unique (price week, grade) combination within any 3-day window, verified across repeated ride-form loads for the same date and grade, including under concurrent requests (concurrent stale-refresh attempts for the same combination are de-duplicated to a single external call, per FR-007a).
- **SC-004**: A cached gas price older than 3 days is refreshed on next use in 100% of cases where the external data source is reachable and returns valid data.
- **SC-005**: When the external data source is unreachable during a refresh attempt, riders still see a previously cached price rather than a blank/unavailable price in 100% of observed cases.
- **SC-006**: Gas prices already stored on rides recorded before this feature ships remain unchanged after the feature is deployed.

## Assumptions

- Riders buy either regular or premium fuel; mid-grade is out of scope for this feature and can be added later following the same pattern if needed.
- "Regular" is a reasonable default grade preference for newly-created rider settings rows because it is the most commonly purchased grade and the closest approximation to typical local pump prices for most riders, addressing the core complaint without requiring upfront configuration. This default does not apply retroactively: riders whose settings row already existed before this feature shipped are migrated to an explicit "Premium" value (see FR-002a) to avoid silently changing their previously-experienced pricing at deployment.
- The external gas price data source (EIA Open Data API) publishes distinct weekly price series for regular and premium grades comparable in structure to the all-grades series currently used; if a directly equivalent series is unavailable, the closest available regular/premium series is used.
- "Cache every 3 days" is interpreted as a freshness/refresh window measured from each entry's retrieval timestamp (i.e., an entry is reused for up to 3 days, then eligible for refresh on next access), consistent with how the existing cache is read (lazy, on-demand) rather than via a scheduled background job.
- The 3-day freshness window applies uniformly regardless of gas grade.
- This feature does not change the existing behavior that a manually entered gas price on a ride form always overrides the fetched/cached suggestion when the rider submits the form.
