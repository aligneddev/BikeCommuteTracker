# Quickstart: Riding Time Totals — Validation Guide

**Feature**: `031-ride-time-stats`

How to prove the feature works end-to-end. For field shapes, see [contracts/riding-time-totals-contract.md](contracts/riding-time-totals-contract.md). For calculation and formatting rules, see [data-model.md](data-model.md).

## Prerequisites

- DevContainer up; .NET 10 SDK and Node available.
- Repo root: `BikeTracking.slnx`.
- Frontend deps installed: `cd src/BikeTracking.Frontend && npm ci`.

## 1. Automated checks

```bash
# Backend: RidingTimeRules + three dashboard services
dotnet test BikeTracking.slnx --filter "FullyQualifiedName~Application.Dashboard"

# Full backend suite (no regressions in dashboard endpoint tests)
dotnet test BikeTracking.slnx

# Frontend unit: formatHoursMinutes + three dashboard pages
cd src/BikeTracking.Frontend
npm run test:unit -- ridingTime dashboard-page advanced-dashboard-page year-stats-dashboard-page

# E2E (required for PR)
npm run test:e2e -- dashboard.spec.ts savings-calculation.spec.ts year-stats-dashboard.spec.ts
```

**Expected**: all green. Per the TDD gate, the new tests must be shown failing before the implementation lands.

## 2. Manual scenario walk-through

Start the app (Aspire AppHost, as usual) and sign in as a new rider. Then record these rides:

| # | Date | Miles | Duration (min) |
|---|------|-------|----------------|
| A | Dec 31 of last year | 10 | 45 |
| B | Jan 1 of this year | 10 | 30 |
| C | Today | 10 | 90 |
| D | Today | 5 | *(leave blank)* |

Expected totals: all-time = 45 + 30 + 90 = **165 min → `2h 45m`**. This year = 30 + 90 = **120 → `2h 0m`**. Last year = **45 → `0h 45m`**.

| Step | Where | Expected | Covers |
|------|-------|----------|--------|
| 1 | Main dashboard | "Riding Time" card shows `2h 45m`; detail mentions 1 ride missing duration | US1 AC1, AC3; FR-001, FR-004, FR-006 |
| 2 | Advanced dashboard | "All-time riding time: `2h 45m`" in the Savings Breakdown section | US2 AC1; FR-002 |
| 3 | Year stats, this year | "Total riding time" = `2h 0m` | US3 AC1; FR-003 |
| 4 | Year stats, switch to last year | updates to `0h 45m` without leaving the page | US3 AC3; SC-004 |
| 5 | Year stats, pick a year with no rides (if offered) | existing "No ride data for {year}." message; no riding-time item | US3 AC2; FR-005 |
| 6 | Sign in as a second, brand-new rider | main dashboard `0h 0m`; advanced `0h 0m`; no errors | US1 AC2, US2 AC2; FR-005, FR-007; SC-003 |

## 3. API spot-check (optional)

With an authenticated session for the rider above:

```bash
curl -s "$API/api/dashboard"                       | jq '.totals.totalRideMinutes'   # 165
curl -s "$API/api/dashboard/advanced"              | jq '.totalRideMinutes'          # 165
curl -s "$API/api/dashboard/year-stats?year=$(date +%Y)" | jq '.totals.totalRideMinutes'   # 120
```

The three all-time and year values must agree with each other and with the ride history (SC-002).
