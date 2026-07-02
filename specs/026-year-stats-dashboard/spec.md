# Feature Specification: Year Stats Dashboard

**Feature Branch**: `026-year-stats-dashboard`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "I want to view a stats dashboard with many of the same charts for the year that I choose. Make this a new page, reuse existing graphs by moving them into components (pass the year into the component)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View stats for a chosen year (Priority: P1)

As a rider, I want to open a dedicated stats page, pick a specific year, and see the same kinds of charts I already trust from the main dashboard (mileage trend, savings breakdown, difficulty/wind analytics), but scoped to that single year, so I can review or compare my riding history year over year.

**Why this priority**: This is the core value of the feature — without year selection and year-scoped charts, there is no new capability to deliver.

**Independent Test**: Can be fully tested by navigating to the new stats dashboard page, selecting a year from a list of years that have ride data, and confirming all charts render data limited to that year only.

**Acceptance Scenarios**:

1. **Given** I have ride data spanning multiple years, **When** I open the year stats dashboard page, **Then** it defaults to showing the current year (or the most recent year with data if the current year has none) and renders the standard set of charts scoped to that year.
2. **Given** I am viewing the year stats dashboard, **When** I select a different year from the year selector, **Then** all charts on the page update to reflect data for the newly selected year only, without navigating away from the page.
3. **Given** a year has no ride data at all, **When** I select that year, **Then** each chart displays a clear "no data for this year" state instead of an error or blank chart.

---

### User Story 2 - Reuse existing chart components across pages (Priority: P2)

As a developer/maintainer, I want the charts already shown on the main dashboard (and advanced dashboard) to be implemented as standalone, year-parameterized components, so the same chart logic can be reused on the new year stats dashboard without duplicating code.

**Why this priority**: This is what makes the feature maintainable and keeps the two dashboards visually/behaviorally consistent, but the end user primarily cares about User Story 1; this story is the enabling refactor.

**Independent Test**: Can be tested by verifying the main dashboard still renders identically (same charts, same rolling-window behavior) after the refactor, and that the new year stats dashboard renders using the same underlying chart components with a `year` input.

**Acceptance Scenarios**:

1. **Given** the main dashboard currently shows a rolling 12-month mileage trend and a rolling 12-month savings chart, **When** the refactor is complete, **Then** the main dashboard's behavior and appearance are unchanged (still rolling-window, not year-scoped).
2. **Given** the year stats dashboard passes a specific year into the mileage trend and savings chart components, **When** those components render, **Then** they display exactly the 12 months (Jan–Dec) of the selected year rather than a rolling window.
3. **Given** the difficulty and wind-resistance analytics charts exist on the advanced dashboard, **When** they are moved into reusable components, **Then** the year stats dashboard can also display year-scoped versions of these charts using the same components.

---

### User Story 3 - Navigate to the year stats dashboard (Priority: P3)

As a rider, I want to find and open the year stats dashboard from the app's navigation, so I don't need to know a direct URL to access it.

**Why this priority**: Discoverability matters but the page is usable via direct link/testing even before nav wiring is done; it's a smaller polish item.

**Independent Test**: Can be tested by checking that a link/menu entry to the year stats dashboard exists in the app's navigation and that clicking it opens the new page.

**Acceptance Scenarios**:

1. **Given** I am on any authenticated page, **When** I open the app's navigation menu, **Then** I see an entry for the year stats dashboard alongside the existing dashboard and advanced dashboard links.
2. **Given** I click the year stats dashboard nav entry, **When** the page loads, **Then** I land on the year stats dashboard with a year already selected and charts rendered.

### Edge Cases

- What happens when the selected year is the current, in-progress year (fewer than 12 months of data)? Charts should show only the months that have elapsed/have data, not project or fake future months.
- How does the system handle a year selection for a year before the user's account existed or before any rides were logged? Show the "no data for this year" state described in User Story 1.
- What happens if ride settings (e.g., mileage rate, MPG) changed partway through the selected year? Charts must use the same historical ride-setting snapshot rules already used elsewhere in the app, so savings figures for past years remain accurate regardless of later setting changes.
- What year range should the selector offer? Only years for which the user has at least one ride recorded (or the current year, if the user has no rides yet), so the user never picks an empty year unintentionally.
- What happens if the user has rides in only one year? The year selector should still function but effectively offer a single choice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a new, dedicated "Year Stats Dashboard" page, reachable from the app's primary navigation.
- **FR-002**: The Year Stats Dashboard MUST include a year selector control that lists selectable years, limited to years in which the user has at least one recorded ride (plus the current year as a fallback default when no rides exist).
- **FR-003**: When a year is selected, the Year Stats Dashboard MUST display the same categories of charts currently available on the existing dashboards (mileage trend, savings breakdown, and difficulty/wind analytics), scoped to only that year's data.
- **FR-004**: The existing mileage trend, savings breakdown, and difficulty/wind analytics charts MUST be refactored into standalone, reusable components that accept a year (or equivalent date-range) as an input parameter.
- **FR-005**: The refactored chart components MUST continue to support the main dashboard's existing rolling-window (non-year-scoped) behavior with no visible change to current dashboard users.
- **FR-006**: The Year Stats Dashboard MUST use the same historical ride-setting snapshot rules as the existing dashboards, so savings and cost figures for past years reflect the settings in effect at that time, not current settings.
- **FR-007**: When the selected year has no ride data, each chart on the Year Stats Dashboard MUST show an explicit empty/no-data state rather than an error or a misleading blank chart.
- **FR-008**: The Year Stats Dashboard MUST default to the current year on first load, falling back to the most recent year containing ride data if the current year has none.
- **FR-009**: Changing the selected year MUST update all charts on the page in place, without a full page reload or navigation.

### Key Entities

- **Ride**: An existing entity representing a single logged bike ride, including its date, distance, duration, and related metrics; used to compute all charts, filtered by year.
- **Ride Setting Snapshot**: An existing historical record of settings (e.g., mileage rate, MPG) in effect at the time of a ride; used to keep savings calculations for past years accurate.
- **Selected Year**: The year currently chosen by the user on the Year Stats Dashboard; drives which subset of ride data is passed into each chart component.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch the displayed year and see all charts update to that year's data in under 2 seconds.
- **SC-002**: 100% of chart types available on the existing dashboards are also available in year-scoped form on the Year Stats Dashboard.
- **SC-003**: The main dashboard's existing charts show no behavioral or visual regression after the component refactor, verified by side-by-side comparison before and after the change.
- **SC-004**: Users can locate and open the Year Stats Dashboard from the app's navigation without any external instructions, on their first attempt.

## Assumptions

- The Year Stats Dashboard is available to any authenticated user who can already access the main dashboard; no new permission tier is introduced.
- "Charts" in scope for this feature are the mileage trend chart, the savings breakdown chart, and the difficulty/wind-resistance analytics charts currently found on the main and advanced dashboards; summary cards and status panels (non-chart widgets) are out of scope for year-scoping unless trivially reused.
- The year selector offers whole calendar years (Jan–Dec) as the unit of comparison, consistent with how "yearly" windows are already used elsewhere in the app (e.g., advanced dashboard's yearly breakdown).
- Data volume per user is small enough that filtering a full year of rides client-side or via existing APIs will not introduce meaningful performance concerns beyond the 2-second target in SC-001.
- No new backend data is required; the feature reuses existing ride and ride-setting-snapshot data already available to the current dashboards.
