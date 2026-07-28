# Feature Specification: CSV Data Export

**Feature Branch**: `028-csv-data-export`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "As a user I want to export all my data to csv. On the settings page, add a button to export expenses to csv and a button to export ride history to csv. Ride history should have one csv per year and download that as a zip file. Do them separately. Do not include totals, I just want raw data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export Expenses to CSV (Priority: P1)

A user on the Settings page wants to download all their expense records as a single CSV file so they can analyse or archive their data outside the app.

**Why this priority**: Expenses are flat data with no time-bucketing, making this the simplest and highest-value export to deliver first. A standalone working button provides immediate user value.

**Independent Test**: Can be fully tested by navigating to Settings, clicking "Export Expenses", and verifying a correctly structured CSV file downloads with the expected raw expense records.

**Acceptance Scenarios**:

1. **Given** a user has recorded one or more expenses, **When** they click "Export Expenses" on the Settings page, **Then** a CSV file downloads containing one row per expense with all raw field values and no totals or summary rows.
2. **Given** a user has no expenses recorded, **When** they click "Export Expenses", **Then** a CSV file downloads containing only the header row.
3. **Given** the exported CSV, **When** opened in a spreadsheet application, **Then** all columns are correctly labelled and every expense record is present and accurate.

---

### User Story 2 - Export Ride History to CSV (Priority: P2)

A user on the Settings page wants to download their full ride history as a ZIP archive containing one CSV file per calendar year, so they can manage large datasets year by year.

**Why this priority**: Ride history can span multiple years and is the other major data type in the app. Delivering this as a ZIP-per-year makes the download manageable and self-organising for users.

**Independent Test**: Can be fully tested by navigating to Settings, clicking "Export Ride History", and verifying a ZIP file downloads containing one correctly structured CSV per year represented in the ride data.

**Acceptance Scenarios**:

1. **Given** a user has rides across multiple calendar years, **When** they click "Export Ride History" on the Settings page, **Then** a ZIP file downloads containing one CSV file per year (e.g., `2024.csv`, `2025.csv`), each with all rides for that year as raw data rows and no totals.
2. **Given** a user has rides in only one calendar year, **When** they click "Export Ride History", **Then** the ZIP contains exactly one CSV file for that year.
3. **Given** a user has no rides recorded, **When** they click "Export Ride History", **Then** a ZIP downloads containing a single CSV with only the header row (or an empty ZIP — see Assumptions).
4. **Given** the exported per-year CSV files, **When** opened in a spreadsheet application, **Then** each file contains correctly labelled columns and every ride for that year is present and accurate.

---

### Edge Cases

- What happens when the user's dataset is very large (hundreds of rides or expenses)? The download should still complete without a browser timeout.
- What happens if a ride or expense record has optional fields that were not filled in? Empty cells should be exported as blank rather than omitted columns.
- What happens if data contains commas or special characters (e.g., in notes fields)? Values must be properly quoted in the CSV.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings page MUST display a clearly labelled "Export Expenses" button.
- **FR-002**: The Settings page MUST display a clearly labelled "Export Ride History" button.
- **FR-003**: The two export buttons MUST operate independently; triggering one MUST NOT affect the other.
- **FR-004**: Clicking "Export Expenses" MUST download a single CSV file containing all of the current user's expense records as raw data rows.
- **FR-005**: The expenses CSV MUST include a header row with column names matching the expense fields (e.g., `Date`, `Amount`, `Notes`, `CreatedAtUtc`).
- **FR-006**: The expenses CSV MUST NOT include totals, subtotals, or any computed summary rows.
- **FR-007**: Clicking "Export Ride History" MUST download a ZIP archive containing one CSV file per calendar year in which the current user has recorded rides.
- **FR-008**: Each per-year CSV within the ZIP MUST include a header row and one data row per ride for that year, containing all ride fields as raw values.
- **FR-009**: Each per-year CSV MUST NOT include totals, subtotals, or any computed summary rows.
- **FR-010**: Per-year CSV files inside the ZIP MUST be named clearly by year (e.g., `2024.csv`).
- **FR-011**: Special characters and commas within field values MUST be properly escaped/quoted so the CSV is valid and parseable by standard spreadsheet tools.
- **FR-012**: Exports MUST be scoped to the currently authenticated user's data only.

### Key Entities

- **Expense Record**: A single logged expense belonging to the user, with fields such as `Date`, `Amount`, `Notes`, and `CreatedAtUtc`.
- **Ride Record**: A single logged ride belonging to the user, with fields such as date, distance, duration, and any other recorded attributes.
- **Yearly Ride CSV**: A CSV file representing all ride records for a given calendar year.
- **Ride History ZIP**: An archive bundling all yearly ride CSV files for download.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can trigger and receive a completed expense CSV download in under 5 seconds for datasets up to 5,000 records.
- **SC-002**: A user can trigger and receive a completed ride history ZIP download in under 10 seconds for datasets spanning up to 10 years with up to 5,000 total rides.
- **SC-003**: 100% of expense records and 100% of ride records present in the system are included in their respective exports — no records are omitted or duplicated.
- **SC-004**: Exported files open correctly in standard spreadsheet tools (e.g., Excel, LibreOffice Calc) without manual repair.
- **SC-005**: No summary, computed, or total rows appear in any exported file.

## Assumptions

- The Settings page already exists; this feature adds two export buttons to it without redesigning the page layout.
- "Raw data" means the stored field values as-is; no unit conversions, rounding, or formatting are applied during export.
- When a user has no rides, the ZIP will contain a single CSV with only the header row (rather than an empty ZIP), to ensure users always receive a usable file.
- The export is a one-off on-demand action; no scheduling, email delivery, or background processing is required.
- Exports are generated synchronously in the browser or triggered via the existing API without requiring a separate job queue.
- The column set for each CSV mirrors the fields available in the existing ride and expense data models; no new fields are introduced by this feature.
- Authentication and user-scoping use the existing session/auth mechanism already in place.
