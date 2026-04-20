# Research: CSV Expense Import

**Feature**: 016-csv-expense-import
**Date**: 2026-04-20
**Status**: Complete

## Decision 1: Import processing model

**Decision**: Use a two-phase synchronous import model (preview then confirm) without a persisted background job. Phase 1 uploads and validates the CSV, returning a preview response with a short-lived import token. Phase 2 accepts the token plus duplicate resolutions and executes the import synchronously, returning a completion summary.

**Rationale**:
- Expense import has no enrichment (no gas price or weather lookups), so the processing time for typical imports (hundreds of rows) is well under one second.
- A persisted job with polling or real-time progress (as in spec 013) adds significant complexity — import job entities, status endpoints, and reconnect logic — that provides no user benefit when the import completes faster than the user can react.
- A short-lived server-side preview state (cached by job ID, expires in 30 minutes) allows the rider to review duplicates and make resolution choices before confirming, maintaining the same two-step UX as spec 013 without the background job overhead.

**Alternatives considered**:
- Persisted import job with polling (spec 013 model): rejected because expense enrichment does not exist; there is no long-running work to track.
- Single-request upload+import (no preview): rejected because preview is required by spec for duplicate detection and validation feedback before committing.
- In-memory job keyed by session: rejected because server restarts between preview and confirm would lose the parsed state; a lightweight EF-persisted import record (status: `awaiting-confirmation`) avoids this.

**Resolution**: Use a lightweight persisted `ExpenseImportJob` entity (single table, minimal columns) to survive server restarts between preview and confirm. Once confirmed and completed, the job record is retained for traceability (status: `completed`). No background processing thread or SignalR hub is introduced.

---

## Decision 2: CSV schema and validation strategy

**Decision**: Parse headers case-insensitively. Require `Date` and `Amount`; treat `Note` as optional. Validate each row independently and allow valid rows to proceed while reporting invalid rows.

**Rationale**:
- Matches existing expense validation expectations (date required, amount > 0, note ≤ 500 chars).
- Independent row validation prevents one bad row from blocking the entire import.
- Maintains user trust by showing specific field-level errors per row.
- Stripping currency symbols and commas from Amount follows user expectation when exporting from spreadsheet tools.

**Alternatives considered**:
- Strict all-or-nothing file validation: rejected because it blocks valid data unnecessarily.
- Flexible free-form column mapping UI in v1: rejected as out of scope.

---

## Decision 3: Duplicate detection policy

**Decision**: Duplicate key is `(date, amount)` against existing active (non-deleted) rider expenses. Provide per-conflict choices (`keep existing`, `replace with import`) shown in the preview response. Also provide an `override-all-duplicates` bypass option.

**Rationale**:
- Date-only matching creates false positives when a rider has multiple expenses on the same day (e.g., fuel + parking).
- Date+amount provides a low-false-positive key for personal expense tracking with small datasets.
- Explicit resolution choices in the preview flow satisfy data-integrity and user override requirements (mirrors spec 013's approach).

**Alternatives considered**:
- Date-only duplicate key: rejected due to false positives for multi-expense days.
- Date+amount+note key: rejected for being too strict when source CSV omits notes.

---

## Decision 4: Receipt handling in import

**Decision**: Receipts are excluded from the CSV import flow entirely. Imported expenses are created without a receipt. The import UI displays a persistent note informing riders that receipts must be attached individually via the expense history edit page.

**Rationale**:
- Bulk CSV import of binary receipt files would require multipart upload of potentially hundreds of files, complex path management, and significant error surface.
- Receipt attachment is low-frequency (most expenses don't have digital receipts); forcing batch import capability is over-engineering for v1.
- The spec requirement explicitly excludes receipts from import.

---

## Decision 5: Currency symbol and format normalization

**Decision**: Before parsing Amount to a decimal, strip leading/trailing whitespace, remove common currency symbols (`$`, `£`, `€`, `¥`), and remove thousands-separator commas. The resulting string must parse to a positive decimal or the row is flagged as invalid.

**Rationale**:
- Users exporting from spreadsheet tools (Excel, Google Sheets) frequently include currency formatting in amount columns.
- Stripping these characters silently reduces friction without loss of data integrity, since the semantic value (numeric amount) is preserved.
- Negative values and zero are always invalid for expense amounts per spec 015.

---

## Decision 6: Import page entry point

**Decision**: Link "Import Expenses" from the Expenses history page (not the Settings page).

**Rationale**:
- Expense import is contextually related to the expense history view, not general application settings.
- The ride CSV import (spec 013) is linked from Settings because it is a one-time historical data migration; expense import is expected to be used more regularly as riders maintain financial records from external tools.
- Proximity to the expense history list allows the rider to immediately verify imported expenses after the import completes.

**Alternatives considered**:
- Link from Settings page: considered but rejected as the expense import is contextually closer to the expense history page.
- Link from both pages: deferred to a later phase if discoverability is identified as an issue.
