# Feature Specification: CSV Ride Import

**Feature Branch**: `013-csv-ride-import`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Allow the user to upload a csv for importing ride data in a new page linked from the settings page. Columns suggestions are |Date|Miles|Time|Temp|Tags|Notes|. Fill in the gas price and weather information using the cached data as much as possible. This process will take awhile, make sure the user is notified, then use a webhook with SignalR to notify the user in 25% increments. Give them an estimate in 5 minute approximations (if that can be determined). Validate for any duplicate based on the date, prompt the user to fix with details in a dialog before continuing. Give the user a override any duplicates option to bypass this."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload and Import a CSV File (Priority: P1)

A rider navigates to the Settings page and selects "Import Rides." They are presented with a dedicated import page where they can upload a CSV file containing historical ride data. The system reads the file, validates its structure and content, and — once the rider confirms — begins importing ride records into their account.

**Why this priority**: This is the core capability of the feature. Without the ability to upload, parse, and persist ride data from a CSV, no other functionality (enrichment, progress tracking, duplicate handling) matters.

**Independent Test**: Can be fully tested by uploading a valid CSV with 5–10 ride rows and confirming each row appears in the rider's ride history with the correct date, miles, time, temperature, tags, and notes.

**Acceptance Scenarios**:

1. **Given** a logged-in rider on the Settings page, **When** they click "Import Rides," **Then** the system navigates to a dedicated CSV import page.
2. **Given** the import page is displayed, **When** the rider selects a valid CSV file with columns Date, Miles, Time, Temp, Tags, and Notes, **Then** the system parses the file and displays a preview of the rows to be imported (showing count and a sample).
3. **Given** a valid CSV has been parsed and previewed, **When** the rider confirms the import, **Then** ride records are created for each row, associated with the authenticated rider.
4. **Given** a CSV file with header variations (e.g., "miles" vs "Miles" vs "MILES"), **When** uploaded, **Then** column matching is case-insensitive and succeeds.
5. **Given** a CSV with missing required columns (Date or Miles), **When** uploaded, **Then** the system rejects the file with a clear error message naming the missing columns.
6. **Given** a CSV with rows that fail validation (e.g., miles outside 0–200 range, unparseable date), **When** parsed, **Then** the system highlights invalid rows with specific error messages and excludes them from import while allowing valid rows to proceed.

---

### User Story 2 - Duplicate Detection and Resolution (Priority: P1)

During import, the system checks each row's date and miles against the rider's existing ride history. If duplicates are found (an existing ride with the same date and same miles value), the rider is prompted with a dialog showing the conflicting rows side-by-side (existing ride vs. incoming CSV row). The rider can resolve each duplicate individually, or use an "Override All Duplicates" toggle to skip duplicate checking entirely and import everything. Rides on the same date but with different mileage are treated as distinct trips and imported without prompting.

**Why this priority**: Without duplicate handling, importing a CSV could corrupt the rider's history with repeated entries — especially likely if the rider re-imports the same file or has partial data already recorded. This is a data-integrity concern and is co-equal with the core import.

**Independent Test**: Can be tested by first recording a ride for a specific date, then importing a CSV containing a row for that same date. Verify the duplicate dialog appears with correct details.

**Acceptance Scenarios**:

1. **Given** the rider has an existing ride on 2026-03-15 with 8.5 miles and the CSV contains a row dated 2026-03-15 with 8.5 miles, **When** the import begins, **Then** the system pauses and shows a duplicate-resolution dialog displaying both the existing ride and the incoming row details (date, miles, time, temp, tags, notes).
2. **Given** the duplicate dialog is displayed, **When** the rider chooses "Keep Existing," **Then** the CSV row for that date is skipped and the import continues with remaining rows.
3. **Given** the duplicate dialog is displayed, **When** the rider chooses "Replace with Import," **Then** the existing ride is superseded by the imported row (via a new corrective event) and the import continues.
4. **Given** a CSV with multiple duplicate dates, **When** the first duplicate is encountered, **Then** the dialog also offers an "Override All Duplicates" option. If selected, all remaining duplicates are imported without further prompts (creating new ride records alongside existing ones).
5. **Given** the rider enables "Override All Duplicates" before starting the import, **When** duplicates are encountered, **Then** all rows are imported without any duplicate prompts.

---

### User Story 3 - Real-Time Progress Notifications (Priority: P2)

Because importing many rides (with gas price and weather enrichment) can take a significant amount of time, the system provides real-time progress updates. After the rider confirms the import, the page displays a progress indicator. The system sends progress updates at 25% increments (25%, 50%, 75%, 100%) via a real-time connection. If the expected duration can be estimated, the system shows an approximate time remaining in 5-minute increments (e.g., "~10 minutes remaining").

**Why this priority**: Without progress feedback a long-running import feels broken. This is essential for user confidence, but the import itself must work first.

**Independent Test**: Can be tested by importing a CSV with 20+ rows and verifying that the progress indicator updates at least at the 25%, 50%, 75%, and 100% marks, and that the estimated time (when shown) decreases as work progresses.

**Acceptance Scenarios**:

1. **Given** the rider confirms an import of a CSV, **When** the import begins processing, **Then** the page shows a progress bar or percentage indicator starting at 0%.
2. **Given** import processing is underway, **When** 25% of rows have been processed, **Then** the system sends a real-time notification and the progress indicator updates to 25%.
3. **Given** import processing is underway, **When** 50%, 75%, and 100% of rows have been processed, **Then** the progress indicator updates accordingly at each milestone.
4. **Given** the system can estimate total processing time (based on rows processed so far), **When** a progress update is sent, **Then** an estimated time remaining is displayed, rounded to the nearest 5 minutes (e.g., "~5 minutes," "~10 minutes").
5. **Given** the import completes (100%), **When** the final notification is received, **Then** the progress indicator shows completion, a success summary displays (number of rides imported, number skipped, number failed), and the rider can navigate to their ride history.
6. **Given** the rider navigates away from the import page during processing, **When** they return to the import page, **Then** they see the current progress state (the import continues server-side regardless of page navigation).
7. **Given** an import is in progress, **When** the rider clicks a "Cancel Import" button, **Then** the server stops processing remaining rows, rows already imported are kept, and the summary shows how many rows were imported before cancellation.

---

### User Story 4 - Gas Price and Weather Enrichment (Priority: P2)

For each imported ride, the system automatically attempts to fill in gas price and weather data using a cache-first, weekly-dedup strategy.

**Gas price (weekly window)**: Gas prices are cached and fetched per Sunday–Saturday week, not per individual date, because the EIA API reports weekly national average prices. The system computes the Sunday that begins the week containing the ride's local date and uses that as the cache key. All rides in the same week share one cache entry — at most one external API call is made per distinct week across the entire import. If a cached entry for that week already exists, it is reused with no external call.

**Weather (date + noon default)**: Weather is cached per date and UTC hour at the rider's saved location. Because the CSV Time column represents ride *duration* (minutes), not a clock departure time, the system cannot derive a ride start hour from the CSV. Instead, weather is fetched for the ride's local date at noon (12:00 local, converted to UTC) as a consistent default. This matches the same fallback hour used for manual ride entry when no exact departure time is set.

**Failure handling**: If an external lookup fails, the system retries once. If the retry also fails, enrichment is skipped for that field on that ride and the import continues.

**Why this priority**: Enrichment adds significant value to imported rides, making them consistent with manually-entered rides. The weekly gas dedup strategy dramatically reduces external API calls for typical imports (e.g., a 200-row commute history spanning ~40 weeks needs at most 40 gas lookups instead of 200). However, enrichment depends on the core import working correctly and is not strictly required for ride records to be useful.

**Independent Test**: Can be tested by importing a CSV with rides on dates that have cached data (verifying cache hits), dates that do not (verifying external lookups are triggered and results cached), multiple rides in the same week (verifying one lookup shared across all), and a simulated API failure (confirming retry-then-skip behavior).

**Acceptance Scenarios**:

1. **Given** a cached gas price entry exists for the week of 2026-03-08 (Sunday) through 2026-03-14 (Saturday), **When** a CSV row dated 2026-03-10 (Tuesday) is imported, **Then** the resulting ride record includes the cached gas price (no external call made).
2. **Given** no cached gas price exists for the week of 2026-02-15 (Sunday) through 2026-02-21 (Saturday), **When** a CSV row dated 2026-02-20 (Friday) is imported, **Then** the system fetches the gas price from the external API for that week, caches one entry keyed to 2026-02-15, and attaches the price to the ride record.
3. **Given** no cached gas price exists and the external API call fails, **When** the system retries once and the retry also fails, **Then** the ride record is created with gas price left empty and the import continues.
4. **Given** a CSV contains two rows dated 2026-03-10 (Tuesday) and 2026-03-12 (Thursday) — both in the week of 2026-03-08 — and no cache entry exists for that week, **When** the import runs, **Then** exactly one external gas price API call is made, one cache entry is written, and both ride records receive the same gas price.
5. **Given** a CSV contains one row dated 2026-03-07 (Saturday) and one row dated 2026-03-08 (Sunday), **When** the import runs, **Then** two separate gas price lookups are made (one for the week of 2026-03-01, one for the week of 2026-03-08) because the dates fall in different Sunday–Saturday windows.
6. **Given** a cached weather record exists for 2026-03-10 at 12:00 UTC (noon) at the rider's location, **When** a CSV row dated 2026-03-10 is imported, **Then** the ride record includes the cached weather snapshot (temperature, wind, humidity, etc.) — the noon-default hour is matched.
7. **Given** no cached weather exists for 2026-03-14 at noon UTC at the rider's location, **When** a CSV row dated 2026-03-14 is imported, **Then** the system fetches weather for 2026-03-14 at noon UTC, caches it keyed to that date and hour, and attaches it to the ride record.
8. **Given** no cached weather data and the external API call fails, **When** the system retries once and the retry also fails, **Then** the ride record is created without weather data and the import continues.
9. **Given** a CSV row includes a Temp value and cached or fetched weather also has temperature data, **When** the row is imported, **Then** the user-provided Temp from the CSV takes precedence (enrichment fills only fields not supplied in the CSV).

---

### User Story 5 - Navigation and Access from Settings (Priority: P3)

The import functionality is discoverable from the Settings page via a clearly labeled link or button. The import page is only accessible to authenticated riders.

**Why this priority**: This is a navigation/access concern. It's low complexity but necessary for the feature to be usable in the app.

**Independent Test**: Can be tested by logging in, navigating to Settings, clicking "Import Rides," and confirming the import page loads. Also verify unauthenticated access redirects to login.

**Acceptance Scenarios**:

1. **Given** a logged-in rider on the Settings page, **When** they look for import functionality, **Then** a clearly labeled "Import Rides" link or button is visible.
2. **Given** an unauthenticated user, **When** they attempt to access the import page directly via URL, **Then** they are redirected to the login screen.

---

### Edge Cases

- What happens when the CSV file is empty (header row only, no data rows)? → System shows a message: "No ride data found in the uploaded file."
- What happens when the CSV is extremely large (e.g., 10,000+ rows)? → System accepts the file but warns the rider before import that it may take a long time. The maximum accepted file size is 5 MB.
- What happens when the CSV uses different date formats (MM/DD/YYYY vs YYYY-MM-DD vs DD-MMM-YYYY)? → System attempts common date formats and rejects rows with completely unparseable dates, listing them as errors.
- What happens when the rider uploads a non-CSV file (e.g., .xlsx, .pdf)? → System rejects the file with an error: "Please upload a .csv file."
- What happens if the real-time connection is lost during import? → The import continues server-side. When the rider reconnects or refreshes, they see the current state (in-progress with latest percentage, or completed with summary).
- What happens when a CSV row has extra columns beyond the expected six? → Extra columns are ignored silently.
- What happens when a CSV row has fewer columns than expected? → Missing optional columns are treated as empty. Missing required columns (Date, Miles) cause that row to be flagged as invalid.
- What happens when a CSV row is fully empty (all six columns blank, e.g., `,,,,,`)? → The row is skipped during parsing and excluded from preview/import totals.
- What happens when the rider starts a second import while one is already in progress? → The system prevents concurrent imports for the same rider, showing a message: "An import is already in progress."
- What happens when the rider cancels mid-import? → Processing stops after the current row finishes. All rides imported up to that point remain in the rider's history. The summary reflects the partial import (rows imported, rows remaining/cancelled).
- What happens when multiple rides exist on the same date in the rider's history? → Duplicate detection flags a match only when both date and miles are identical. A rider with a morning 8.5-mile commute and an evening 12-mile ride would not trigger a duplicate for either if the CSV rows have different mileage. If a CSV row matches on date+miles with any existing ride, the dialog shows all matching existing rides alongside the incoming row.
- What happens when an external gas price or weather API call fails during enrichment? → The system retries once. If the retry also fails, enrichment is skipped for that ride (the ride is still imported without that data) and the import continues with the next row.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated "Import Rides" page accessible from the Settings page.
- **FR-002**: System MUST accept CSV file uploads with the following columns: Date, Miles, Time, Temp, Tags, Notes.
- **FR-003**: System MUST match CSV column headers case-insensitively (e.g., "date," "DATE," and "Date" all map to the Date column).
- **FR-004**: System MUST validate that the CSV contains at least the required columns: Date and Miles.
- **FR-005**: System MUST validate each row against existing ride-entry rules: miles between 0 and 200 (exclusive of zero), parseable date, optional positive duration for Time.
- **FR-006**: System MUST display a preview of parsed CSV data (row count, sample rows, any validation errors) before the rider confirms the import.
- **FR-007**: System MUST create ride records for each valid row, associated with the authenticated rider, preserving all provided fields (date, miles, time, temperature, tags, notes).
- **FR-008**: System MUST detect duplicate rides by comparing each CSV row's date and miles against the rider's existing ride history. A duplicate is flagged only when both date and miles match an existing ride.
- **FR-009**: System MUST present a duplicate-resolution dialog when a date+miles conflict is found, showing the existing ride and incoming row side by side, with options to "Keep Existing," "Replace with Import," or "Override All Duplicates."
- **FR-010**: System MUST provide an "Override All Duplicates" option (available before import starts or at the first duplicate prompt) that bypasses all subsequent duplicate checks and imports all rows.
- **FR-011**: System MUST send real-time progress notifications at 25% processing increments (25%, 50%, 75%, 100%) via a persistent connection.
- **FR-012**: System MUST display an estimated time remaining (rounded to the nearest 5 minutes) once enough rows have been processed to compute a rate, showing "Estimating…" until that point.
- **FR-013**: System MUST enrich each imported ride with cached gas price data when a cache entry exists for the Sunday–Saturday week window containing the ride's local date.
- **FR-014**: System MUST enrich each imported ride with cached weather data when a cache entry exists for the ride's local date at noon (12:00 local, converted to UTC) at the rider's saved location.
- **FR-015**: System MUST attempt external API lookups for gas price and weather data when no cached data exists for the ride's week window (gas price) or date at noon UTC (weather). On failure, the system MUST retry once; if the retry also fails, enrichment for that field is skipped and the import continues.
- **FR-025**: System MUST deduplicate gas price API calls by week window during import. Before processing rows, the system MUST group all valid rows by their Sunday–Saturday week key, fetch or load the cache for each distinct week (at most one external call per week), and apply the resolved price to all rows sharing that week. The week key is the Sunday date that begins the ISO-week window containing the ride's local date.
- **FR-016**: System MUST give CSV-provided values (e.g., Temp) precedence over cached data when both are available for the same field.
- **FR-017**: System MUST prevent concurrent imports for the same rider.
- **FR-018**: System MUST continue processing the import server-side even if the rider navigates away from the import page.
- **FR-019**: System MUST display a completion summary after import finishes: total rows processed, rides imported, rides skipped (duplicates kept), rows failed (validation errors).
- **FR-020**: System MUST reject non-CSV files with a clear error message.
- **FR-021**: System MUST enforce a maximum file size of 5 MB for uploaded CSV files.
- **FR-022**: System MUST restrict import page access to authenticated riders only.
- **FR-023**: System MUST allow the rider to cancel an in-progress import. Cancellation stops processing of remaining rows; rides already imported are kept and not rolled back.
- **FR-024**: System MUST throttle external API lookups (gas price and weather) to a maximum of 4 calls per second during import to avoid hitting external API rate limits.
- **FR-026**: System MUST skip fully empty CSV rows (all mapped fields blank) during parsing, excluding those rows from preview/import totals and validation counts.

### Key Entities

- **Import Job**: Represents a single CSV import operation. Attributes: rider identity, upload timestamp, file name, total row count, processed row count, status (pending, validating, awaiting-confirmation, processing, completed, failed), estimated completion time.
- **Import Row**: A single parsed row from the CSV. Attributes: row number, date, miles, time (duration in minutes), temperature, tags, notes, validation status (valid/invalid with error details), duplicate status (none/duplicate), resolution (import/skip/override).
- **Import Summary**: The outcome of a completed import. Attributes: total rows, rides imported count, rides skipped count, rows failed count, enrichment stats (gas prices attached count, weather snapshots attached count), duration of import.
- **Duplicate Conflict**: Represents a date-based conflict between an incoming CSV row and existing ride(s). Attributes: conflicting date, existing ride details (miles, time, temp, tags, notes), incoming row details, rider resolution choice.
- **Gas Price Week Key**: The Sunday date that starts the Sunday–Saturday week window containing a ride's local date. Used as the gas price cache lookup key so that all rides within the same week share one cache entry.

## Assumptions

- The rider's CSV decoding is BOM-aware. UTF-8 and UTF-16 BOM-encoded files are supported; files without BOM default to UTF-8 decoding.
- Date formats attempted during parsing include: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, DD-MMM-YYYY, and MMM DD YYYY. Dates that don't match any recognized format are flagged as invalid.
- The Tags column may contain comma-separated or semicolon-separated tag values within a single cell.
- The Notes column may contain free-text of any length (within reason given file size limits).
- The Time column represents ride *duration* in minutes (e.g., "45") or H:MM format (e.g., "1:30" for 90 minutes). It is not a clock departure time and cannot be used to derive the hour of day for weather lookups.
- The Temp column represents temperature in the same unit used throughout the app (Fahrenheit, per U.S.-centric gas price data).
- A 5 MB file size limit accommodates roughly 50,000+ ride rows, which far exceeds expected usage for a personal commute tracker.
- The estimated time calculation begins after at least 10% of rows have been processed, to avoid wildly inaccurate early estimates.
- **Gas price week key calculation**: The week key is the Sunday date that begins the week containing a ride's local date. For example, 2026-03-10 (Tuesday) maps to week key 2026-03-08 (Sunday). Week boundaries are computed from the ride's local date as recorded in the CSV Date column; UTC offset is not applied for this calculation.
- **Weather lookup hour**: Because the CSV Time column is duration-only, weather is always fetched for the ride's local date at noon (12:00) converted to UTC using the rider's saved location timezone offset. This is the same fallback used for manual ride entry, ensuring cache reuse between manually-entered rides and imported rides on the same date.
- **Weekly gas deduplication effect on API calls**: Before any API calls are made, the import pre-groups all valid rows by their Sunday week key. At most one external gas price call is made per distinct week regardless of how many rows share that week. For a 200-row import spanning ~40 distinct weeks, this reduces gas lookups from up to 200 to at most 40 (plus at most 1 weather call per distinct date). At 4 calls/sec throttle, enrichment adds approximately 20–30 seconds for the gas phase rather than 50 seconds.
- The throttle of 4 calls/sec applies to the combined gas + weather external call stream. Cache hits do not count against the rate.
- The "Override All Duplicates" option creates new ride records alongside existing ones (does not replace or merge).

## Clarifications

### Session 2026-04-08

- Q: When an external gas price or weather API call fails during enrichment, what should happen? → A: Retry once, then skip enrichment for that ride if the retry also fails.
- Q: Should duplicate detection match on date only, or include additional fields to reduce false positives? → A: Date + Miles — flag as duplicate only when both date and miles match an existing ride.
- Q: Can the rider cancel an in-progress import, and what happens to already-imported rows? → A: Yes, cancel stops processing; rows already imported are kept (not rolled back).
- Q: Should external API lookups be throttled during bulk enrichment to avoid rate limits? → A: Yes, throttle to 4 calls per second.

### Session 2026-04-09

- Q: Should gas price lookups be deduplicated across rows sharing the same week during import, rather than fetching once per distinct date? → A: Yes. The EIA API reports weekly national average prices, so one price per Sunday–Saturday window is the correct granularity. Gas prices are cached and fetched by week key (Sunday start date). All rows in the same week reuse one cache entry, reducing external API calls significantly.
- Q: Can the import use parallel or batched enrichment instead of serial per-row lookups? → A: Yes, with caveats. Gas price lookups should be pre-computed by grouping all valid rows by week key, fetching each distinct week in a controlled loop (honoring the 4 calls/sec throttle), and then applying the results to all rows before the row-processing loop begins. Weather lookups can follow the same pattern grouped by distinct date. Parallel API calls within the batch are allowed up to the 4 calls/sec budget (e.g., using a SemaphoreSlim token bucket), but the underlying EF DbContext must remain single-threaded — lookups resolve results into memory before the row loop writes to the DB.
- Q: The CSV Time column is ride duration, not a clock start time. How should weather lookup determine the correct hour? → A: Use noon (12:00) in the rider's local timezone as the default lookup hour for all CSV-imported rides. This is consistent with the manual ride entry fallback and maximises cache reuse. If a future CSV column (e.g., StartTime) is added, that value would take precedence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider can import a 100-row CSV file and see all valid, non-duplicate rides appear in their ride history within 5 minutes.
- **SC-002**: Progress notifications are received at each 25% increment (±2% tolerance) during an import of 20 or more rows.
- **SC-003**: Estimated time remaining, when displayed, is accurate to within one 5-minute increment of the actual remaining time for imports exceeding 5 minutes.
- **SC-004**: 100% of duplicate date+miles rows are detected and presented to the rider before import completes (when "Override All Duplicates" is not enabled).
- **SC-005**: Gas price and weather data (from cache or external lookup) are attached to at least 95% of imported rides where the data is obtainable (week-window match for gas, date+noon-hour match for weather).
- **SC-006**: Riders can complete the full import flow (upload → preview → confirm → completion) without needing external documentation or support.
- **SC-007**: Invalid rows are clearly identified with specific error messages (field name + reason) and do not prevent valid rows from being imported.
- **SC-008**: The import page is reachable from the Settings page in one click/tap.
