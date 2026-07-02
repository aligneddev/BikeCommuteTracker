# Quickstart: Monthly Summary Import Validation Guide

**Feature**: `025-monthly-summary-import` | **Date**: 2026-06-25

This guide describes how to run the application and validate the monthly summary import feature end-to-end. It is a run/validation guide — implementation details live in [plan.md](plan.md) and [tasks.md](tasks.md).

---

## Prerequisites

- DevContainer open and running
- Application started via Aspire: `dotnet run --project src/BikeTracking.AppHost`
- Aspire Dashboard at http://localhost:19629 — launch frontend and API from there
- A test user account (register or use existing)

---

## Setup: Sample Input Files

Save the following content as test fixtures for validation runs.

### `sample-3months.txt` — Standard tab-delimited input

```
Month	Miles	Days
January	96	8
February	60	5
March	120	10
```

### `sample-year-boundary.txt` — Cross-year boundary

```
Month	Miles	Days
November	80	7
December	100	8
January	60	5
February	50	4
```

### `sample-invalid-rows.txt` — Mixed valid and invalid

```
Month	Miles	Days
January	96	8
Jnauary	50	4
March	-10	3
April	80	35
```

### `sample-no-header.txt` — No header row (positional detection)

```
January	96	8
February	60	5
```

### `sample-comma-miles.txt` — Comma thousands separator

```
Month	Miles	Days
January	1,200.5	10
```

---

## Scenario 1: Standard 3-Month Import (Core Happy Path)

**Validates**: FR-001, FR-002, FR-003, FR-004, FR-007, FR-008, FR-009, SC-001, SC-002, SC-003

**Steps**:
1. Navigate to Import section → click "Monthly Summary Import"
2. Upload `sample-3months.txt` (or paste its contents)
3. Select year **2025**
4. Click **Preview**

**Expected preview**:
- January 2025: 8 rides, all on weekdays, miles sum = 96.00
- February 2025: 5 rides, all on weekdays, miles sum = 60.00
- March 2025: 10 rides, all on weekdays, miles sum = 120.00
- No validation errors, no duplicate flags

5. Click **Confirm Import**

**Expected outcome**:
- Import completes (summary panel shows 23 rides created)
- Navigate to ride history → 23 rides visible, tagged `monthly-import`
- Spot check: all dates fall Mon–Fri; miles per month sum exactly to input total

---

## Scenario 2: Year Boundary (November → February)

**Validates**: FR-005, US3 acceptance scenarios

**Steps**:
1. Upload `sample-year-boundary.txt`
2. Select starting year **2025**
3. Preview

**Expected**:
- November rows → dates in November **2025**
- December rows → dates in December **2025**
- January rows → dates in January **2026**
- February rows → dates in February **2026**

4. Confirm import → verify ride dates in history match expected years.

---

## Scenario 3: Invalid Rows Surfaced Before Confirmation

**Validates**: FR-006, SC-005, edge cases

**Steps**:
1. Upload `sample-invalid-rows.txt`
2. Select year 2025, click Preview

**Expected preview**:
- Row 1 (January): ✅ Valid — 8 rides generated
- Row 2 (Jnauary): ❌ `INVALID_MONTH` — "Unrecognised month name: Jnauary"
- Row 3 (March, -10 miles): ❌ `INVALID_MILES` — "Miles must be greater than 0"
- Row 4 (April, 35 days): ❌ `DAYS_EXCEED_WEEKDAYS` — "Days (35) exceeds available weekdays (22) in April 2025"

3. **Confirm Import button is disabled** (invalid rows present, requires acknowledgement or fixing source data)
4. Verify no rides are written for invalid rows (only January's 8 rides if import proceeds)

---

## Scenario 4: Duplicate Detection and Resolution

**Validates**: FR-010, US4 acceptance scenarios, SC-004

**Steps**:
1. Complete Scenario 1 (import May 2025 or January 2025)
2. Upload the same file again, same year
3. Click Preview

**Expected**:
- All previously generated ride dates flagged as duplicates with existing/incoming values side-by-side
- "Confirm Import" opens duplicate resolution dialog

4. Choose **Keep Existing** for some dates, **Replace** for others
5. Confirm

**Expected**:
- "Keep Existing" dates: original rides unchanged; new rides skipped
- "Replace" dates: existing rides replaced with incoming ride data
- Summary panel shows correct `skipped` and `replaced` counts

6. Repeat with **Override All Duplicates** — verify all colliding dates replaced in one action.

---

## Scenario 5: No Header Row Warning

**Validates**: FR-003 (positional detection + warning)

**Steps**:
1. Upload `sample-no-header.txt`
2. Click Preview

**Expected**:
- Yellow warning banner: "Column mapping was detected automatically (Month, Miles, Days). Please confirm the columns are correct before importing."
- **Confirm Import** disabled until rider clicks "Confirm column mapping"
- After confirmation: standard preview shown with January and February rows

---

## Scenario 6: Comma Thousands Separator in Miles

**Validates**: FR-003 (comma stripping)

**Steps**:
1. Upload `sample-comma-miles.txt`, year 2025, Preview

**Expected**:
- January: 10 rides, miles sum = 1200.50 (comma stripped and parsed correctly)
- No validation error

---

## Scenario 7: Empty Input

**Validates**: edge case (empty file / header only)

**Steps**:
1. Paste only the header line: `Month	Miles	Days`
2. Click Preview

**Expected**: Error message "No data rows found. Please provide at least one month row."

---

## Scenario 8: Intra-File Duplicate Months

**Validates**: FR-011

**Steps**:
1. Paste:
   ```
   Month	Miles	Days
   January	96	8
   January	60	5
   ```
2. Preview

**Expected**: Both January rows flagged with `DUPLICATE_MONTH` error. Confirm Import disabled.

---

## API Smoke Tests (curl)

Replace `{token}` and `{base64}` as appropriate.

```bash
# Preview
curl -X POST http://localhost:{api_port}/api/monthly-imports/preview \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.txt","contentBase64":"{base64}","startYear":2025}'

# Start (after preview returns importJobId)
curl -X POST http://localhost:{api_port}/api/monthly-imports/start \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"importJobId":42,"overrideAllDuplicates":false,"resolutions":[]}'

# Poll status
curl http://localhost:{api_port}/api/monthly-imports/42/status \
  -H "Authorization: Bearer {token}"
```

---

## Unit Test Commands

```bash
# Backend (includes domain F# tests):
dotnet test BikeTracking.slnx

# Frontend unit tests:
cd src/BikeTracking.Frontend && npm run test:unit

# E2E (requires running Aspire app):
cd src/BikeTracking.Frontend && npm run test:e2e
```

---

## References

- [API Contracts](contracts/monthly-import-api.md) — request/response shapes
- [Data Model](data-model.md) — schema changes and entity definitions
- [Plan](plan.md) — architecture decisions and implementation phases
- [Spec](spec.md) — acceptance scenarios and requirements
