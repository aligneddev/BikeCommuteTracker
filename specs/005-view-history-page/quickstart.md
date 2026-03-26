# Quickstart: Ride History Page

**Branch**: `005-view-history-page` | **Date**: 2026-03-26

## Prerequisites

- Feature `004-create-the-record-ride-mvp` is available so ride data exists.
- Dev container is running.
- App boots via `dotnet run --project src/BikeTracking.AppHost`.

## Step 1: Backend Query Endpoint

Add an authenticated query endpoint:

- `GET /api/rides/history?from=&to=&page=&pageSize=`

Behavior:
- Validate `from` and `to` as dates.
- Reject `from > to` with `400`.
- Scope all query data to authenticated rider.
- Return paged rows plus summaries (`thisMonth`, `thisYear`, `allTime`, `filteredTotal`).

## Step 2: Frontend History Page

Create or update history route/page in frontend:

- Render summary tiles at top (this month, this year, all-time).
- Render TanStack table/grid for ride rows.
- Add date range filter controls (`from`, `to`).
- Show `filteredTotal` miles for current range.
- Show explicit empty state for no rows.

## Step 3: Reusable Summary Components

Implement reusable summary components in frontend:

- `MileageSummaryCard` for a single stat tile with visual indicator.
- Use on History page for all three summary tiles.
- Reuse same component for Dashboard all-time and year-to-date tiles.

## Step 4: Validation and Error Handling

- Client-side validation for invalid date range before request.
- API validation as source of truth (`400` on invalid input).
- UX messages for empty states and request failures.

## Step 5: TDD Execution Order (Mandatory)

1. Write failing backend tests for history query filtering/summaries.
2. Run tests and confirm failures with user before implementation.
3. Implement endpoint/query logic to pass tests.
4. Write failing frontend tests for summary cards, grid rows, filters, filtered total, and dashboard reuse.
5. Run tests and confirm failures with user before implementation.
6. Implement UI logic until tests pass.

## Step 6: Verification Commands

Backend:

```bash
dotnet test BikeTracking.slnx
```

Frontend:

```bash
cd src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit
```

Cross-layer (history + dashboard changes):

```bash
cd src/BikeTracking.Frontend
npm run test:e2e
```
