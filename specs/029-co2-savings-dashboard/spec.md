# Feature Specification: CO2 Savings on Advanced Dashboard

**Feature Branch**: `029-co2-savings-dashboard`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Add a Carbon (CO2) saved value to the advanced dashboard's overall/yearly saved section, for the current year chosen on the dashboard. This should be calculated on demand (not stored/precomputed). Also show the CO2 saved per mile so the user can understand their per-mile environmental impact."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Total CO2 Saved for the Current Year (Priority: P1)

A bike commuter viewing the advanced dashboard wants to know the environmental benefit of their riding, not just the financial one. When they view the yearly savings window (for the year currently selected on the dashboard), they see a total CO2 saved value alongside the existing gas, money, and mileage-rate savings figures.

**Why this priority**: This is the core feature request. Without a visible CO2 total, users have no way to understand the environmental impact of their riding, which is the primary goal of this feature.

**Independent Test**: Can be fully tested by navigating to the advanced dashboard with ride history for the selected year and verifying the yearly window displays a CO2 saved value computed from that year's total miles.

**Acceptance Scenarios**:

1. **Given** a user has completed rides within the currently selected year, **When** they view the yearly savings window on the advanced dashboard, **Then** they see a "CO2 Saved" value representing the estimated mass of CO2 emissions avoided by biking those miles instead of driving.
2. **Given** the user changes the selected year on the dashboard, **When** the yearly window recalculates, **Then** the CO2 saved value updates to reflect only rides within the newly selected year.
3. **Given** the user has no rides in the currently selected year, **When** they view the yearly window, **Then** the CO2 saved value displays as zero rather than an error or blank cell.
4. **Given** the weekly, monthly, and all-time windows are also displayed, **When** the user views them, **Then** each window also shows its own CO2 saved value calculated the same way over its own miles, consistent with how other savings metrics are already broken out per window.

---

### User Story 2 - View CO2 Saved Per Mile (Priority: P1)

The user wants to understand their per-mile environmental impact, not just a cumulative total, so they can relate the metric to individual rides and compare it against different driving assumptions.

**Why this priority**: Equally core to the request — the per-mile figure is what makes the total meaningful and educational, and it is explicitly called out as a required part of this feature.

**Independent Test**: Can be tested independently by verifying that a fixed "CO2 saved per mile" figure (or value derived from the same emission factor used for the totals) is displayed near the total CO2 saved figures, and that multiplying it by a window's total miles reproduces that window's total CO2 saved value.

**Acceptance Scenarios**:

1. **Given** the advanced dashboard is displaying savings windows, **When** the user views the CO2 section, **Then** they see a per-mile CO2 saved value (e.g., "0.90 lb CO2/mile") displayed alongside the total CO2 saved figures.
2. **Given** the per-mile value and a window's total miles, **When** the values are compared, **Then** total CO2 saved for that window equals the per-mile value multiplied by the window's total miles (within rounding).
3. **Given** the user has no rides at all, **When** they view the CO2 per-mile value, **Then** it still displays the fixed per-mile factor (since it does not depend on ride count), while totals show as zero.

---

### Edge Cases

- What happens when a user has no rides in the selected year? (CO2 saved for that window shows as zero, not blank or error.)
- How does the system handle partial years (e.g., a year that just started)? (CO2 is calculated only from miles actually ridden within that year to date; no error or NaN.)
- What if ride distance data is missing or zero for all rides in a window? (CO2 saved is zero for that window.)
- Does the CO2 calculation depend on user-configured MPG or vehicle type? (No — CO2 saved uses a fixed average-vehicle emission factor per mile, independent of the user's MPG setting, since MPG only affects fuel-cost estimates, not emissions estimates in this feature's scope.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate, on demand (not stored or precomputed), the total CO2 mass saved for each existing savings window (weekly, monthly, yearly, all-time) based on that window's total ride miles and a fixed average-vehicle CO2-per-mile emission factor.
- **FR-002**: System MUST display the CO2 saved total for the yearly window, reflecting rides within the year currently selected on the dashboard, in the overall/yearly saved section alongside existing metrics (gallons saved, fuel cost avoided, mileage-rate savings, expenses, oil-change savings, net savings).
- **FR-003**: System MUST also display CO2 saved for the weekly, monthly, and all-time windows, consistent with how other savings metrics are already broken out per window.
- **FR-004**: System MUST display a CO2 saved per-mile value so users can understand their per-mile environmental impact, using the same fixed emission factor used to compute the totals.
- **FR-005**: System MUST recalculate CO2 saved values whenever the selected year (or underlying ride data) changes, without persisting the computed CO2 value to storage.
- **FR-006**: System MUST return a CO2 saved value of zero (not null, error, or NaN) for any window with zero qualifying ride miles.
- **FR-007**: System MUST NOT vary the CO2-per-mile emission factor based on user-configured MPG or vehicle settings; the factor MUST be a fixed constant representing average-vehicle emissions.
- **FR-008**: System MUST express the CO2 saved values with a clearly labeled unit (e.g., pounds or kilograms of CO2) both for totals and for the per-mile figure.

### Key Entities

- **CO2 Savings Window Metric**: A derived, request-time-only value representing the estimated mass of CO2 emissions avoided for a given savings window (weekly, monthly, yearly, all-time), computed as `windowTotalMiles * co2PerMileFactor`. Not persisted.
- **CO2 Per-Mile Factor**: A fixed constant (mass of CO2 per mile) representing the average passenger-vehicle emissions avoided by biking one mile instead of driving it. Used to compute all window totals and displayed directly to the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of advanced dashboard views for a year with recorded rides display a non-blank, non-error CO2 saved value in the yearly window.
- **SC-002**: Users can identify their CO2 saved per mile within 5 seconds of viewing the advanced dashboard's savings section, without needing to compute it manually.
- **SC-003**: For every savings window, CO2 saved total equals (within rounding) the displayed per-mile factor multiplied by that window's total miles, verified in 100% of automated test cases.
- **SC-004**: 0 instances of CO2 saved values are found stored in the database or cached between requests; the value is recomputed on every dashboard load.

## Assumptions

- A fixed, documented CO2-per-mile emission factor (e.g., based on published average passenger-vehicle emissions per mile) is an acceptable approximation; per-user vehicle-specific emissions are out of scope for this feature.
- The CO2 metric reuses the same window/period boundaries (weekly, monthly, yearly-selected, all-time) already established by the existing advanced dashboard savings feature.
- "Currently selected year" refers to the year selector already present on the advanced dashboard for the yearly window; this feature does not introduce a new year selector.
- Units for display (pounds vs. kilograms of CO2) will follow the same locale/unit convention as the rest of the dashboard (assumed US customary units, i.e., pounds, consistent with miles/gallons already used).
- No new backend persistence, migration, or storage schema is needed since the value is always computed on demand from existing ride mileage data.
