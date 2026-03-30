# Feature Specification: Per-User Settings Page

**Feature Branch**: `001-create-a-per-user`  
**Created**: 2026-03-30  
**Status**: Draft  
**Input**: User description: "Create a per user settings page. Allow entry of average car mpg, a yearly goal, location picker for lat and long, oil change price, and mileage rate (in cents)."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Save Personal Ride and Cost Settings (Priority: P1)

As an authenticated rider, I want a personal settings page where I can enter my average car mpg, yearly goal, oil change price, and mileage rate so the app can reflect my own commuting assumptions instead of generic defaults.

**Why this priority**: This is the core value of the feature because it gives each rider a place to define the personal values that drive their own targets and cost comparisons.

**Independent Test**: Can be fully tested by visiting the settings page as a signed-in rider, entering valid values for the numeric fields, saving, and confirming the same values appear when returning to the page.

**Acceptance Scenarios**:

1. **Given** an authenticated rider opens the settings page for the first time, **When** the page loads, **Then** the rider sees fields for average car mpg, yearly goal, oil change price, and mileage rate.
2. **Given** an authenticated rider enters valid values in the settings fields, **When** the rider saves the page, **Then** the system stores those values for that rider and confirms the save succeeded.
3. **Given** a rider has previously saved settings, **When** the rider returns to the settings page, **Then** the page shows the rider's currently saved values.

---

### User Story 2 - Set a Personal Reference Location (Priority: P2)

As an authenticated rider, I want to pick a location that stores latitude and longitude so the app can use a rider-specific reference point for location-based features and calculations.

**Why this priority**: A saved location is part of the requested settings set, but it is secondary to the core need to store the rider's numeric personal settings.

**Independent Test**: Can be fully tested by opening the settings page, selecting a location through the picker, saving, and verifying the saved location is shown again on a later visit.

**Acceptance Scenarios**:

1. **Given** an authenticated rider is on the settings page, **When** the rider selects a location from the location picker, **Then** the page captures the associated latitude and longitude values for that rider.
2. **Given** a rider selects a valid location and saves, **When** the rider revisits the settings page later, **Then** the previously selected location remains associated with the rider.

---

### User Story 3 - Update Settings Safely Over Time (Priority: P3)

As an authenticated rider, I want to update individual settings later without affecting other riders or losing unrelated saved values so my personal assumptions can change over time.

**Why this priority**: Riders will revisit these values occasionally, but the feature still delivers clear value even before ongoing edits are polished beyond the initial save flow.

**Independent Test**: Can be fully tested by saving an initial full settings profile, changing one field later, saving again, and verifying only that rider's intended value changed while the remaining saved values stay intact.

**Acceptance Scenarios**:

1. **Given** a rider already has saved settings, **When** the rider updates only one setting and saves, **Then** the updated value replaces the previous value and the rider's other saved settings remain unchanged.
2. **Given** two different riders have their own settings, **When** one rider changes and saves a value, **Then** the other rider's settings are unchanged.

---

### Edge Cases

- A rider has never saved settings before: the page loads with empty values or agreed defaults rather than another rider's data.
- A rider enters a non-numeric, zero, or negative value for a field that requires a positive amount: the system blocks saving that field value and shows a clear validation message.
- A rider provides a mileage rate with decimals in cents: the system preserves the entered precision supported by the product rather than silently rounding to a misleading value.
- A rider changes the selected location before saving: only the final confirmed location is stored.
- A rider leaves some settings blank because they do not know all values yet: the system saves only the completed valid settings and keeps incomplete optional fields unset.
- A rider opens the settings page without being authenticated: personal settings are not exposed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a settings page for authenticated riders.
- **FR-002**: System MUST store settings separately for each rider so one rider can only view and change their own settings.
- **FR-003**: System MUST allow a rider to enter and save an average car mpg value.
- **FR-004**: System MUST allow a rider to enter and save a yearly goal value representing the rider's annual riding target.
- **FR-005**: System MUST allow a rider to enter and save an oil change price value.
- **FR-006**: System MUST allow a rider to enter and save a mileage rate value expressed in cents per mile.
- **FR-007**: System MUST allow a rider to choose a location and store the resulting latitude and longitude for that rider.
- **FR-008**: System MUST load a rider's existing saved settings when the rider opens the settings page.
- **FR-009**: System MUST require an explicit save action before changed settings are persisted.
- **FR-010**: System MUST validate each entered value before saving and prevent invalid values from being persisted.
- **FR-011**: System MUST show which field values failed validation in language a non-technical rider can understand.
- **FR-012**: System MUST preserve previously saved valid settings when a rider updates only a subset of fields.
- **FR-013**: System MUST support leaving individual settings unset when a rider has not provided a value for that field.
- **FR-014**: System MUST not expose personal settings to unauthenticated users.

### Key Entities *(include if feature involves data)*

- **User Settings Profile**: A rider-owned collection of personal settings including average car mpg, yearly goal, oil change price, mileage rate, and an optional saved location.
- **Location Preference**: A saved rider location represented by a selected place and its latitude and longitude coordinates.
- **Settings Field Value**: An individual user-provided value within the settings profile that can be saved, updated, validated, or left unset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of authenticated riders can complete their first-time settings entry in under 2 minutes.
- **SC-002**: At least 95% of valid settings submissions succeed on the rider's first save attempt.
- **SC-003**: 100% of saved settings remain isolated to the rider who created or updated them.
- **SC-004**: At least 90% of riders who revisit the settings page can update a single field without re-entering unchanged values.

## Assumptions

- The settings page is available only after a rider has authenticated.
- The yearly goal is measured in the same ride-distance unit already used elsewhere in the product.
- Average car mpg, yearly goal, oil change price, and mileage rate are user-editable numeric values that must be positive when provided.
- A rider may save a partial settings profile if some requested values are still unknown.
- The saved location represents one rider-selected reference point at a time.
