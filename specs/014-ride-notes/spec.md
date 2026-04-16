# Feature Specification: Ride Notes

**Feature Branch**: `014-ride-notes`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "Add Notes to the ride record, ride history (in an info icon with hover to save space in the grid row) and import."

## Clarifications

### Session 2026-04-14

- Q: What is the maximum note length? -> A: 500 characters.
- Q: How should note text be handled for safe display? -> A: Store as plain text and always escape/encode on display.
- Q: What should happen when an imported row note exceeds 500 characters? -> A: Mark that row invalid and continue importing other valid rows.

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

### User Story 1 - Add and Edit Ride Notes (Priority: P1)

As a rider, I can enter a free-text note when creating or editing a ride so I can capture context such as commute issues, route conditions, or reminders.

**Why this priority**: Capturing notes at record time is the core value. Without this, there is no note data to show in history or import.

**Independent Test**: Can be fully tested by creating a ride with a note, editing the note, and confirming the updated note is retained when the ride is reopened.

**Acceptance Scenarios**:

1. **Given** a signed-in rider on the ride record form, **When** they provide note text and save the ride, **Then** the ride is saved with that note attached.
2. **Given** an existing ride with a note, **When** the rider edits and saves the note, **Then** the updated note replaces the previous note for that ride revision.
3. **Given** a rider leaves the note blank, **When** they save the ride, **Then** the ride is saved successfully with no note.

---

### User Story 2 - View Notes in Compact Ride History (Priority: P2)

As a rider, I can quickly discover and read notes in ride history through a compact indicator so the grid stays dense and readable.

**Why this priority**: The request explicitly requires space-saving display in history rows while still making notes accessible.

**Independent Test**: Can be fully tested by viewing ride history with mixed rows (some with notes, some without) and confirming note visibility through an info indicator with hover/focus behavior.

**Acceptance Scenarios**:

1. **Given** a ride history row with a saved note, **When** the row is rendered, **Then** the row shows an info icon indicator instead of expanding the full note text inline.
2. **Given** a rider points to or focuses the info icon for a row with notes, **When** the interaction occurs, **Then** the note content is revealed in a lightweight overlay without changing row height.
3. **Given** a ride history row without a note, **When** the row is rendered, **Then** no note indicator is shown.
4. **Given** a touch-only device where hover is unavailable, **When** the rider taps the note indicator, **Then** the note content is revealed in an equivalent tap-accessible way.

---

### User Story 3 - Import Notes from CSV (Priority: P2)

As a rider, I can include notes in imported ride data so my historical context is preserved without manual re-entry.

**Why this priority**: Import is a major ingestion path for historical rides; losing notes during import would create incomplete records.

**Independent Test**: Can be fully tested by importing a CSV containing a Notes column and verifying imported rides retain note text and show note indicators in history.

**Acceptance Scenarios**:

1. **Given** a valid import file containing a Notes column, **When** the import completes, **Then** each imported ride includes its note text from the corresponding row.
2. **Given** an import file that omits Notes values for some rows, **When** import completes, **Then** those rows are imported successfully with empty notes.
3. **Given** imported rides include notes, **When** the rider opens ride history, **Then** imported rides with notes show the same note indicator and reveal behavior as manually created rides.

---

### Edge Cases

- A note exceeds 500 characters; the rider receives clear validation and the ride is not saved until corrected.
- A note contains punctuation, line breaks, or quoted text; the note is preserved and displayed as entered.
- A CSV row contains an empty Notes field; the row still imports.
- A CSV file includes note text longer than 500 characters; that row is marked invalid with a clear message while other valid rows continue importing.
- A rider navigates ride history with keyboard only; note content remains discoverable through focus interaction, not hover alone.
- A rider has many rides with notes; note indicators do not cause row height expansion or layout instability.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a note field when creating a ride.
- **FR-002**: System MUST provide the same note field when editing an existing ride.
- **FR-003**: System MUST persist note text as part of the saved ride data so it can be retrieved later.
- **FR-004**: System MUST allow rides to be saved with no note.
- **FR-005**: System MUST enforce a maximum note length of 500 characters and show user-facing validation when exceeded.
- **FR-006**: System MUST render a compact note indicator in ride history rows only when a ride has a note.
- **FR-007**: System MUST reveal note content from the ride history indicator through hover or focus interaction without increasing row height.
- **FR-008**: System MUST provide an equivalent non-hover interaction for note reveal on touch devices.
- **FR-009**: System MUST not show a note indicator for rows where note data is absent.
- **FR-010**: System MUST support importing notes from the CSV Notes column when present.
- **FR-011**: System MUST continue importing rows when note values are blank.
- **FR-012**: System MUST apply the same note validation rules to imported notes as manual-entry notes.
- **FR-013**: System MUST make imported notes available in ride history with the same indicator and reveal behavior as manual rides.
- **FR-014**: System MUST preserve note text exactly as entered in supported characters and spacing (subject to validation limits).
- **FR-015**: System MUST treat notes as plain text and MUST escape/encode note content whenever rendered in the UI.
- **FR-016**: System MUST treat imported notes longer than 500 characters as row-level validation failures, mark those rows invalid with a specific error, and continue importing other valid rows.

### Key Entities *(include if feature involves data)*

- **Ride Note**: Free-text rider-provided context attached to a ride entry. Attributes include note text, note presence flag, and last-updated timestamp context.
- **Ride Record**: A single ride entry that may include a note alongside date, distance, duration, and related ride attributes.
- **Imported Ride Row**: One parsed CSV row that can include a Notes value mapped into the resulting ride record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of riders in acceptance testing can add a note while recording a ride in under 20 seconds.
- **SC-002**: 100% of rides saved with valid note text (0-500 characters) retain that note when reopened for edit or viewed later.
- **SC-003**: 100% of history rows with notes display a note indicator, and 0% of rows without notes display the indicator.
- **SC-004**: 95% of riders can read a ride note from history in one interaction (hover/focus or tap) without row expansion.
- **SC-005**: 100% of imported CSV rows with valid Notes values preserve note text on resulting rides.
- **SC-006**: Import success rate for rows with blank Notes remains equal to rows without a Notes column.
- **SC-007**: 100% of imported rows with notes over 500 characters are rejected at row level with explicit note-length errors, while other valid rows in the same file are still imported.

## Assumptions

- Existing ride import supports a Notes column in the incoming file structure.
- Existing authentication and ride ownership rules continue to apply to notes exactly as they apply to other ride fields.
- Manual entry and import share one validation policy with a 500-character note limit.
- Notes are stored and rendered as plain text, not HTML markup.
- Notes are intended for personal rider context and are displayed only to that rider.

## Dependencies

- Ride record create/edit flow remains the source of truth for manual note entry.
- Ride history grid continues to support compact per-row metadata indicators.
- CSV import mapping remains configurable enough to include the Notes field consistently.
