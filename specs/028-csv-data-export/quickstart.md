# Quickstart: CSV Data Export — Validation Guide

This guide describes how to validate that the CSV Data Export feature works end-to-end after implementation. Use it to confirm both export buttons on the Settings page work as specified.

## Prerequisites

- App running via Aspire: `dotnet run --project src/BikeTracking.AppHost`
- Aspire Dashboard open at http://localhost:19629
- At least one user account with rides and expenses seeded (manual or via the Record Ride / Record Expense flows)

## Scenario 1 — Export Expenses (single CSV)

### Setup

Seed at least 3 expense records for the test user, including one with a note containing a comma (e.g., `"Chain, lube"`).

### Steps

1. Log in as the test user.
2. Navigate to **Settings** (`/settings`).
3. Click the **"Export Expenses"** button.
4. Observe: a file download is triggered immediately.

### Expected outcomes

| Checkpoint | Expected |
|------------|---------|
| File name | `expenses-export.csv` |
| HTTP response code from API | `200 OK` |
| First row of file | `ExpenseId,Date,Amount,Notes,CreatedAtUtc` |
| Data rows | One per expense record; no totals or summary rows |
| Record count | Matches the number of expenses recorded |
| Notes with commas | Properly quoted (e.g., `"Chain, lube"`) |
| Notes that are blank | Empty cell (no placeholder text) |
| File opens in Excel/LibreOffice | Columns parsed correctly without manual repair |

### Empty dataset check

Create a fresh user with no expenses. Click "Export Expenses". Verify the downloaded file contains only the header row.

---

## Scenario 2 — Export Ride History (ZIP with per-year CSVs)

### Setup

Seed rides spanning at least 2 calendar years (e.g., some in 2025, some in 2026). Include at least one ride with a note containing a double-quote (e.g., `"6" of snow"`).

### Steps

1. Log in as the test user.
2. Navigate to **Settings** (`/settings`).
3. Click the **"Export Ride History"** button.
4. Observe: a ZIP file download is triggered.

### Expected outcomes

| Checkpoint | Expected |
|------------|---------|
| File name | `ride-history-export.zip` |
| HTTP response code from API | `200 OK` |
| ZIP contents | One `.csv` file per year represented in the data (e.g., `2025.csv`, `2026.csv`) |
| Each CSV first row | `RideId,Date,Miles,RideMinutes,...,CreatedAtUtc` (full header) |
| Each CSV data rows | One per ride for that year; no totals or summary rows |
| Notes with double-quotes | Double-quote escaped (`""`) inside quoted field |
| Optional fields with no data | Empty cell; column still present |
| All files open in Excel/LibreOffice | Columns parsed correctly |

### Single-year check

Create or filter to a user with rides in one year only. Verify the ZIP contains exactly one CSV file.

### Empty dataset check

Create a fresh user with no rides. Click "Export Ride History". Verify the ZIP contains a single CSV named `{currentYear}.csv` with only the header row.

---

## Scenario 3 — User Isolation

### Steps

1. Log in as **User A**, click "Export Expenses". Note the record count.
2. Log out. Log in as **User B** (a different user with different expense data).
3. Click "Export Expenses". Note the record count.

### Expected outcome

User A's export contains only User A's data; User B's export contains only User B's data. No cross-user records appear.

---

## Scenario 4 — Independent Button Operation

### Steps

1. Click "Export Expenses". Wait for download to complete.
2. Click "Export Ride History". Wait for download to complete.
3. Repeat in the other order.

### Expected outcome

Each button triggers its own independent download. Triggering one does not affect or cancel the other.

---

## API-Level Validation (optional, using the `.http` file or curl)

```bash
# Expense CSV
curl -H "X-User-Id: 1" http://localhost:{api_port}/api/exports/expenses \
  --output expenses-export.csv

# Ride history ZIP
curl -H "X-User-Id: 1" http://localhost:{api_port}/api/exports/rides \
  --output ride-history-export.zip
```

Inspect output with `head -5 expenses-export.csv` and `unzip -l ride-history-export.zip`.

See [contracts/export-endpoints.md](./contracts/export-endpoints.md) for full endpoint specifications and [data-model.md](./data-model.md) for column definitions.
