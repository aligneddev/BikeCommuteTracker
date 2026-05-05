# Feature Specification: Ride Difficulty & Wind Resistance Rating

**Feature Branch**: `019-ride-difficulty-wind`  
**Created**: 2026-04-23  
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rate Ride Difficulty When Recording a Ride (Priority: P1)

A rider finishes a tough headwind commute and records the ride. They see optional fields for "Difficulty" (1–5 scale) and "Primary Travel Direction." Once they select a direction, the system automatically calculates and fills in a suggested difficulty rating based on the captured wind speed and direction combination. The rider can accept the suggestion or override it with their own rating before saving.

**Why this priority**: This is the entry point for all difficulty data. Without it, no difficulty information enters the system for current or future analytics. Every other story depends on this data existing.

**Independent Test**: Can be fully tested by recording a single ride, selecting a travel direction, observing that difficulty auto-fills, overriding the value, and confirming the ride saves with the manually entered difficulty.

**Acceptance Scenarios**:

1. **Given** a rider is on the Record Ride page, **When** they view the form, **Then** they see two new optional fields: a "Difficulty" dropdown (values 1–5) and a "Primary Travel Direction" dropdown (accepted inputs: full compass names or 2‑letter abbreviations; normalized internally to `N, NE, E, SE, S, SW, W, NW`).
2. **Given** the Record Ride page is displayed, **When** the rider hovers or taps the info icon next to "Primary Travel Direction," **Then** a tooltip or popover explains: "Your primary direction of travel helps us calculate wind resistance. Since rides can involve multiple directions, choose the direction you rode the most."
3. **Given** a ride already has wind speed captured from weather data, **When** the rider selects a Primary Travel Direction, **Then** the Difficulty field is automatically populated with a calculated value (1–5) based on wind speed and the headwind/tailwind relationship to the selected direction
4. **Given** the Difficulty field has been auto-calculated, **When** the rider changes the value in the Difficulty dropdown, **Then** the updated value is saved (the auto-calculated value is a suggestion only)
5. **Given** the rider does not select a Primary Travel Direction, **When** they save the ride, **Then** the Difficulty field remains empty (or retains any manually entered value) and the ride saves successfully
6. **Given** no wind speed data is available for the ride, **When** the rider selects a Primary Travel Direction, **Then** no auto-calculation is performed and the Difficulty field remains blank unless the rider manually selects a value
7. **Given** the rider leaves both Difficulty and Primary Travel Direction blank, **When** they save the ride, **Then** the ride saves successfully — both fields are optional

---

### User Story 2 - Import Ride Difficulty and Direction via CSV (Priority: P1)

A rider with historical ride data in a spreadsheet wants to import it including their manually noted difficulty ratings and primary travel directions. The system accepts these as optional columns in the CSV. The import page includes a sample CSV download link so riders know the exact format expected.

**Why this priority**: P1 because without CSV import support for these fields, bulk historical data will be missing difficulty entirely, which would produce incomplete analytics. Parity with manual entry is important for data consistency.

**Independent Test**: Can be fully tested by downloading the sample CSV, adding a few rows with `Difficulty` and `PrimaryTravelDirection` (or `Direction` alias) values, importing the file, and confirming those values appear on the imported rides.

**Acceptance Scenarios**:

1. **Given** a rider is on the CSV Import page, **When** they view the page, **Then** they see a "Download Sample CSV" link that downloads a properly formatted example file containing all supported columns including `Difficulty` and `PrimaryTravelDirection` (CSV import requires the `PrimaryTravelDirection` header)
2. **Given** the sample CSV is downloaded, **When** the rider opens it, **Then** it contains example rows with realistic data, column headers matching expected import format, and inline comments or a legend row explaining valid values (1–5 for Difficulty; compass direction names for `PrimaryTravelDirection`)
3. **Given** a CSV containing `Difficulty` and `PrimaryTravelDirection` (or `Direction`) columns with valid values, **When** the rider imports it, **Then** each ride record is created with the specified difficulty and primary travel direction values
4. **Given** a CSV containing a `Difficulty` value outside the 1–5 range (e.g., 0, 6, or "hard"), **When** the file is parsed, **Then** the system flags that row with a validation error describing the expected range, and excludes it from the import while allowing other valid rows to proceed
5. **Given** a CSV containing an unrecognized `PrimaryTravelDirection`/`Direction` value (e.g., "Northeast" instead of "NE"), **When** the file is parsed, **Then** the system flags that row with a validation error listing accepted direction values
6. **Given** a CSV where `Difficulty` and `PrimaryTravelDirection`/`Direction` columns are absent entirely, **When** imported, **Then** the import succeeds without error — these columns are optional
7. **Given** a CSV where `Difficulty` is present but `PrimaryTravelDirection`/`Direction` is absent (or vice versa), **When** imported, **Then** the ride is created with whichever field was provided, and the missing field is left blank

---

### User Story 3 - View Difficulty Analytics on the Advanced Dashboard (Priority: P2)

A rider visits the Advanced Dashboard and sees a new difficulty analytics section. It shows their average difficulty overall, average difficulty by month, a ranking of their most difficult months, and a wind resistance rating chart that visualizes headwind and tailwind impact across their rides.

**Why this priority**: P2 because it depends on difficulty data existing (Stories 1 and 2). It delivers long-term analytical value but is not needed to start collecting the data.

**Independent Test**: Can be tested by ensuring several rides have difficulty data (manual or imported), navigating to the Advanced Dashboard, and confirming all four visual elements render with correct values.

**Acceptance Scenarios**:

1. **Given** the rider has rides with difficulty ratings, **When** they view the Advanced Dashboard, **Then** they see a "Ride Difficulty" section containing:
   - Overall average difficulty (numeric, 1 decimal place)
   - Average difficulty broken down by calendar month
   - A ranked list of most difficult months (months sorted by average difficulty, descending)
2. **Given** the rider has rides **without** difficulty ratings but **with** wind speed and direction data, **When** the Advanced Dashboard loads, **Then** the system calculates difficulty on-the-fly using the same wind speed + direction formula used during ride entry, and includes those rides in all difficulty metrics
3. **Given** the rider has a mix of rides with stored difficulty ratings and rides without, **When** difficulty metrics are displayed, **Then** stored ratings are used as-is and on-the-fly calculations fill in the gaps — both feed the same aggregations seamlessly
4. **Given** the rider views the Advanced Dashboard, **When** they look at the Wind Resistance Rating visual, **Then** they see a chart showing rides distributed across wind resistance levels: −4, −3, −2, −1 (tailwind assistance, making ride easier) and +1, +2, +3, +4 (headwind resistance, adding difficulty), with negative values clearly labeled as "wind-assisted"
5. **Given** a ride had a strong tailwind, **When** its wind resistance rating is displayed, **Then** it appears in the negative range (e.g., −2 or −3) and is visually distinguished from headwind rides (e.g., different color or bar direction)
6. **Given** the rider has no difficulty data and no wind data at all, **When** they view the Advanced Dashboard, **Then** the difficulty section shows a helpful empty state ("Record rides with travel direction to see difficulty trends") rather than errors or blank charts

---

### Edge Cases

- What happens when wind speed is 0 (calm conditions)? → Calculated difficulty should default to 1 (no wind resistance) and auto-fill accordingly
- What happens when the rider records a ride in a direction perfectly perpendicular to the wind (crosswind)? → The wind resistance calculation yields a near-zero effect; difficulty is not auto-changed by crosswind unless it exceeds a threshold
- How does the system handle rides where direction was recorded but weather data has no wind speed? → Direction is stored but no difficulty is calculated; the field stays blank
- What if a rider changes their Primary Travel Direction after difficulty was already auto-calculated? → The system recalculates and updates the difficulty suggestion; any prior manual override is cleared and the rider can override again
- What happens to WindResistanceRating when a rider edits a **saved** ride and changes PrimaryTravelDirection? → `WindResistanceRating` is automatically recalculated using the same formula as at initial save time; the updated value is persisted when the edit is saved (see FR-026 and Clarifications 2026-04-24)
- What happens to the stored Difficulty value when a rider edits a **saved** ride and changes PrimaryTravelDirection? → The edit form recalculates and pre-fills Difficulty as a **suggestion** only; the rider may accept or change it before saving; the persisted Difficulty is updated only on explicit save — no silent auto-overwrite occurs (see FR-027 and Clarifications 2026-04-24)
- What if all rides in a month lack both difficulty rating and wind data? → That month is excluded from monthly averages rather than displaying as 0

## Requirements *(mandatory)*

### Functional Requirements

#### Record Ride Form

- **FR-001**: The Record Ride form MUST include an optional "Difficulty" dropdown with values 1 (Very Easy), 2 (Easy), 3 (Moderate), 4 (Hard), 5 (Very Hard)
- **FR-002**: The Record Ride form MUST include an optional "Primary Travel Direction" dropdown with canonical internal values: `N, NE, E, SE, S, SW, W, NW`. The form and import endpoints MAY accept either full compass names (e.g., "North", "Northeast") or 2‑letter abbreviations; all inputs MUST be normalized to the canonical 2‑letter abbreviation before persistence or calculation.
- **FR-003**: The "Primary Travel Direction" field MUST display an info icon; activating it MUST show a description explaining that the user should choose the direction they traveled most, and that this value is used to calculate wind resistance against captured wind speed
- **FR-004**: When a rider selects a Primary Travel Direction AND wind speed data is available for the ride, the system MUST automatically calculate and populate the Difficulty field using the wind resistance formula
- **FR-005**: The auto-populated Difficulty value MUST be overridable by the rider at any time before saving
- **FR-006**: If the rider changes the selected Primary Travel Direction, the system MUST recalculate the Difficulty suggestion and update the field (clearing any prior auto-value; manual overrides are also cleared and replaced with the new calculation)
- **FR-007**: Both Difficulty and Primary Travel Direction MUST be optional; the ride MUST save successfully if either or both are blank

#### Wind Resistance Calculation

- **FR-008**: The system MUST calculate a wind resistance value using the angle between the rider's primary travel direction and the wind direction, weighted by wind speed in **mph**
- **FR-009**: A headwind (wind directly opposing travel) MUST produce a positive resistance rating (harder); a tailwind (wind directly behind travel) MUST produce a negative resistance rating (easier)
- **FR-010**: The wind resistance rating scale MUST range from −4 (strong tailwind assistance) to +4 (strong headwind resistance), with 0 representing calm or crosswind conditions
- **FR-011**: The Difficulty auto-calculation MUST map the wind resistance rating to the 1–5 difficulty scale: strong tailwind biases toward 1–2, neutral toward 3, strong headwind toward 4–5
 
    - **Explicit mapping (authoritative)**: the system MUST use the following mapping from persisted `WindResistanceRating` (−4..+4) to `Difficulty` (1..5) when deriving or persisting suggested difficulty values:
       - `WindResistanceRating <= -3`  → `Difficulty = 1` (Very Easy)
       - `WindResistanceRating = -2 or -1` → `Difficulty = 2` (Easy)
       - `WindResistanceRating = 0` → `Difficulty = 3` (Moderate)
       - `WindResistanceRating = 1 or 2` → `Difficulty = 4` (Hard)
       - `WindResistanceRating >= 3` → `Difficulty = 5` (Very Hard)
- **FR-012**: When wind speed is zero, calculated difficulty MUST default to 1

-#### CSV Import

- **FR-013**: The CSV Import page MUST support two new optional columns: `Difficulty` (integer 1–5) and `Direction` (accepts either full compass names or 2‑letter abbreviations). The import/validator MUST normalize accepted `Direction` inputs to the canonical 2‑letter abbreviations used internally: `N, NE, E, SE, S, SW, W, NW`.
- **FR-014**: The CSV Import page MUST display a "Download Sample CSV" link that triggers a download of an example file
- **FR-015**: The sample CSV MUST include all supported import columns (including `Difficulty` and `Direction`), realistic example data rows, and a clear legend or comment row describing valid values
- **FR-016**: The import validator MUST reject rows with `Difficulty` values outside the integer range 1–5 and display a specific error message
- **FR-017**: The import validator MUST reject rows with unrecognized `Direction` values and display an error listing accepted compass values
- **FR-018**: Rows with missing or blank `Difficulty` and/or `Direction` columns MUST be accepted without error

#### Advanced Dashboard

- **FR-019**: The Advanced Dashboard MUST display an overall average difficulty score across all rides that have a difficulty value (stored or calculated)
- **FR-020**: The Advanced Dashboard MUST display average difficulty grouped by **calendar month** (January through December, all years combined; exactly 12 possible month groups — e.g., all Januaries averaged together regardless of year)
- **FR-021**: The Advanced Dashboard MUST display a ranked list of **calendar month groups** ordered by average difficulty (descending), labeled as "Most Difficult Months" — at most 12 entries, one per named month
- **FR-022**: For rides without a stored difficulty rating, the dashboard MUST derive difficulty from the ride's stored `WindResistanceRating` (if present) using the same 1–5 mapping; only if `WindResistanceRating` is also absent should the formula be re-evaluated live from raw wind speed and direction data
- **FR-023**: The Advanced Dashboard MUST display a Wind Resistance Rating visual showing ride counts or frequency across the range −4 to +4
- **FR-024**: The Wind Resistance Rating visual MUST visually distinguish negative (tailwind/assisted) values from positive (headwind/resistance) values
- **FR-025**: When no difficulty data exists and no wind data can fill the gap, the dashboard difficulty section MUST display a descriptive empty state message

#### Edit Ride

- **FR-026**: When a rider edits a saved ride and changes `PrimaryTravelDirection`, the system MUST automatically recalculate `WindResistanceRating` using the same formula applied at initial save time; the recalculated value MUST be persisted when the edit is saved
- **FR-027**: When a rider edits a saved ride and changes `PrimaryTravelDirection`, the system MUST recalculate the Difficulty value and pre-fill the Difficulty field in the edit form as a **suggestion only**; the rider can accept the suggested value or enter a different value before saving; the stored Difficulty MUST NOT be updated until the rider explicitly saves the edit (no silent auto-overwrite)

### Key Entities

- **Ride** (existing entity, extended): gains optional `Difficulty` (integer 1–5), `PrimaryTravelDirection` (enum: 8 compass values), and `WindResistanceRating` (integer −4 to +4, nullable) attributes; `WindResistanceRating` is persisted as a column on the Ride record, computed at ride-save time or import time (not recalculated at read time)
- **Wind Resistance Rating**: a value (−4 to +4) calculated from the angle between travel direction and wind direction, scaled by wind speed; **persisted on the Ride record** at write time so the dashboard reads it directly without re-deriving it
- **Difficulty Calculation**: a stateless formula mapping wind speed, wind direction, and travel direction to a 1–5 difficulty value and a −4 to +4 resistance rating

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Riders can record a ride with difficulty and travel direction in under 30 additional seconds compared to recording without those fields
- **SC-002**: When travel direction is selected and wind data is present, the difficulty field auto-fills within 1 second of selection
- **SC-003**: The sample CSV download is available immediately (no authentication required beyond being logged in) and opens correctly in common spreadsheet applications
- **SC-004**: CSV imports containing Difficulty and Direction columns complete with the same reliability and progress behavior as imports without those columns
- **SC-005**: The Advanced Dashboard difficulty section loads within the same time budget as existing dashboard widgets (no perceivable additional delay)
- **SC-006**: All difficulty analytics (overall average, monthly breakdown, most difficult months, wind resistance chart) are correct to within ±0.1 of a recalculation performed independently against the same ride data
- **SC-007**: Rides lacking stored difficulty but having wind and direction data are included in dashboard metrics — riders see no unexplained gaps in their analytics

## Assumptions

- Wind speed is already captured as part of the weather data during ride recording (per the existing ride-weather-data feature, spec 011)
- Wind direction is available as a compass bearing or named direction in the weather data; if the weather API returns a bearing in degrees, the system can map it to the nearest 8-point compass direction
- The existing Advanced Dashboard (spec 018) is deployed and accessible; the difficulty section is additive
- The CSV import infrastructure (spec 013) is in place; this feature extends the column set without rebuilding the import pipeline
- "Most difficult months" means **calendar months (January through December)** aggregated across all years (all Januaries together, all Februaries together, etc.); exactly 12 possible month groups with no year-level breakdown (see Clarifications 2026-04-24)
- Wind resistance rating bins (−4 to +4) are calculated using a cosine-based formula: `resistance = round(windSpeed × cos(angleBetweenDirections) / threshold)`, clamped to [−4, +4]; **threshold constant = 5 mph** (i.e., 20 mph direct headwind maps to +4); wind speed is stored and displayed in **mph** throughout the system (see Clarifications 2026-04-24)
- `WindResistanceRating` is persisted as a column on the Ride record (not computed on read); see Clarifications for the decision rationale

## Clarifications

### Session 2026-04-24

- Q: Should the Wind Resistance Rating (−4 to +4) be persisted on the Ride record, or always computed on-the-fly? → A: Persist it. Store `WindResistanceRating` as a column on the Ride record, calculated at ride-save time (or import time); dashboard reads it directly.
 - Q: What wind speed should map to a +4 (maximum headwind) rating? → A: 20 mph direct headwind = +4; threshold constant = 5 mph. Wind speed is stored and displayed in mph.
 - Q: How is a `WindResistanceRating` translated to `Difficulty` for persistence and analytics? → A: Use the explicit mapping table in FR-011 (≤ −3 → 1, −2/−1 → 2, 0 → 3, +1/+2 → 4, ≥ +3 → 5). This mapping is the authoritative source for dashboard aggregates and tests.
- Q: How should "most difficult months" be aggregated on the dashboard? → A: Calendar month roll-up: all Januaries averaged together, all Februaries averaged together; exactly 12 possible rows/bars (no year-level breakdown).
- Q: What happens to WindResistanceRating when a rider edits a saved ride and changes PrimaryTravelDirection? → A: Recalculate `WindResistanceRating` automatically whenever `PrimaryTravelDirection` is changed on an edit; same formula as initial save; recalculated value is persisted when the edit is saved.
- Q: What happens to the stored Difficulty value when a rider edits a saved ride and changes PrimaryTravelDirection? → A: Suggest only — recalculate and pre-fill the Difficulty field in the edit form as a new suggestion; rider can accept or change before saving; stored Difficulty updates only on save (no silent auto-overwrite).

### Session 2026-04-27

- Q: Should CSV and form inputs accept 2‑letter abbreviations, full compass names, or only one format for `Direction` values? → A: Accept both abbreviations and full names on input; normalize to canonical 2‑letter abbreviations internally (N, NE, E, SE, S, SW, W, NW).
