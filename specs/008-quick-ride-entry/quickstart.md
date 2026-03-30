# Quickstart: Quick Ride Entry from Past Rides

**Feature**: Quick Ride Entry from Past Rides  
**Branch**: `008-quick-ride-entry`  
**Date**: 2026-03-30

## Quick Reference

- API contract: [quick-ride-options-api.yaml](./contracts/quick-ride-options-api.yaml)
- API playground request: `src/BikeTracking.Api/BikeTracking.Api.http` (`GET /api/rides/quick-options`)
- Existing dependent contracts:
  - record ride: `specs/004-create-the-record-ride-mvp/contracts/record-ride-api.yaml`
  - history: `specs/005-view-history-page/contracts/ride-history-api.yaml`

## Implementation Steps

### 1. Add Backend Quick Options Query

1. Add authenticated endpoint `GET /api/rides/quick-options` in API endpoint mapping.
2. Implement application query service that:
- reads rider's rides
- filters records missing miles or rideMinutes
- deduplicates by `(miles, rideMinutes)`
- orders by most recent ride datetime descending
- returns top 5
3. Return additive DTO response matching contract.

### 2. Integrate Frontend Record-Ride UI

1. Add quick-entry section to existing record-ride page.
2. Fetch quick options on page load.
3. Render option chips/buttons showing miles + minutes summary.
4. On option selection, copy values into miles and rideMinutes fields.
5. Preserve ability to edit copied values before save.
6. Do not trigger save on selection.

### 3. Refresh After Successful Save

1. Reuse existing ride save flow.
2. After successful `POST /api/rides`, refetch quick options.
3. Keep failure mode non-blocking: if refresh fails, manual form usage continues.

### 4. TDD Workflow (Mandatory)

1. Write failing tests first for quick-option derivation and prefill behavior.
2. Run and capture failing outputs.
3. Obtain user confirmation that failures are meaningful.
4. Implement minimal code to pass tests.
5. Re-run tests after each meaningful change.

## Suggested Test Coverage

### Backend

- returns no more than 5 options
- returns only authenticated rider options
- excludes rides missing miles or rideMinutes
- returns unique `(miles, rideMinutes)` pairs
- orders options by recency

### Frontend

- quick options render when returned
- selecting option copies miles and rideMinutes
- selection does not auto-submit/save
- copied values remain editable
- empty options state falls back to manual entry UX

### E2E

- rider with repeated patterns sees deduplicated up-to-5 options
- selecting option prefills fields, submit persists ride
- after save, quick options include new pattern when distinct

## Verification Commands (Mandatory)

```bash
# backend checks
cd /workspaces/neCodeBikeTracking
dotnet test BikeTracking.slnx

# frontend checks
cd /workspaces/neCodeBikeTracking/src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit

# cross-layer/authenticated journey checks
npm run test:e2e
```

## Manual Verification Flow

1. Start stack: `dotnet run --project src/BikeTracking.AppHost`
2. Sign in as a rider with at least 6 rides containing repeated miles-duration combinations.
3. Open record-ride page and verify no more than 5 quick options appear.
4. Select a quick option and confirm miles + duration fields are populated.
5. Edit one populated field and save ride.
6. Confirm save succeeds and no auto-save happened during selection.
7. Reopen or refresh options and verify the newest distinct pattern appears according to recency rules.

## Acceptance Notes

- Quick ride options are rider-scoped and derived only from rides that contain both miles and duration.
- Duplicate `(miles, rideMinutes)` combinations are collapsed so each combination appears once.
- The quick options list is ordered by most recent matching ride and capped at 5 entries.
- Selecting a quick option copies miles and duration into the form but never submits automatically.
- Riders can edit copied values before saving, and standard validation still applies.
- If quick options cannot be loaded, manual ride entry remains available without blocking the page.
- After a successful ride save, quick options are refreshed so new distinct patterns can appear immediately.