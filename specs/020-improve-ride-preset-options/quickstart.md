# Quickstart: Improve Ride Preset Options

**Feature**: 020-improve-ride-preset-options  
**Date**: 2026-04-29

## Goal

Replace legacy quick-entry from previous rides with explicit rider-managed presets configured in settings and applied during ride entry.

This quickstart enforces the clarified decisions:
- Presets store exact start time.
- Ride-entry preset list is MRU ordered.
- Legacy quick-entry UI is deleted for all riders.

## Implementation Order (TDD gates required)

1. Write failing tests first, run, and get user confirmation of meaningful failures before implementation.
2. Implement smallest backend slice to pass.
3. Implement frontend slice to pass.
4. Run full verification matrix.

## Step 1: Backend Preset Persistence + Contracts

1. Add `RidePreset` entity, DbSet, and EF migration.
2. Add rider-scoped preset contracts and endpoint mappings.
3. Add request validation and unique-name enforcement.

Suggested files:
- `src/BikeTracking.Api/Infrastructure/Persistence/Entities/` (new preset entity)
- `src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs`
- `src/BikeTracking.Api/Contracts/RidesContracts.cs`
- `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`
- `src/BikeTracking.Api/Application/Rides/` (new preset services)

## Step 2: MRU Update on Ride Save

1. Extend record-ride request with optional `selectedPresetId`.
2. In record-ride flow, after successful save and rider ownership validation, update preset `LastUsedAtUtc`.
3. Keep ride save successful even if no preset selected.

Suggested file:
- `src/BikeTracking.Api/Application/Rides/RecordRideService.cs`

## Step 3: Remove Legacy Quick-Entry Backend Surface

1. Remove quick-options route mapping from rides endpoints.
2. Remove/deprecate `GetQuickRideOptionsService` and associated contract types.
3. Update tests to assert endpoint absence and no quick-options usage path.

Suggested files:
- `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs`
- `src/BikeTracking.Api/Application/Rides/GetQuickRideOptionsService.cs`
- `src/BikeTracking.Api/Contracts/RidesContracts.cs`
- `src/BikeTracking.Api.Tests/Endpoints/`

## Step 4: Settings UI - Preset Management

1. Add preset section to settings page with create/edit/delete.
2. Provide period-based default direction suggestions:
   - morning -> SW
   - afternoon -> NE
3. Keep user override always enabled.

Suggested files:
- `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx`
- `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.css`
- `src/BikeTracking.Frontend/src/pages/settings/SettingsPage.test.tsx`
- `src/BikeTracking.Frontend/src/services/ridesService.ts`

## Step 5: Ride Entry - Preset Apply and Legacy UI Removal

1. Remove "Quick Ride Options" section and calls from ride entry page.
2. Add preset selector/list ordered by MRU from backend response.
3. On preset apply, populate direction, exact start time, duration.
4. Include `selectedPresetId` when submitting if preset-origin values are used.

Suggested files:
- `src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx`
- `src/BikeTracking.Frontend/src/pages/RecordRidePage.test.tsx`
- `src/BikeTracking.Frontend/src/services/ridesService.ts`
- `src/BikeTracking.Frontend/src/services/ridesService.test.ts`

## Step 6: Header/Menu Access Validation

1. Ensure settings remains reachable from username area through existing click/hover interactions.
2. Add/update tests for navigation affordance if needed.

Suggested file:
- `src/BikeTracking.Frontend/src/components/app-header/app-header.tsx`

## Required Test Plan

Backend tests:
- Create preset with exact start time persists correctly.
- Duplicate preset name for same rider returns validation error.
- Same preset name across different riders is allowed.
- Preset list returns MRU order by `LastUsedAtUtc`.
- Record ride with `selectedPresetId` updates MRU timestamp.
- Preset list excludes presets from other riders.
- Legacy quick-options endpoint no longer available.

Frontend tests:
- Settings page supports create/edit/delete preset flows.
- Period change suggests SW/NE defaults and still permits user override.
- Record ride page does not render legacy quick-entry section.
- Record ride page applies preset values to direction/time/duration.
- Submission sends `selectedPresetId` when a preset is used.

E2E tests:
- Rider creates presets in settings and sees them in ride entry.
- MRU order changes only after successful ride save using a preset.
- No legacy quick-entry UI visible for any rider profile.

## Verification Commands

```bash
cd /workspaces/neCodeBikeTracking

# Backend
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet test BikeTracking.slnx

# Frontend
cd /workspaces/neCodeBikeTracking/src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit

# E2E (with Aspire app running)
npm run test:e2e
```
