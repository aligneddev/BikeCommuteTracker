# Feature Specification: Riding Time Totals

**Feature Branch**: `031-ride-time-stats`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "As a user, I want to see how many hours and minutes I've recorded riding on the dashboard, advanced dashboard overall and the yearly stats"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See total riding time on the main dashboard (Priority: P1)

As a rider, I want the main dashboard to show the total amount of time (hours and minutes) I've spent riding across all my recorded rides, so I can see the cumulative time commitment of my commute habit at a glance, alongside the mileage and savings totals I already see there.

**Why this priority**: The main dashboard is the first thing a rider sees after login and already anchors the other all-time totals (miles, money saved). Riding time is the highest-value, most-visible surface for this feature.

**Independent Test**: Can be fully tested by signing in as a rider with recorded rides that include duration, and confirming the main dashboard shows a total riding time figure in hours and minutes that matches the sum of the rider's own recorded ride durations.

**Acceptance Scenarios**:

1. **Given** an authenticated rider with several rides that each have a recorded duration, **When** they open the main dashboard, **Then** they see a total riding time stat expressed in hours and minutes (e.g., "42h 15m") equal to the sum of those durations.
2. **Given** an authenticated rider with no recorded rides, **When** they open the main dashboard, **Then** the riding time stat shows a zero/placeholder state rather than an error.
3. **Given** an authenticated rider whose rides include some without a recorded duration, **When** they view the total riding time, **Then** the total reflects only the rides that have a recorded duration, and the dashboard's existing missing-data indicator continues to flag that some rides are missing duration.

---

### User Story 2 - See overall riding time on the advanced dashboard (Priority: P2)

As a rider, I want the advanced dashboard's overall (all-time) summary to also show my total riding time, so the deeper savings/analytics view is as complete a picture of my riding history as the main dashboard.

**Why this priority**: The advanced dashboard is the secondary, more detailed destination riders visit after the main dashboard. Adding the same total there completes the feature but is less critical than the primary dashboard surface.

**Independent Test**: Can be fully tested by navigating to the advanced dashboard and confirming the overall (all-time) summary includes a total riding time figure in hours and minutes matching the sum of the rider's recorded ride durations.

**Acceptance Scenarios**:

1. **Given** an authenticated rider with recorded rides that include duration, **When** they open the advanced dashboard, **Then** the overall (all-time) summary shows total riding time in hours and minutes.
2. **Given** an authenticated rider with no recorded rides, **When** they open the advanced dashboard, **Then** the overall riding time shows a zero/placeholder state consistent with the dashboard's other zero-state metrics.

---

### User Story 3 - See riding time for a chosen year (Priority: P3)

As a rider, I want the yearly stats dashboard to show total riding time for whichever year I've selected, so I can compare how much time I spent riding in different years.

**Why this priority**: This extends the same stat to a year-scoped view already used for other totals (mileage, savings). It depends on the underlying time-total calculation built for User Story 1, so it is lowest priority to implement but still part of the requested feature.

**Independent Test**: Can be fully tested by opening the yearly stats dashboard, selecting a year with recorded rides, and confirming the displayed total riding time equals the sum of durations for rides within that calendar year only; selecting a different year updates the total accordingly.

**Acceptance Scenarios**:

1. **Given** a rider has ride data spanning multiple years, **When** they view the yearly stats dashboard for a specific year, **Then** the total riding time shown reflects only rides dated within that calendar year.
2. **Given** a rider selects a year with no ride data, **When** the yearly stats dashboard loads, **Then** total riding time is displayed using the page's existing "no data for this year" treatment rather than an error or blank value.
3. **Given** a rider switches the selected year, **When** the new year loads, **Then** the total riding time updates to match the newly selected year without navigating away from the page.

---

### Edge Cases

- What happens when a rider has recorded rides but none of them have a duration entered? The total riding time shows a zero/placeholder state, consistent with how other dashboard metrics behave when their underlying data is missing, rather than an error.
- How does the system handle a very large cumulative total (e.g., over 1,000 hours)? The hours portion grows without an upper bound and remains readable (e.g., "1,042h 30m").
- How is partial data (some rides with duration, some without) communicated to the rider? The total only sums rides with a recorded duration, and the existing "missing duration" indicator on the main dashboard continues to signal that the total may be incomplete.
- What happens on the yearly stats page for a year with rides but none carrying a duration? The year's total riding time shows as zero for that year, not as "no data," since ride records do exist for that year.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The main dashboard MUST display a total riding time stat, expressed in hours and minutes, summed across all of the rider's own rides that have a recorded duration.
- **FR-002**: The advanced dashboard's overall (all-time) summary MUST display a total riding time stat, expressed in hours and minutes, using the same all-time scope as the dashboard's other overall totals.
- **FR-003**: The yearly stats dashboard MUST display a total riding time stat, expressed in hours and minutes, scoped to whichever calendar year is currently selected, and MUST update when the selected year changes.
- **FR-004**: Total riding time calculations MUST only include rides that have a recorded duration; rides without a recorded duration MUST be excluded from the sum rather than treated as zero-duration.
- **FR-005**: When a rider has no rides, or no rides with a recorded duration, within the relevant scope (all-time or selected year), the total riding time MUST display a zero or "no data" state consistent with that dashboard's existing treatment for other metrics, rather than an error.
- **FR-006**: Total riding time MUST be displayed as whole hours and minutes (e.g., "42h 15m"), not as a decimal number of hours.
- **FR-007**: Total riding time MUST only be calculated from the authenticated rider's own ride data.

### Key Entities

- **Ride**: Existing record of a single commute, which already stores an optional recorded duration; this feature sums that existing duration data per display scope (all-time or selected year) rather than introducing new stored data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider can see their total all-time riding time on the main dashboard without navigating to any other page.
- **SC-002**: The total riding time shown on the main dashboard, the advanced dashboard's overall summary, and the yearly stats page for a given year each independently equal the sum of that rider's qualifying ride durations for that scope, verifiable by comparison against ride history.
- **SC-003**: Riders with no duration data see a clear zero/placeholder state for riding time on all three surfaces, with no errors or broken displays.
- **SC-004**: Changing the selected year on the yearly stats dashboard updates the displayed total riding time to match the newly selected year in the same interaction used for the page's other year-scoped stats.

## Assumptions

- "Advanced dashboard overall" refers to the advanced dashboard's existing all-time summary, not each of its four time-window breakdowns (weekly/monthly/yearly/all-time); only the all-time figure is in scope for this feature.
- Total riding time is a simple sum of recorded ride durations and does not require a new historical "snapshot" mechanism, since duration is a fixed, already-recorded fact about a ride rather than a value computed from settings that can change over time.
- Hours and minutes format (e.g., "42h 15m") is the desired display format, matching how the feature was described, rather than decimal hours (e.g., "42.25 hours").
- Rides missing a recorded duration are excluded from the sum rather than counted as zero; this is consistent with how the main dashboard already flags rides missing duration as incomplete data.
