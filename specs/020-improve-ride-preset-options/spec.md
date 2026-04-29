# Feature Specification: Improve Ride Entry Preset Options

**Feature Branch**: `020-improve-ride-preset-options`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "improve ride entry - pre setup options (new UI under user settings, navigatable from clicking/hovering on user name, then a new settings option) with primary direction, morning is SW, afternoon is NE, time, duration, user chooses name; remove auto fill from previous, replace with pre-setup options; this changes a previous spec"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Ride Presets in Settings (Priority: P1)

As a rider, I want to pre-configure named ride presets in my user settings so I can reuse my most common ride setup without re-entering the same values each time.

**Why this priority**: This is the core behavior shift requested and replaces the current ride-entry autofill behavior.

**Independent Test**: Open profile menu from username, navigate to settings, create a named preset with direction, exact start time, and duration, save, then reopen settings and verify preset persists.

**Acceptance Scenarios**:

1. **Given** rider is authenticated, **When** rider opens username menu by click or hover and selects settings, **Then** rider can access a new ride-preset setup section.
2. **Given** rider is in ride-preset setup, **When** rider adds a preset name, direction, period (morning or afternoon), exact start time, and duration then saves, **Then** preset is stored for that rider.
3. **Given** rider has existing presets, **When** rider revisits settings, **Then** rider sees previously saved presets and can identify each by custom name.

---

### User Story 2 - Apply Presets During Ride Entry (Priority: P1)

As a rider, I want ride entry to use my pre-setup options instead of previous-ride autofill so entry is predictable and aligned with my routine.

**Why this priority**: Requested behavior explicitly replaces legacy autofill from past entries.

**Independent Test**: With at least one configured preset, open ride entry and verify preset options are available while previous-ride autofill options are absent.

**Acceptance Scenarios**:

1. **Given** rider has one or more saved presets, **When** rider opens ride entry, **Then** rider can choose from saved preset names.
2. **Given** rider selects a preset in ride entry, **When** preset is applied, **Then** direction, exact start time, and duration fields are populated from that preset.
3. **Given** rider opens ride entry after feature release, **When** no presets are configured, **Then** system does not show legacy quick-entry UI and keeps manual entry available.

---

### User Story 3 - Support Routine Direction Defaults (Priority: P2)

As a rider, I want morning and afternoon directional defaults so I can quickly map regular commute flow (morning SW, afternoon NE) while still choosing my own preset names.

**Why this priority**: Speeds setup for common commute pattern while preserving user control.

**Independent Test**: In settings, create presets using default directional suggestions for morning and afternoon; verify user can override values and keep custom names.

**Acceptance Scenarios**:

1. **Given** rider creates a morning preset, **When** period tag is morning, **Then** system suggests SW as default primary direction.
2. **Given** rider creates an afternoon preset, **When** period tag is afternoon, **Then** system suggests NE as default primary direction.
3. **Given** directional defaults are suggested, **When** rider edits direction or preset name, **Then** system accepts rider-selected values.

### Edge Cases

- Rider has no presets configured: ride entry remains fully manual with no prior-ride autofill.
- Rider creates two presets with same name: system blocks save and requests unique name per rider.
- Rider selects a preset then manually edits values: edited values are used for that entry only unless rider explicitly updates preset in settings.
- Rider has legacy quick-entry history data: data remains stored historically but is not used to auto-populate new ride entry.
- Rider toggles between click and hover interaction patterns on username menu: settings option remains reachable in both flows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide access to user settings from the username menu, reachable by click and hover interactions.
- **FR-002**: System MUST include a ride-preset setup section within user settings.
- **FR-003**: System MUST allow riders to create, view, update, and remove ride presets.
- **FR-004**: Each ride preset MUST include rider-defined name, primary direction, period tag (morning or afternoon), exact start time, and duration.
- **FR-005**: System MUST require preset names to be unique per rider.
- **FR-006**: System MUST suggest SW as default direction for morning time-window presets.
- **FR-007**: System MUST suggest NE as default direction for afternoon time-window presets.
- **FR-008**: System MUST allow riders to override suggested directions before saving presets.
- **FR-009**: Ride entry MUST display rider’s saved preset names as selectable setup options ordered by most recently used preset first.
- **FR-010**: When preset selected in ride entry, system MUST populate direction, exact start time, and duration from preset values.
- **FR-011**: System MUST delete legacy previous-ride quick-entry UI introduced by earlier quick-entry specification and replace it with preset-based setup options for all riders.
- **FR-012**: System MUST keep manual ride entry functional when no presets exist.
- **FR-013**: Presets MUST be scoped to authenticated rider and never visible to other riders.
- **FR-014**: System MUST preserve historical rides and analytics behavior independent of preset configuration changes.

### Key Entities *(include if feature involves data)*

- **Ride Preset**: Rider-owned reusable entry profile containing custom name, primary direction, period classification (morning or afternoon), exact start time, and default duration.
- **Rider Preset Collection**: Ordered set of ride presets owned by one rider and surfaced in settings and ride-entry selection.
- **Ride Entry Session**: Single ride-creation interaction that may apply a preset and optionally override values before save.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of riders can create first named preset from settings in under 60 seconds.
- **SC-002**: 95% of ride entries that use a preset populate direction, exact start time, and duration fields within 1 second of selection.
- **SC-003**: 0 ride-entry sessions use legacy previous-ride autofill after release.
- **SC-004**: At least 80% of riders who record rides on both morning and afternoon windows configure at least two presets within first 14 days.

## Assumptions

- Existing ride-entry flow already supports editable direction, exact start time, and duration fields.
- "Morning" and "Afternoon" time windows are already defined in product language and can be reused.
- This feature supersedes prior quick-entry behavior from the earlier ride-entry spec where values were auto-filled from previous rides.
