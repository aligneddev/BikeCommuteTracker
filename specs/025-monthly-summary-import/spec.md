# Feature Specification: Monthly Summary Import (Auto-Split to Daily Rides)

**Feature Branch**: `025-monthly-summary-import`
**Created**: 2026-06-25
**Status**: Draft (revised)

---

## Summary

Rider pastes or uploads a Month/Miles/Days table. System distributes the monthly total miles evenly across `Days` weekdays within that calendar month, generating one individual ride record per day — using the same `Ride` entity as the existing per-ride CSV import. No separate monthly summary entity is introduced.

---

## Clarifications

### Session 2026-06-25

- Q: Should imported monthly summaries be stored as a separate aggregate or split into daily rides? → A: Auto-split monthly total across the weekdays of that month, producing individual ride records — keeps everything inside the existing daily ride structure.
- Q: What is the source of the cost-per-mile rate used to compute savings? → A: Reuse the existing system-wide configured cost-per-mile rate — the same single rate used for per-ride savings.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provide Monthly Summary Data (Priority: P1)

A rider has a table of monthly riding totals and wants to import it. They navigate to the import page, paste or upload a Month/Miles/Days table, select the year, preview the generated daily rides, and confirm.

**Why this priority**: Core capability. Nothing else matters without this.

**Independent Test**: Paste 3 months of data, confirm year, verify each month produced the correct number of ride records with miles summing to the monthly total (within floating-point tolerance).

**Acceptance Scenarios**:

1. **Given** a logged-in rider, **When** they navigate to the import section, **Then** they see a "Monthly Summary Import" option alongside existing import options.
2. **Given** the monthly import page, **When** the rider pastes whitespace-delimited or tab-delimited text with a header row (Month, Miles, Days) and data rows, **Then** the system parses the text and displays a preview of the generated daily ride records.
3. **Given** the monthly import page, **When** the rider uploads a plain-text or CSV file with the same column structure, **Then** the system parses the file and displays the same preview.
4. **Given** parsed data and a selected year, **When** the rider confirms import, **Then** individual ride records are created — one per distributed weekday — with miles = `floor(total_miles / days * 100) / 100` (2dp truncation) and any rounding remainder applied to the last ride of the month.
5. **Given** column headers with different casing (e.g., "month", "MILES"), **When** parsed, **Then** column matching is case-insensitive and succeeds.
6. **Given** a data source missing the required Miles or Days column, **When** parsed, **Then** the system rejects the input and displays a clear error naming the missing column(s).
7. **Given** a valid import completes, **When** the rider views the summary, **Then** they see total months processed, total ride records created, and any skipped/failed rows.

---

### User Story 2 - Weekday Distribution Logic (Priority: P1)

The system selects `Days` weekdays from the calendar month and assigns one ride per selected day. Days are spread as evenly as possible across the month (not front-loaded) to produce a realistic-looking distribution.

**Why this priority**: The distribution algorithm is the core of this feature. Without a well-defined rule the output is unpredictable and untestable.

**Independent Test**: Import May 2025 with 8 days. Verify exactly 8 ride records created, all falling on weekdays in May 2025, spread across the month (not all in the first two weeks), miles per ride summing to 96.

**Acceptance Scenarios**:

1. **Given** a month with `Days` ≤ number of weekdays in that month, **When** days are selected, **Then** exactly `Days` weekdays are selected, spread as evenly as possible (stride = floor(weekday_count / days)).
2. **Given** a month where `Days` > number of weekdays in that month, **When** validated, **Then** the row is flagged as invalid with a message stating days exceeds available weekdays.
3. **Given** selected weekdays and total miles, **When** miles are distributed, **Then** each ride gets `floor(total_miles / days * 100) / 100` miles and the remainder (due to rounding) is added to the last ride of the month, ensuring the sum equals total_miles exactly.
4. **Given** a generated ride record, **When** saved, **Then** it has: `Date` = the assigned weekday, `Miles` = computed per-day miles, no Time/Temp/Tags/Notes (nullable/empty), source tag `monthly-import` to distinguish it from manually entered rides.

---

### User Story 3 - Specify the Year (Priority: P1)

Monthly rows contain only a month name, not a full date. Before confirming, the rider selects the year. When months span a calendar-year boundary (e.g., Nov → Feb), the rider sets the starting year.

**Why this priority**: Without a year, every generated ride date is ambiguous. Incorrect year corrupts data.

**Independent Test**: Import months "November, December, January, February" with starting year 2025. Verify Nov–Dec assigned 2025, Jan–Feb assigned 2026.

**Acceptance Scenarios**:

1. **Given** imported months all within one calendar year, **When** rider selects that year, **Then** all generated rides fall in that year.
2. **Given** months spanning a year boundary, **When** rider sets starting year Y, **Then** months up to and including December → year Y; subsequent months → year Y+1.
3. **Given** no year selected, **When** viewing the import page, **Then** "Confirm Import" is disabled.
4. **Given** a year is selected and preview shown, **When** rider changes the year, **Then** preview updates ride dates before confirmation.

---

### User Story 4 - Duplicate Detection and Resolution (Priority: P1)

Before confirming, the system checks each generated ride date against existing ride records. Any date collision is surfaced for resolution using the existing duplicate resolution flow.

**Why this priority**: Re-importing the same month or overlapping with manually entered rides would silently double-count miles.

**Independent Test**: Import May 2025 (8 days), then import May 2025 again. Verify duplicate conflicts are shown for each colliding date; "Keep Existing" leaves the original ride; "Replace" overwrites it.

**Acceptance Scenarios**:

1. **Given** an existing ride on a date that matches a generated ride date, **When** preview is shown, **Then** that generated ride is flagged as a duplicate with existing and incoming values side-by-side.
2. **Given** a flagged duplicate, **When** rider chooses "Keep Existing," **Then** the generated ride for that date is skipped.
3. **Given** a flagged duplicate, **When** rider chooses "Replace with Import," **Then** the existing ride for that date is replaced.
4. **Given** multiple duplicates, **When** shown, **Then** "Override All Duplicates" option replaces all colliding dates without further prompts.

---

### Edge Cases

- **Days = 0 or negative**: Row flagged invalid; must be ≥ 1.
- **Miles ≤ 0**: Row flagged invalid; must be positive.
- **Days > weekdays in month**: Row flagged invalid with count of available weekdays.
- **Unrecognised month name** (e.g., "Jnauary"): Row flagged unparseable.
- **Intra-file duplicate months**: Same month appears twice in pasted data → flagged, rider must resolve before confirming.
- **Comma thousands separator** (e.g., "1,200.5"): Stripped and parsed as valid number.
- **Empty file / header only**: System displays "no data rows found" and does not proceed to preview.
- **No header row**: System attempts positional detection (Month, Miles, Days) and warns rider to confirm column mapping before proceeding.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a "Monthly Summary Import" entry point in the import/settings area, distinct from the existing per-ride CSV import.
- **FR-002**: The system MUST accept monthly summary data as pasted plain text (tab-delimited or whitespace-delimited) or uploaded plain-text/CSV files.
- **FR-003**: The system MUST parse input into rows with three fields — Month (text month name), Miles (positive decimal), Days (positive integer) — with case-insensitive column header matching. Miles values containing comma thousands-separators (e.g. "1,200.5") MUST be parsed by stripping commas before numeric conversion. Supported month names: full English names (January–December) and 3-letter ISO abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec); all other values are invalid. When no header row is detected, the system MUST attempt positional column detection (order: Month, Miles, Days) and display a warning requiring the rider to confirm column mapping before proceeding.
- **FR-004**: The system MUST require the rider to select a year before confirming; the confirm action is disabled until a year is chosen.
- **FR-005**: The system MUST correctly assign calendar years when the imported month sequence crosses a December-to-January boundary, using the selected starting year.
- **FR-006**: The system MUST validate each row: reject rows with unrecognised month names, non-positive miles, non-positive days, or days exceeding the number of weekdays in that calendar month.
- **FR-007**: The system MUST distribute total miles across exactly `Days` weekdays, selected with even stride (stride = max(1, floor(weekday_count / days))), with the first selected day being the stride-th weekday (1-indexed).
- **FR-008**: The system MUST assign per-day miles as `floor(total_miles / days * 100) / 100`, applying any rounding remainder to the last ride of the month so that ride miles sum exactly to total_miles.
- **FR-009**: The system MUST display a preview of all generated ride records (date, miles, duplicate status) before the rider confirms the import.
- **FR-010**: The system MUST detect date collisions between generated rides and existing ride records, surfacing them using the existing duplicate resolution flow (keep existing / replace with import / override all).
- **FR-011**: The system MUST flag intra-file duplicate months and require resolution before confirming.
- **FR-012**: The system MUST tag each generated ride with a `monthly-import` source marker to distinguish it from manually entered or per-ride CSV-imported rides.
- **FR-013**: The system MUST display an import summary on completion as an inline summary panel replacing the preview: months processed, ride records created, ride records replaced, ride records skipped, rows rejected.
- **FR-014**: Savings for each generated ride are computed automatically using the single system-wide configured cost-per-mile rate, identical to per-ride savings — no separate rate applies.
- **FR-015**: The system MUST write an audit log entry for each completed import operation recording: timestamp (UTC), rider ID, year(s) assigned, months parsed, ride records created, ride records replaced, ride records skipped, rows rejected, and any validation errors encountered. This entry is immutable once written.

### Key Entities

- **Generated Ride Record** (reuses existing `Ride` entity): Date (weekday), Miles (per-day decimal), source tag `monthly-import`, nullable Time/Temp/Tags/Notes.
- **Import Session** (transient): raw input, parsed monthly rows with validation status, year selection, generated ride records, duplicate resolutions. Discarded after completion or navigation away.

---

## Distribution Algorithm

```
For each (month, year, total_miles, days):
  weekdays = all Monday–Friday dates in (month, year)          // sorted ascending
  weekday_count = len(weekdays)
  if days > weekday_count → validation error

  stride = max(1, floor(weekday_count / days))
  selected = [weekdays[i * stride - 1] for i in 1..days]       // 1-indexed, stride-spaced

  per_day = floor(total_miles / days * 100) / 100              // 2 dp truncation
  remainder = total_miles - per_day * days

  rides = [{date: d, miles: per_day} for d in selected[0..days-2]]
  rides += [{date: selected[days-1], miles: per_day + remainder}]
```

---

## Success Criteria *(mandatory)*

- **SC-001**: Rider can complete full flow — paste, select year, preview, resolve duplicates, confirm — in under 3 minutes for a 12-month data set.
- **SC-002**: Sum of generated ride miles for each month equals the imported total_miles exactly (no floating-point loss).
- **SC-003**: All generated rides fall on weekdays; none fall on Saturdays or Sundays.
- **SC-004**: Re-importing the same month triggers duplicate detection for every colliding date; no silent overwrite.
- **SC-005**: 100% of invalid rows (bad month name, non-positive values, days > weekdays) surfaced before any records are written.
- **SC-006**: Generated rides appear immediately in the standard ride history view after import, tagged `monthly-import`.

---

## Assumptions

- Ride entity is reused as-is; no schema changes for a separate monthly aggregate.
- Weekdays = Monday through Friday; public holidays are not excluded (out of scope for initial version).
- English month names only (January–December and common abbreviations Jan–Dec) supported initially.
- Import is synchronous; data set is small (≤ 12 months, ≤ ~260 generated rides per year).
- The application has an existing import/settings area where the new entry point is added.
- Maximum file upload size follows existing limit (5 MB).
