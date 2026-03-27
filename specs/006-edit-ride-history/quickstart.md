# Quickstart: Edit Rides in History

**Branch**: `006-edit-ride-history` | **Date**: 2026-03-27

## Prerequisites

- Feature `005-view-history-page` is available and history table is visible for authenticated riders.
- DevContainer is running.
- App boots via `dotnet run --project src/BikeTracking.AppHost`.

## Step 1: Define Contracts First

Create and review these contracts before coding:

- `contracts/ride-edit-api.yaml`
- `contracts/ride-edited-event.schema.json`

Confirm endpoint semantics:

- `PUT /api/rides/{rideId}` edits one ride row.
- Request includes `expectedVersion` for optimistic concurrency.
- Return `409` on stale edits.

## Step 2: Backend Edit Command Slice

Implement an authenticated edit flow:

- Add request DTO + endpoint handler for `PUT /api/rides/{rideId}`.
- Validate rider ownership and required/numeric fields.
- Enforce optimistic version matching.
- Append immutable `RideEdited` event on success.
- Update or rebuild ride projection row and dependent summary calculations.

## Step 3: Frontend History Row Edit UX

Implement row-level edit behavior in history table:

- Explicit Enter Edit action per row.
- Inline edit controls for editable fields.
- Save and Cancel actions.
- Field-level validation + recoverable error messaging.
- Conflict message and retry path for `409` responses.

## Step 4: Keep Summaries Consistent

After successful save:

- Refresh history query state so row values and summary totals are server-authoritative.
- Ensure active date filters continue to apply after refresh.

## Step 5: TDD Execution Order (Mandatory)

1. Write failing backend tests for successful edit, validation failures, ownership guard, and version conflict behavior.
2. Run tests and obtain explicit user confirmation that failures are for expected behavioral reasons.
3. Implement backend command/event/projection logic until tests pass.
4. Write failing frontend tests for edit mode, cancel behavior, validation messaging, success flow, and conflict handling.
5. Run frontend tests and obtain explicit user confirmation of expected failures.
6. Implement frontend behavior until tests pass.
7. Re-run full impacted suite before final review.

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

Cross-layer (history edit journey):

```bash
cd src/BikeTracking.Frontend
npm run test:e2e
```
