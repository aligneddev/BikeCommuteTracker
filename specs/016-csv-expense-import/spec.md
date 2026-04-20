# Feature Specification: CSV Expense Import

**Feature Branch**: `016-csv-expense-import`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: User description: "Allow importing of expenses. Follow the same overall approach as spec 013 (CSV Ride Import). Columns needed are Date, Amount, Note. Receipts can not be imported, only added in the expense history editing."

## Clarifications

### Session 2026-04-20

- Q: Should duplicate detection match on date only, or date + amount? → A: Date + Amount — flag as duplicate only when both date and amount match an existing expense.
- Q: Should the import be linked from the Expenses history page or from Settings? → A: Link from the Expenses history page (same vicinity as the existing expense entry button).
- Q: Is real-time progress (SignalR) needed since there is no enrichment? → A: No SignalR required — expenses have no gas price or weather enrichment, so import completes fast. Simple confirmation + synchronous execution with a summary on completion is sufficient.
- Q: What is the maximum file size? → A: 5 MB, matching the ride import limit.
- Q: Can the rider cancel a running import? → A: Import is synchronous (no enrichment); cancel is not applicable. Rider may navigate away and return — import result is available immediately upon completion.
- Q: What is the Note column max length? → A: 500 characters, matching the expense note limit from spec 015.
- Q: When "Replace with Import" is chosen and the incoming CSV row has a blank Note, what happens to the existing note? → A: Preserve existing note — only date and amount are updated; a blank CSV Note never overwrites an existing note.
- Q: If a CSV contains two rows with the same date and amount (intra-file), is the second treated as a duplicate of the first? → A: No — intra-file rows are never compared against each other. Duplicate detection only compares incoming rows against already-saved expenses in history.
- Q: What should happen when an Amount value has trailing non-numeric text (e.g. "25.00 USD" or "12.50 GBP")? → A: Strip trailing currency codes — extract the leading numeric portion; if the result is a valid positive number, accept it. Unexpected formats that don't yield a valid positive decimal are still flagged as invalid.
- Q: How long should a completed import job and its parsed row data be retained? → A: Session only — the import job record and its rows are deleted once the rider navigates away from the summary page. There is no long-term import history.
- Q: Should the system enforce a per-cell size limit in addition to the 5 MB file cap? → A: File cap only — rely on the 5 MB file size limit and existing field-level validation (Note ≤ 500 chars, Amount must parse). No separate per-cell byte limit is needed.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload and Import an Expense CSV File (Priority: P1)

A rider navigates to the Expenses page and selects "Import Expenses." They are presented with a dedicated import page where they can upload a CSV file containing historical expense data. The system reads the file, validates its structure and content, and — once the rider confirms — imports the expense records into their account.

**Why this priority**: This is the core capability of the feature. Without the ability to upload, parse, and persist expense data from a CSV, no other functionality (duplicate handling, preview) matters. Receipts are intentionally excluded from import; they must be attached individually via the expense history edit flow.

**Independent Test**: Can be fully tested by uploading a valid CSV with 5–10 expense rows and confirming each row appears in the rider's expense history with the correct date, amount, and note.

**Acceptance Scenarios**:

1. **Given** a logged-in rider on the Expenses page, **When** they click "Import Expenses," **Then** the system navigates to a dedicated CSV expense import page.
2. **Given** the import page is displayed, **When** the rider selects a valid CSV file with columns Date and Amount (Note is optional), **Then** the system parses the file and displays a preview of the rows to be imported (showing count and a sample).
3. **Given** a valid CSV has been parsed and previewed, **When** the rider confirms the import, **Then** expense records are created for each valid row, associated with the authenticated rider.
4. **Given** a CSV file with header variations (e.g., "amount" vs "Amount" vs "AMOUNT"), **When** uploaded, **Then** column matching is case-insensitive and succeeds.
5. **Given** a CSV with missing required columns (Date or Amount), **When** uploaded, **Then** the system rejects the file with a clear error message naming the missing columns.
6. **Given** a CSV with rows that fail validation (e.g., amount ≤ 0, unparseable date, note exceeding 500 characters), **When** parsed, **Then** the system highlights invalid rows with specific error messages and excludes them from import while allowing valid rows to proceed.
7. **Given** a completed import, **When** the rider views the summary, **Then** they see total rows processed, expenses imported, expenses skipped (duplicates kept), and rows failed (validation errors).
8. **Given** a CSV row with a Note value that exceeds 500 characters, **When** parsed, **Then** the row is flagged as invalid with a message indicating the note is too long.

---

### User Story 2 - Duplicate Detection and Resolution (Priority: P1)

During import, the system checks each row's date and amount against the rider's existing expense history. If a duplicate is found (an existing expense with the same date and the same amount), the rider is prompted with details showing the conflicting rows side-by-side. The rider can resolve each duplicate individually or use an "Override All Duplicates" option to bypass duplicate checking and import everything.

**Why this priority**: Without duplicate handling, re-importing the same file could create repeated expense entries and corrupt financial totals. This is a data-integrity concern co-equal with the core import.

**Independent Test**: Can be tested by first recording an expense for a specific date and amount, then importing a CSV containing a row for that same date and amount. Verify the duplicate conflict is surfaced with correct details.

**Acceptance Scenarios**:

1. **Given** the rider has an existing expense on 2026-03-15 with amount $25.00 and the CSV contains a row dated 2026-03-15 with amount 25.00, **When** the preview is processed, **Then** the system flags that row as a duplicate and displays the conflicting details (date, amount, note) for both the existing expense and the incoming row.
2. **Given** a duplicate conflict is displayed in the preview, **When** the rider chooses "Keep Existing" for that row, **Then** the CSV row is skipped and the import continues with remaining rows.
3. **Given** a duplicate conflict is displayed in the preview, **When** the rider chooses "Replace with Import," **Then** the existing expense is updated with the imported row's values (via a new edit event) and the import continues.
4. **Given** a CSV with multiple duplicate rows, **When** conflicts are displayed in the preview, **Then** the rider may also select "Override All Duplicates" to import all rows without further prompts (creating new expense records alongside existing ones).
5. **Given** the rider enables "Override All Duplicates" before confirming the import, **When** duplicates are encountered, **Then** all rows are imported without any duplicate prompts, creating new expense records.
6. **Given** two expenses on the same date but with different amounts (e.g., $25.00 and $40.00), **When** one is in the existing history and the other is in the CSV, **Then** no duplicate is flagged — both amounts are distinct trips and are imported without prompting.

---

### User Story 3 - Navigation and Access from Expenses Page (Priority: P2)

The import functionality is discoverable from the Expenses page via a clearly labeled link or button. The import page is only accessible to authenticated riders. Receipts cannot be imported; a note in the UI informs riders that receipts must be attached individually via the expense history edit flow.

**Why this priority**: Navigation and access are low-complexity but necessary for the feature to be usable and discoverable in the app.

**Independent Test**: Can be tested by logging in, navigating to the Expenses page, clicking "Import Expenses," and confirming the import page loads. Also verify unauthenticated access redirects to login.

**Acceptance Scenarios**:

1. **Given** a logged-in rider on the Expenses page, **When** they look for import functionality, **Then** a clearly labeled "Import Expenses" link or button is visible near the existing expense entry controls.
2. **Given** the import page is displayed, **When** the rider reads the page instructions, **Then** a note is visible stating that receipts cannot be imported and must be attached individually via the expense history edit page.
3. **Given** an unauthenticated user, **When** they attempt to access the import page directly via URL, **Then** they are redirected to the login screen.

---

## Edge Cases

- What happens when the CSV file is empty (header row only, no data rows)? → System shows a message: "No expense data found in the uploaded file."
- What happens when the CSV is extremely large (e.g., 10,000+ rows)? → System accepts the file but warns the rider before import that it may take a moment. The maximum accepted file size is 5 MB.
- What happens when the CSV uses different date formats (MM/DD/YYYY vs YYYY-MM-DD vs DD-MMM-YYYY)? → System attempts common date formats and rejects rows with completely unparseable dates, listing them as errors.
- What happens when the rider uploads a non-CSV file (e.g., .xlsx, .pdf)? → System rejects the file with an error: "Please upload a .csv file."
- What happens when a CSV row has extra columns beyond the expected three? → Extra columns are ignored silently.
- What happens when a CSV row has fewer columns than expected? → Note is optional and treated as empty when absent. Missing required columns (Date or Amount) cause that row to be flagged as invalid.
- What happens when a CSV row is fully empty (all columns blank)? → The row is skipped during parsing and excluded from preview/import totals.
- What happens when a CSV Amount value is formatted with currency symbols (e.g., "$25.00" or "£10")? → Currency symbols are stripped during parsing and the numeric value is extracted. If the result is not a valid positive decimal, the row is flagged as invalid.
- What happens when an Amount value has trailing text such as "25.00 USD" or "12.50 GBP"? → The system extracts the leading numeric portion by stripping the trailing currency code. If the result is a valid positive decimal, the row is accepted. Any trailing text that does not match a recognized currency code pattern causes the row to be flagged as invalid.
- What happens when a CSV Amount value is zero or negative? → The row is flagged as invalid with a message: "Amount must be greater than zero."
- What happens when the rider starts a second import while one is already in progress? → Import is synchronous and completes before the user can trigger a second. No concurrent-import guard is required.
- What happens when multiple expenses exist on the same date in the rider's history? → Duplicate detection flags a match only when both date and amount are identical. A rider with two expenses on the same date but different amounts (e.g., $10.00 and $25.00) would not trigger a duplicate for either if the CSV rows have different amounts. If a CSV row matches on date+amount with any existing expense, the preview flags all matching existing expenses alongside the incoming row.
- What happens when a CSV contains two rows with the same date and amount (intra-file)? → Both rows are treated as distinct import candidates. Duplicate detection only compares incoming rows against already-saved history, not against other rows within the same CSV.
- What happens to import job data after the rider leaves the summary page? → The import job record and all associated row records are deleted. Only the actual imported expense records are retained. The rider can review their imported expenses in expense history.

---

## Known Limitations

**Receipt Attachment**: Receipts cannot be imported via CSV. Riders who have scanned receipt images must attach them manually via the expense history edit page after import. This is a deliberate design decision to avoid file upload complexity during bulk import.

**Preview Performance**: The preview phase (CSV parsing + duplicate detection) loads all rider expenses into memory and checks each CSV row against the full history. For riders with very large expense histories (1000+ expenses) or large CSV uploads (500+ rows), the preview operation may take a few seconds. **Mitigation**: A preview spinner is displayed during the preview phase.

**No Progress Updates**: Because expense import has no enrichment (no gas price or weather lookups), the import is expected to complete within seconds for typical data volumes and does not require real-time progress notifications.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated "Import Expenses" page accessible from the Expenses page.
- **FR-002**: System MUST accept CSV file uploads with the following columns: Date, Amount, Note (Note is optional).
- **FR-003**: System MUST match CSV column headers case-insensitively (e.g., "date," "DATE," and "Date" all map to the Date column).
- **FR-004**: System MUST validate that the CSV contains at least the required columns: Date and Amount.
- **FR-005**: System MUST validate each row: parseable date, amount greater than zero, note ≤ 500 characters when provided.
- **FR-006**: System MUST display a preview of parsed CSV data (row count, valid count, invalid count, sample rows, any validation errors, and any detected duplicates) before the rider confirms the import.
- **FR-007**: System MUST create expense records for each valid non-skipped row, associated with the authenticated rider, preserving all provided fields (date, amount, note).
- **FR-008**: System MUST NOT import receipts. A note in the UI must inform the rider that receipts must be attached individually via the expense history edit page.
- **FR-009**: System MUST detect duplicate expenses by comparing each CSV row's date and amount against the rider's existing expense history. A duplicate is flagged only when both date and amount match.
- **FR-010**: System MUST present duplicate conflicts in the preview response, showing the existing expense and incoming row details (date, amount, note) for each conflict, with options to "Keep Existing" or "Replace with Import." When "Replace with Import" is chosen, the existing expense's date and amount are updated with the CSV row values; the note is updated only when the CSV row provides a non-blank note value — a blank CSV note preserves the existing note unchanged.
- **FR-011**: System MUST provide an "Override All Duplicates" option that bypasses all per-row duplicate checks and imports all valid rows (creating new expense records alongside existing ones).
- **FR-012**: System MUST display a completion summary after import finishes: total rows processed, expenses imported, expenses skipped (duplicates kept), and rows failed (validation errors).
- **FR-013**: System MUST reject non-CSV files with a clear error message.
- **FR-014**: System MUST enforce a maximum file size of 5 MB for uploaded CSV files.
- **FR-015**: System MUST restrict import page access to authenticated riders only.
- **FR-016**: System MUST skip fully empty CSV rows (all mapped fields blank) during parsing, excluding those rows from preview/import totals and validation counts.
- **FR-017**: System MUST normalize Amount values before parsing: strip leading/trailing whitespace, remove leading currency symbols (`$`, `£`, `€`, `¥`), remove trailing ISO currency codes (e.g., `USD`, `GBP`, `EUR`), and remove thousands-separator commas. If the resulting string does not parse to a valid positive decimal, the row is flagged as invalid.
- **FR-018**: System MUST handle Amount values with commas as thousands separators (e.g., "1,250.00" → 1250.00).
- **FR-019**: System MUST delete the import job record and all associated import row records when the rider navigates away from the import summary page. Import job data is session-scoped and is not retained beyond the current import session.

### Key Entities

- **Expense Import Job**: Represents a single CSV expense import operation. Attributes: rider identity, upload timestamp, file name, total row count, valid row count, invalid row count, imported row count, skipped row count, status (previewing, awaiting-confirmation, processing, completed, failed).
- **Expense Import Row**: A single parsed row from the CSV. Attributes: row number, date, amount, note, validation status (valid/invalid with error details), duplicate status (none/duplicate), resolution (import/skip/override).
- **Expense Import Summary**: The outcome of a completed import. Attributes: total rows, expenses imported count, expenses skipped count, rows failed count.
- **Duplicate Conflict**: Represents a date+amount conflict between an incoming CSV row and an existing expense. Attributes: conflicting date, conflicting amount, existing expense details (date, amount, note), incoming row details.

## Assumptions

- The rider's CSV decoding is BOM-aware. UTF-8 and UTF-16 BOM-encoded files are supported; files without BOM default to UTF-8 decoding.
- Date formats attempted during parsing include: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY, DD-MMM-YYYY, and MMM DD YYYY. Dates that don't match any recognized format are flagged as invalid.
- The Note column may contain free-text of up to 500 characters.
- Amount values may include a leading currency symbol (`$`, `£`, `€`, `¥`) and thousands separators (commas). These are stripped before numeric parsing.
- A 5 MB file size limit accommodates roughly 50,000+ expense rows, which far exceeds expected usage for a personal commute tracker.
- The import is synchronous (completes in a single request/response cycle for preview, then a second for confirm+execute). No background job or SignalR is required.
- The "Override All Duplicates" option creates new expense records alongside existing ones (does not replace or merge).
- Imported expenses have no receipt attached. Receipts must be added individually via the expense history edit page.
