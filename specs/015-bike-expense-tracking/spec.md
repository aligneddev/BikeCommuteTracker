# Feature Specification: Bike Expense Tracking

**Feature Branch**: `015-bike-expense-tracking`  
**Created**: 2026-04-17  
**Status**: Clarified  
**Input**: User description: "There are many expenses that occur with bike tracking. A new page, with a menu link needs to be created to allow the user to enter an expense and another to view and edit (use the existing ride history as a guide). The Date, amount, Note and upload a receipt (optional) is needed. Show the total amount of expenses on the dashboard. Some expenses are negative (savings) and are automatic: 1) every $3000 save x (based on the user settings: price per oil change). savings will just reduce from the expenses. Include these savings in the already existing savings for gas saved and mileage. Show the savings in the dashboard alongside of it so the user sees those"

## Clarifications

### Session 2026-04-17

- Q: Should riders be able to delete expenses? → A: Delete supported — same pattern as ride delete (spec 007); tombstone event retained in event log, expense removed from display.
- Q: Does the oil-change savings interval use lifetime cumulative miles or reset annually? → A: Lifetime cumulative — all-time ride miles, never resets.
- Q: Where are receipt files stored on the user's machine? → A: App data folder — receipts/ subfolder alongside the SQLite database file.
- Q: Should expense history support date range filtering? → A: Yes — same date range filter pattern as ride history.
- Q: What is the maximum note length for expense notes? → A: 500 characters — same as ride notes (spec 014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter a Manual Expense (Priority: P1)

As a rider, I want to record a bike-related expense with a date, amount, optional note, and optional receipt attachment so I can track what I actually spend on my bike.

**Why this priority**: Recording expenses is the foundation of all other expense features. Without this, there is no data to view, edit, or summarize.

**Independent Test**: Can be fully tested by navigating to the expense entry page, entering a date, positive amount, a note, and saving — then confirming the expense appears in the expense list with the correct values.

**Acceptance Scenarios**:

1. **Given** a signed-in rider on the expense entry form, **When** they enter a valid date, a positive amount, an optional note, and optionally attach a receipt, **Then** the expense is saved and the rider sees a success confirmation.
2. **Given** a rider does not provide a receipt, **When** they save the expense, **Then** the expense is saved successfully without requiring a receipt.
3. **Given** a rider does not enter a note, **When** they save the expense, **Then** the expense is saved successfully without requiring a note.
4. **Given** a rider attempts to save with a missing date or blank amount, **When** they submit, **Then** the save is blocked and clear field-level validation messages are shown.

---

### User Story 2 - View and Edit Expense History (Priority: P2)

As a rider, I want to see a list of my recorded expenses and be able to edit them in place, following the same pattern as the ride history page, so I can correct mistakes and keep records accurate.

**Why this priority**: Viewing and correcting recorded expenses is essential to maintaining accurate financial tracking over time.

**Independent Test**: Can be fully tested by viewing the expense list with at least one recorded expense, entering edit mode on a row, changing the amount or note, saving, and verifying the updated values appear in the list.

**Acceptance Scenarios**:

1. **Given** a signed-in rider with at least one saved expense, **When** they open the expense history page, **Then** they see a list of their expenses sorted by date (newest first) with date, amount, note preview, and receipt indicator.
2. **Given** a rider applies a date range filter, **When** the filter is confirmed, **Then** only expenses with dates within the selected range are shown and the visible total updates to reflect the filtered set.
3. **Given** a rider clears or resets the date range filter, **When** the filter is removed, **Then** all expenses are shown again.
4. **Given** a rider is viewing the expense list, **When** they activate edit mode on an expense row, **Then** the row becomes editable with save and cancel actions.
5. **Given** a row is in edit mode with valid changes, **When** the rider saves, **Then** the updated values are persisted and the row returns to read-only with the new values.
6. **Given** a row is in edit mode, **When** the rider cancels, **Then** the original values are restored and no change is saved.
7. **Given** a rider edits a row with invalid values, **When** they attempt to save, **Then** save is blocked and clear field-level validation messages are shown.

---

### User Story 3 - View Expense Totals on Dashboard (Priority: P3)

As a rider, I want the dashboard to show my total out-of-pocket expenses and my automatic oil-change savings so I can see at a glance whether my bike is saving me money overall.

**Why this priority**: The dashboard is the rider's primary summary view. Expenses without a dashboard summary miss the core value of the feature.

**Independent Test**: Can be fully tested by recording several expenses and confirming the dashboard shows the correct total expense amount and the automatically calculated oil-change savings alongside existing gas and mileage savings.

**Acceptance Scenarios**:

1. **Given** a rider has recorded expenses, **When** they view the dashboard, **Then** they see a total expense figure that sums all of their saved manual expenses.
2. **Given** a rider has accumulated enough ride miles for one or more oil-change intervals, **When** they view the dashboard, **Then** they see an automatic oil-change savings figure derived from their total ride miles and their saved oil change price setting.
3. **Given** a rider has automatic oil-change savings, **When** those savings are displayed, **Then** they appear alongside the existing gas-saved and mileage-saved figures in the savings section of the dashboard.
4. **Given** a rider has no expenses recorded yet, **When** they view the dashboard, **Then** the expense total shows zero and oil-change savings show based on accrued miles if applicable.

---

### User Story 4 - Automatic Oil-Change Savings Reduce Expense Total (Priority: P4)

As a rider, I want automatic oil-change savings to count as negative expenses that reduce my net expense total so the dashboard reflects my true financial position.

**Why this priority**: The user explicitly requested that automatic savings reduce the expense total, making this a required calculation rule rather than a display choice.

**Independent Test**: Can be fully tested by setting an oil change price in user settings, accumulating rides totaling at least 3000 miles, and confirming the net expense total on the dashboard equals manual expenses minus automatic oil-change savings.

**Acceptance Scenarios**:

1. **Given** a rider has a saved oil change price and cumulative ride miles of at least 3000, **When** the dashboard or expense total is calculated, **Then** every complete 3000-mile interval contributes one oil-change saving equal to the rider's saved oil change price.
2. **Given** a rider has automatic oil-change savings, **When** the net expense total is displayed, **Then** it equals total manual expenses minus total automatic oil-change savings (net total can be negative, indicating net savings).
3. **Given** a rider has not set an oil change price, **When** the dashboard loads, **Then** oil-change savings are shown as unavailable rather than zero and the expense total shows only manual expenses.
4. **Given** a rider updates their oil change price, **When** the dashboard is next loaded, **Then** oil-change savings recalculate using the new price while preserving all existing manual expense records.

---

### Edge Cases

- What happens when a rider has no expenses and no qualifying miles? The dashboard shows zero total expenses and explains that oil-change savings require an oil change price to be set.
- What happens if the receipt file is too large or an unsupported format? The save is blocked with a clear message showing accepted formats and size limits.
- What happens if a receipt cannot be stored due to a storage error? The expense is still saved without the receipt and the rider is notified that the receipt was not attached.
- What happens when a rider deletes a receipt from an existing expense? The expense remains but the receipt attachment is removed.
- What happens if a rider has 4500 miles? Only one complete 3000-mile interval counts; the remaining 1500 miles do not trigger a second oil-change saving.
- What happens if an expense amount is entered as a negative number? Manual expenses must be positive amounts; only automatic savings are treated as negative. The system blocks saving a negative manual expense with a clear validation message.
- What happens when a rider edits an expense and changes the amount but the receipt was already uploaded? The existing receipt remains associated unless the rider explicitly removes or replaces it.
- What happens when an expense has a very long note? Note text is capped at a defined maximum length with appropriate truncation in list view and full display in edit mode.
- What happens when the rider opens the expense list without being authenticated? Expenses are not shown and the rider is redirected to sign in.
- What happens when a rider deletes an expense that had a receipt attached? The receipt file is also removed from storage and the tombstone event records that the receipt was deleted.
- What happens when the same rider opens the same expense in two browser tabs and saves changes from both? The first save succeeds and increments the version; the second save is rejected with a version conflict and must be refreshed before retrying.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an expense entry page accessible from a named navigation menu link.
- **FR-002**: The expense entry form MUST require a date and a positive numeric amount.
- **FR-003**: The expense entry form MUST allow an optional plain-text note.
- **FR-004**: The expense entry form MUST allow an optional receipt attachment.
- **FR-005**: System MUST validate that the expense amount is a positive number before saving.
- **FR-006**: System MUST validate that a date is provided before saving and block saving with clear field-level messages when validation fails.
- **FR-007**: System MUST save expenses per rider so one rider cannot view or edit another rider's expenses.
- **FR-008**: System MUST provide an expense history page accessible from the navigation menu, styled and behaving consistently with the existing ride history page.
- **FR-008a**: The expense history page MUST support date range filtering using the same filter pattern as ride history; applying a filter MUST update both the displayed expense list and any visible expense total to reflect only the filtered date range.
- **FR-009**: The expense history list MUST display each expense's date, amount, note (truncated for space), and a receipt indicator, sorted by date with the newest first.
- **FR-010**: System MUST allow inline editing of an expense from the expense history page using the same save/cancel pattern as ride history.
- **FR-011**: System MUST validate edited expense fields using the same rules as entry and block save when validation fails.
- **FR-012**: System MUST persist expense edits as a new immutable event while retaining prior history for traceability.
- **FR-012a**: System MUST allow a rider to delete an expense from the expense history page using the same delete pattern as ride delete (spec 007).
- **FR-012b**: System MUST record expense deletion as a tombstone event in the event log; the expense MUST no longer appear in the expense history list or contribute to the dashboard expense total after deletion.
- **FR-013**: System MUST allow a rider to remove or replace an existing receipt attachment when editing an expense.
- **FR-014**: System MUST display the rider's total manual expense amount (sum of all saved positive expense amounts) on the dashboard.
- **FR-015**: System MUST automatically calculate oil-change savings as a derived dashboard value, not a stored expense row, based on the rider's **lifetime cumulative ride miles** (all-time, never reset) divided by 3000, rounded down to the nearest whole interval, multiplied by the rider's saved oil change price.
- **FR-016**: System MUST display oil-change savings on the dashboard alongside the existing gas-saved and mileage-saved figures.
- **FR-017**: System MUST subtract total automatic oil-change savings from total manual expenses to produce a net expense figure displayed on the dashboard.
- **FR-018**: When a rider's oil change price setting is not set, System MUST show oil-change savings as unavailable rather than zero and exclude the oil-change savings from the net expense calculation.
- **FR-019**: System MUST enforce a maximum note length of 500 characters for expense notes (consistent with ride notes, spec 014) and reject entries that exceed it.
- **FR-020**: System MUST enforce accepted file types and maximum file size for receipt uploads and show clear error messaging when a file does not meet those constraints. Accepted formats are JPEG, PNG, WEBP, and PDF. Maximum file size is 5 MB.
- **FR-021**: System MUST not expose expense records or receipt files to unauthenticated users.

### Key Entities *(include if feature involves data)*

- **Expense Record**: A rider-owned financial entry consisting of a required date, required positive amount, optional plain-text note, and optional receipt attachment. Stored as immutable events with full edit history.
- **Receipt Attachment**: An optional receipt file linked to an expense record. Stored as a file in a `receipts/` subfolder within the application data folder alongside the SQLite database. Supported formats are JPEG, PNG, WEBP, and PDF. Only accessible to the owning rider. The database record stores the file path/reference, not the binary content.
- **Oil-Change Saving**: An automatically calculated derived value that behaves like a negative expense in dashboard totals. It is derived from the rider's **lifetime cumulative ride miles** (all-time total, never reset) and their oil change price setting. Calculated as `floor(lifetime_ride_miles / 3000) × oil_change_price`. It is not a manually entered record and is not stored as its own expense row.
- **Net Expense Total**: The displayed financial summary on the dashboard: total manual expenses minus total oil-change savings. Can be negative (net savings).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A rider can navigate to the expense entry page, record a complete expense (with or without receipt), and see it reflected in the expense list in under 2 minutes.
- **SC-002**: 100% of manual expense records are isolated per rider — no rider can access another rider's expenses or receipt files.
- **SC-003**: The dashboard expense total and oil-change savings figure recalculate correctly whenever a new expense is recorded, a ride is added, or the oil change price setting is changed, with no stale figures shown to the rider.
- **SC-004**: A rider with cumulative ride miles of at least 3000 and a saved oil change price sees a non-zero oil-change savings figure on the dashboard, positioned alongside gas-saved and mileage-saved values.
- **SC-005**: At least 90% of riders in acceptance testing can locate the expense entry form and record a valid expense on their first attempt without assistance.
- **SC-006**: Receipt uploads that exceed size or format limits are rejected with a clear message before the rider loses other form data they have already entered.
