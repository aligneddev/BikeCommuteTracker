# Quickstart: Year Stats Dashboard

Validation guide for confirming the Year Stats Dashboard feature works end-to-end once implemented. See `contracts/year-stats-dashboard-api.md` for exact request/response shapes and `data-model.md` for field definitions.

## Prerequisites

- Local stack running: `dotnet run --project src/BikeTracking.AppHost` (starts API + serves frontend per Aspire dev workflow).
- A test rider account with ride data spanning at least two different calendar years, including:
  - At least one year with a full 12 months of rides (to verify normal rendering).
  - The current year with only some months populated (to verify the in-progress-year edge case).
  - Knowledge of at least one year with **zero** rides for that rider (to verify the empty state) — e.g., a year before the account existed.

## Backend Validation

1. Run backend tests: `dotnet test BikeTracking.slnx` — confirm new `GetYearStatsDashboardServiceTests` pass, and existing `GetDashboardServiceTests`/`GetAdvancedDashboardServiceTests` still pass unmodified (proves FR-005/SC-003 no-regression).
2. Manually call the new endpoints (once running) to sanity-check shapes:
   ```bash
   curl -s -b cookies.txt "http://localhost:<port>/api/dashboard/year-stats/years" | jq
   curl -s -b cookies.txt "http://localhost:<port>/api/dashboard/year-stats?year=2025" | jq
   curl -s -b cookies.txt "http://localhost:<port>/api/dashboard/year-stats?year=1901" # expect 400
   ```
3. Confirm a year with zero rides returns `hasDataForYear: false` with zero-filled month arrays, not a `500` or `404`.

## Frontend Validation

1. `cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit` — confirm new `year-stats-dashboard-page.test.tsx` and any updated `dashboard-page.test.tsx` pass.
2. `npm run test:e2e` — confirm `year-stats-dashboard.spec.ts` passes, covering:
   - Nav link → page load with a year pre-selected and charts rendered.
   - Changing the year selector updates charts in place (no navigation/reload).
   - Selecting a known-empty year shows the "no data for this year" state per chart.
   - `/dashboard` (main dashboard) still shows its unchanged rolling 12-month charts.

## Manual Exploratory Pass

1. Log in as the test rider.
2. Open the app navigation menu → click "Year Stats" (or equivalent label) → confirm the page loads without needing a direct URL (SC-004).
3. Confirm the year selector defaults to the current year, or the most recent year with data if the current year is empty (FR-008).
4. Select the full-year dataset → confirm mileage trend, savings breakdown, difficulty-by-month, most-difficult-months, and wind-resistance charts all render Jan–Dec of that year (not a rolling window).
5. Select the in-progress current year → confirm only elapsed/data months show real values; future months are not fabricated (visually flat/zero, not misleading projections).
6. Select the known-empty year → confirm every chart shows an explicit empty state, not an error or blank area.
7. Time the year switch (selector change → charts updated) — should feel well under 2 seconds (SC-001) on local dev data volumes.
8. Navigate to `/dashboard` directly → confirm the main dashboard's mileage/savings charts still show the rolling 12-month window exactly as before this feature (SC-003 regression check).

## Done Criteria

- All backend and frontend automated checks above pass.
- All manual exploratory steps behave as described.
- No changes observed in `/dashboard` or `/dashboard/advanced` behavior compared to pre-feature baseline.
