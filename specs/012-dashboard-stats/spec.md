# Feature Specification: Rider Dashboard Statistics

**Feature Branch**: `012-dashboard-stats`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "Use the user settings to calculate statistics to show the user in a dashboard with nice charts and graphs. Include miles for the current month, total miles for the year, total miles, money saved (mileage and mpg), average temp, average, and suggest other options, but ask me first. Make the Dashboard is the main page, currently called miles. User settings that can change should be added to the events so we keep the accurate. Use graphs from ShadCn."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View core dashboard statistics (Priority: P1)

As a rider, I want the main page after login to show my key riding totals, averages, and trends so I can immediately understand my current progress without opening ride history.

**Why this priority**: This is the primary user value. The dashboard only succeeds if riders can quickly see their most important commute statistics at a glance.

**Independent Test**: Can be fully tested by signing in as a rider with ride history and confirming the main page shows current-month miles, year-to-date miles, all-time miles, money-saved values, average temperature, average miles per ride, average ride duration, and supporting charts based on that rider's saved rides.

**Acceptance Scenarios**:

1. **Given** an authenticated rider with recorded rides, **When** they open the main page, **Then** they see a dashboard with current-month miles, year-to-date miles, and all-time miles for their own rides.
2. **Given** an authenticated rider with ride records that include weather, distance, duration, and fuel-related data, **When** they view the dashboard, **Then** they see money-saved, average-temperature, average-miles-per-ride, and average-ride-duration statistics calculated from their saved ride data and settings snapshots.
3. **Given** an authenticated rider with at least several rides across time, **When** they view the dashboard, **Then** they see charts that visualize trends rather than only raw totals.

---

### User Story 2 - Keep historical calculations accurate when settings change (Priority: P2)

As a rider, I want dashboard savings and progress calculations to remain historically accurate after I change my settings so previously recorded rides do not silently change meaning later.

**Why this priority**: The dashboard becomes misleading if savings are recalculated against today's settings instead of the assumptions in effect when each ride was recorded or edited.

**Independent Test**: Can be fully tested by recording rides, changing rider settings that affect calculations, recording another ride, and confirming the dashboard preserves prior ride calculations using the earlier snapshot while newer rides use the updated values.

**Acceptance Scenarios**:

1. **Given** a rider records a ride while one set of calculation settings is active, **When** those settings are changed later, **Then** the dashboard still uses the original settings snapshot for the earlier ride.
2. **Given** a rider edits an existing ride after changing settings, **When** the ride is resaved, **Then** the dashboard uses the settings snapshot saved with that edited ride version.
3. **Given** a rider has older rides created before settings snapshots were available, **When** the dashboard is loaded, **Then** those rides remain visible and any unavailable calculation-based values are handled without breaking the dashboard.

---

### User Story 3 - Review optional metrics before adding them (Priority: P3)

As a rider, I want the app to suggest additional dashboard metrics before they are shown so I can decide which extra insights are worth including beyond the core statistics.

**Why this priority**: The request explicitly calls for suggestions first, which means the initial dashboard scope must separate required metrics from optional follow-on metrics.

**Independent Test**: Can be fully tested by opening the dashboard configuration or suggestion flow, reviewing the proposed additional metrics, and confirming only approved optional metrics appear afterward.

**Acceptance Scenarios**:

1. **Given** the rider has access to the dashboard, **When** optional metric suggestions are presented, **Then** the rider can review proposed additions before they are enabled.
2. **Given** the rider has not approved optional metrics yet, **When** they view the dashboard, **Then** only the required baseline metrics are shown.

### Edge Cases

- A rider has no recorded rides yet; the dashboard still loads and clearly shows empty-state totals and charts.
- A rider has rides but no saved MPG or mileage-rate values; miles-based metrics still render while savings metrics explain that required assumptions are missing.
- A rider has rides with some missing temperature or gas-price data; averages and savings are calculated only from rides with the required data and do not block the page.
- A rider changes settings mid-month or mid-year; historical statistics remain stable for older rides while newer rides use the new snapshots.
- A rider's earlier rides predate settings snapshots; the dashboard distinguishes unavailable historical savings from zero savings.
- A rider has only one ride or all rides in one month; charts still render meaningful output without visual errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST make the rider dashboard the primary authenticated landing page in place of the current miles landing page.
- **FR-002**: The dashboard MUST display the rider's current-month miles, year-to-date miles, and all-time miles using only that rider's saved ride records.
- **FR-003**: The dashboard MUST display the rider's estimated money saved from riding using the per-ride distance together with the rider settings snapshots needed for mileage-rate and fuel-economy calculations.
- **FR-004**: The dashboard MUST display the rider's average temperature based on rides that contain saved temperature data.
- **FR-004a**: The dashboard MUST display the rider's average miles per ride based on saved ride distance data.
- **FR-004b**: The dashboard MUST display the rider's average ride duration based on rides that contain saved duration data.
- **FR-005**: The dashboard MUST display at least one trend-oriented chart for ride mileage over time and at least one chart for savings or ride conditions over time.
- **FR-006**: The dashboard MUST continue to show miles-based metrics even when some rides are missing the settings or lookup data required for savings and weather-based calculations.
- **FR-007**: The dashboard MUST clearly distinguish between a value of zero and a value that cannot be calculated because required data is missing.
- **FR-008**: When a ride is created or edited, the system MUST store a snapshot of every rider setting required for dashboard calculations with that ride's event data so later settings changes do not recalculate historical rides incorrectly.
- **FR-009**: Settings snapshots used for dashboard calculations MUST include, at minimum, the rider values needed for fuel-economy-based savings, mileage-rate-based savings, and goal/progress calculations.
- **FR-010**: When dashboard calculations use ride-level snapshots, the system MUST prefer the snapshot saved with the ride over the rider's current settings.
- **FR-011**: For rides that do not yet contain the required snapshot data, the dashboard MUST still load and MUST apply a defined fallback behavior that does not misstate historical values.
- **FR-012**: The dashboard MUST be visually organized around summary cards and charts so riders can understand totals and trends without navigating to a different page.
- **FR-013**: The system MUST present additional dashboard metric suggestions to the rider before any non-core optional metrics are enabled.
- **FR-014**: The baseline dashboard MUST include only the explicitly requested core metrics until the rider approves additional suggested metrics.
- **FR-015**: The baseline dashboard MUST include both average miles per ride and average ride duration alongside average temperature.
- **FR-016**: The first set of optional metric suggestions MUST be estimated gallons avoided and goal progress.

### Key Entities *(include if feature involves data)*

- **Dashboard Summary**: A rider-specific view of headline statistics for current month, current year, and all time, including totals, calculated savings, averages, and trend outputs.
- **Ride Calculation Snapshot**: The set of rider assumptions saved with each created or edited ride that preserves the values needed for future dashboard calculations even after settings change.
- **Optional Metric Suggestion**: A proposed dashboard insight not included in the core default set until the rider reviews and approves it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of authenticated riders who have at least one saved ride can open the main page and see current-month, year-to-date, and all-time mileage totals without navigating elsewhere.
- **SC-002**: 100% of rides created or edited after this feature is introduced carry the calculation snapshot data required for future dashboard accuracy.
- **SC-003**: When rider settings change, previously displayed savings values for older rides remain stable in repeated dashboard checks unless the ride itself is edited.
- **SC-004**: At least 90% of riders in acceptance testing can identify their current month mileage, yearly mileage, all-time mileage, and savings totals within 10 seconds of landing on the dashboard.
- **SC-005**: The dashboard remains usable for 100% of riders whose history contains partial weather, fuel-price, or settings data; missing data degrades only the affected metrics, not the whole page.

## Assumptions

- Savings are calculated from data already stored with rides plus the rider settings snapshots captured at ride create or ride edit time.
- Core requested metrics are current-month miles, year-to-date miles, all-time miles, mileage-rate savings, fuel-economy savings, average temperature, average miles per ride, and average ride duration.
- The existing dashboard route and navigation may be renamed or redirected as needed, but riders should experience the dashboard as the default signed-in home page.
- Historical rides that predate snapshot support do not need to be silently rewritten; instead, the dashboard should use a safe fallback and avoid presenting ungrounded values as exact.
- Optional metrics are intentionally separated from the core dashboard because the rider requested to be asked before those extras are included; the first suggestions will be estimated gallons avoided and goal progress.

## Dependencies

- Existing ride history data remains the source for mileage totals.
- Saved ride weather and fuel-price fields remain available for temperature and savings-related calculations.
- Rider settings continue to expose the values needed for savings and progress calculations so they can be captured into ride snapshots at save time.
