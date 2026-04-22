# Feature Specification: Advanced Statistics Dashboard

**Feature Branch**: `018-advanced-dashboard`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: Add a more in-depth dashboard to show more statistics: show gas gallons saved, money saved, show rate and based on gas mpg saved, make other suggestions, we'll add more in the future. Add a link to it from the dashboard

## Clarifications

### Session 2026-04-22

- Q: What default vehicle MPG should be used when not configured, and how should users be informed? → A: Default to 20 MPG and show a dashboard card reminder when MPG is not set in settings.
- Q: Which gas price fallback rule should be used for money-saved calculations? → A: Use ride-date gas price when available; otherwise use latest known gas price and mark the value as estimated.
- Q: Which time windows should savings-rate metrics support? → A: Show weekly, monthly, yearly, and all-time rates.
- Q: What suggestions scope should the MVP include? → A: Include 3 deterministic rule-based suggestions: consistency, milestone, and comeback.
- Q: Where should navigation to Advanced Dashboard be placed on the main dashboard? → A: Provide both a primary card action in the stats area and a top navigation item.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Aggregate Fuel and Cost Savings (Priority: P1)

A committed bike commuter wants to see quantifiable benefits from their biking habit. They open the advanced dashboard to see cumulative statistics showing how much gas they didn't buy and how much money they've saved by biking instead of driving.

**Why this priority**: This is the core value proposition—users bike to save money and reduce environmental impact. Without seeing these metrics, they have no motivation to return to the dashboard. P1 because it's the primary feature request.

**Independent Test**: Can be fully tested by navigating to the advanced dashboard and verifying that displayed metrics (gallons saved, money saved) are correctly calculated from ride history and reflect current data. Delivers immediate user satisfaction and engagement.

**Acceptance Scenarios**:

1. **Given** a user has completed multiple bike rides, **When** they visit the advanced dashboard, **Then** they see:
   - Total gas gallons saved (calculated from cumulative distance and average vehicle MPG)
   - Total money saved (calculated from cumulative distance and ride-date gas prices when available, otherwise latest known gas price)
   - Total mileage-rate savings (calculated from cumulative distance and the user's configured mileage rate setting)
   - All savings values should be calculated for the entire ride history

2. **Given** the user has no rides recorded, **When** they visit the advanced dashboard, **Then** they see zero values or placeholders indicating no data available

3. **Given** gas prices have changed since the user started tracking, **When** they view the dashboard, **Then** savings calculations use ride-date gas prices where available and fall back to latest known gas price for missing historical values

4. **Given** the user has not configured MPG in settings, **When** they view the advanced dashboard, **Then** calculations use the 20 MPG default and a reminder card prompts them to set their MPG for more accurate results

5. **Given** the user has not configured a mileage rate setting, **When** they view the advanced dashboard, **Then** mileage-rate savings display as not available and a reminder card prompts them to set a mileage rate in settings

---

### User Story 2 - View Savings Rate Metrics (Priority: P1)

The user wants to understand how their biking effort translates into ongoing savings impact. They see metrics showing their savings rates across weekly, monthly, yearly, and all-time windows to better understand both short-term trends and long-term value.

**Why this priority**: P1 because it complements the aggregate metrics in Story 1 and provides context for habitformation—users can see their average impact per ride or time period, which motivates consistency.

**Independent Test**: Can be tested independently by verifying rate calculations are correct based on ride data and time periods. Can be deployed without other features and still provide value.

**Acceptance Scenarios**:

1. **Given** a user has multiple rides over several weeks, **When** they view the advanced dashboard, **Then** they see:
   - Savings rate metrics for weekly, monthly, yearly, and all-time windows
   - Money saved (gas-price method), mileage-rate savings, and gallons saved values for each window
   - Timespan statistics (e.g., "All-time savings tracked over X days")

2. **Given** rides were completed at different times, **When** viewing the dashboard, **Then** calculations correctly handle partial months or weeks without dividing by zero or showing NaN

---

### User Story 3 - See Personalized Sustainability Suggestions (Priority: P2)

Based on their riding patterns and calculated savings, the user receives contextual suggestions to enhance their biking impact (e.g., "You could save an additional $50/month by biking on Thursdays when gas prices peak"). These suggestions are extensible for future enhancement.

**Why this priority**: P2 because while valuable for long-term engagement, it's not critical for the MVP. Suggestions are a "nice-to-have" that improves UX but doesn't block core functionality. Marked as P2 to allow iterative enhancement.

**Independent Test**: Can be tested by verifying that suggestion logic correctly generates relevant suggestions based on ride data patterns. Suggestions can be added incrementally without affecting Stories 1 or 2.

**Acceptance Scenarios**:

1. **Given** a user has consistent ride history, **When** they view the advanced dashboard, **Then** they see a "Suggestions" section containing contextual recommendations

2. **Given** the user hasn't ridden recently, **When** viewing suggestions, **Then** suggestions are encouraging rather than guilt-inducing (e.g., "Bike just one more day this week to reach X savings milestone")

3. **Given** a user is viewing suggestions in MVP scope, **When** suggestions are generated, **Then** they are limited to three deterministic rule-based types: consistency, milestone, and comeback

---

### User Story 4 - Navigate to Advanced Dashboard from Main Dashboard (Priority: P1)

The user is on the main dashboard and wants to drill down into more detailed statistics. They can access the advanced dashboard from both a primary card action in the stats area and a top navigation item, without losing session state.

**Why this priority**: P1 because without navigation, users won't discover this feature. Easy discoverability is essential for adoption.

**Independent Test**: Can be tested by verifying the link is present on the main dashboard and that clicking it navigates to the advanced dashboard while preserving authentication and data state.

**Acceptance Scenarios**:

1. **Given** a user is logged in and viewing the main dashboard, **When** they look at the dashboard, **Then** they see a prominent link or button to access the advanced statistics

2. **Given** a user is logged in and viewing the main dashboard, **When** they look at the top navigation, **Then** they see an "Advanced Stats" navigation item

3. **Given** the user clicks either navigation entry to advanced statistics, **When** the navigation completes, **Then** they are taken to the advanced dashboard and remain authenticated

4. **Given** the user navigates back from the advanced dashboard, **When** they return to the main dashboard, **Then** the main dashboard retains its state (no unnecessary reloads)

---

### User Story 5 - View Net Savings After Expenses (Priority: P1)

The user wants to know their true financial picture from biking — not just gross savings, but net savings after deducting the real costs of bike ownership (maintenance, parts, etc.). They see expenses broken down by the same time windows as their savings, plus a net savings figure that shows whether they're truly ahead financially.

**Why this priority**: P1 because expense tracking already exists in the app; showing expenses alongside savings gives users the full financial story and is the primary value of the combined view. Without this, users could believe they are saving money when they are actually behind.

**Independent Test**: Can be tested by recording expenses and verifying they appear in the correct time windows on the advanced dashboard, and that net savings = combined savings + oil-change savings offset − total expenses.

**Acceptance Scenarios**:

1. **Given** a user has bike expenses recorded, **When** they view the advanced dashboard, **Then** each time window (weekly, monthly, yearly, all-time) shows:
   - Total expenses (sum of manual expense amounts dated within that window)
   - Oil-change savings offset for that window (if OilChangePrice is configured in settings)
   - Net savings = (FuelCostAvoided + MileageRateSavings + OilChangeSavings) − TotalExpenses

2. **Given** a user has more expenses than savings in a window, **When** they view that window, **Then** net savings is shown as a negative value highlighted in red

3. **Given** a user has no expenses recorded, **When** they view the advanced dashboard, **Then** expenses columns show $0.00 and net savings equals combined savings

4. **Given** the user has not set an OilChangePrice in settings, **When** they view the advanced dashboard, **Then** OilChangeSavings shows as not available (—) and net savings is computed from combined savings minus expenses only

5. **Given** a user views the weekly window, **When** expenses are shown, **Then** only expenses with an ExpenseDate within the current calendar week are included (consistent with how rides are windowed)

---



- What happens when a user has rides but no ride-date gas price data is available? (System should fall back to latest known gas price and flag result as estimated)
- How does the system handle very old rides where gas prices may not be reliably known? (Use ride-date gas prices when available; otherwise latest known price)
- What if a user hasn't recorded their vehicle's MPG? (System should use 20 MPG and show a reminder card to configure MPG in settings)
- What if a user has not configured a mileage rate setting? (Mileage-rate savings should show as not available and prompt the user to set a mileage rate)
- What if no rides exist yet? (Dashboard should show zero values gracefully, not error)
- How are multi-vehicle users handled if that becomes a future feature? (Current spec assumes single vehicle; document for future enhancement)
- What if expenses exceed savings in a window? (Net savings is negative, shown in red — the user is currently in a deficit for that period)
- How are oil-change savings attributed to a time window? (Oil changes are counted by 3000-mile intervals; a window's oil-change savings = intervals crossed during that window × OilChangePrice, computed from cumulative miles before window start vs window end)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate total gas gallons saved based on cumulative ride distance and configurable vehicle MPG
- **FR-002**: System MUST calculate total money saved based on cumulative ride distance, vehicle MPG, and gas prices using ride-date price when available, otherwise latest known gas price (sourced from gas-price-lookup feature)
- **FR-003**: System MUST display savings rate metrics for weekly, monthly, yearly, and all-time windows
- **FR-004**: System MUST display timespan information indicating the date range of tracked rides
- **FR-005**: System MUST provide an extensible suggestions engine that generates contextual recommendations based on ride patterns
- **FR-006**: System MUST include a primary "Advanced Stats" card action in the main dashboard stats area linking to the advanced dashboard
- **FR-007**: System MUST handle edge cases gracefully: missing MPG data, missing gas prices, zero rides, multi-week gaps in ride history
- **FR-008**: System MUST preserve user authentication and session state when navigating between main dashboard and advanced dashboard
- **FR-009**: System MUST default savings calculations to 20 MPG when user MPG is not configured
- **FR-010**: System MUST display a reminder card on the advanced dashboard when user MPG is not configured in settings
- **FR-011**: System MUST label money-saved values as estimated when fallback gas prices are used for any rides in the calculation window
- **FR-012**: System MUST include exactly three deterministic rule-based suggestion types in MVP: consistency, milestone, and comeback
- **FR-013**: System MUST include an "Advanced Stats" top navigation item that routes to the advanced dashboard
- **FR-014**: System MUST calculate total mileage-rate savings based on cumulative ride distance and the user's configured mileage rate setting
- Formula note: mileage-rate savings = cumulative ride distance × user mileage rate setting
- **FR-015**: System MUST display a reminder card on the advanced dashboard when user mileage rate is not configured in settings
- **FR-016**: System MUST include total expenses (sum of non-deleted manual expenses with ExpenseDate within the window's date range) in each time window of the advanced dashboard
- **FR-017**: System MUST compute per-window oil-change savings using cumulative miles: OilChangeSavings = (floor(cumulativeMilesAtWindowEnd / 3000) − floor(cumulativeMilesBeforeWindowStart / 3000)) × OilChangePrice; null when OilChangePrice is not configured
- **FR-018**: System MUST display net savings per window: NetSavings = (FuelCostAvoided ?? 0) + (MileageRateSavings ?? 0) + (OilChangeSavings ?? 0) − TotalExpenses; null only when all savings components are null AND expenses are zero
- **FR-019**: System MUST display negative net savings in red (visual indicator) when a window's expenses exceed its savings
- **FR-020**: System MUST display expense and net savings columns in the savings breakdown table on the advanced dashboard

### Key Entities *(include if feature involves data)*

- **Ride**: Represents a single bike commute with distance, date, time, and vehicle info; linked to user
- **Gas Price Data**: Historical or current gas prices used to calculate money savings
- **Mileage Rate Setting**: User-configured per-distance monetary rate used to calculate mileage-rate savings
- **Expenses**: Manual bike expenses recorded by the user (maintenance, parts, accessories); scoped per time window by ExpenseDate
- **Oil-Change Savings**: Computed offset reducing net expenses; based on OilChangePrice setting and 3000-mile intervals (cumulative, windowed by interval crossings)
- **User Preferences**: Vehicle MPG and other configurable settings used in savings calculations

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate from the main dashboard to the advanced dashboard in under 1 second
- **SC-002**: All savings calculations (gallons saved, gas-price money saved, mileage-rate savings, and rate metrics) are accurate to within 1% compared to manual calculation from ride data
- **SC-003**: The advanced dashboard page loads in under 2 seconds even with 1000+ ride records
- **SC-004**: Suggestions engine successfully generates at least one relevant suggestion from the three MVP types (consistency, milestone, comeback) for users with 5+ rides in the system
- **SC-005**: 95% of users who visit the main dashboard discover and click through to the advanced dashboard within first month of feature launch (adoption metric)
- **SC-006**: Users report increased engagement with the bike tracking app as measured by login frequency (baseline before feature, compared 30 days post-launch)

## Assumptions

- **Vehicle MPG**: Assumed to be user-configurable. If not configured, system uses a default of 20 MPG and shows a reminder card prompting users to set MPG in settings for improved accuracy
- **Mileage Rate**: Assumed to be user-configurable. If not configured, mileage-rate savings are shown as not available and users are prompted to set a mileage rate in settings
- **Gas Price Data**: Assumed to be available via the existing gas-price-lookup feature (spec 010). Calculations use ride-date gas prices when available and latest known gas price as fallback, with estimated labeling when fallback is used
- **Single Vehicle**: Current spec assumes users track one vehicle. Multi-vehicle support is deferred to future enhancement
- **Ride Distance**: Assumed to be accurately captured by existing ride recording feature; no additional tracking required
- **User Engagement**: Suggestions are assumed to improve motivation; success measured by engagement metrics rather than explicit user feedback in MVP
