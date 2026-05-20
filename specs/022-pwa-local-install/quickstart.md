# Developer Quickstart: Local PWA Installation

**Feature**: 022-pwa-local-install  
**Branch**: 022-pwa-local-install  
**Date**: 2026-05-20

## Goal

Make Bike Tracking locally installable on Windows via Chrome/Edge PWA flows, with automatic updates, online-only ride operations, and 7-day inactivity auth timeout.

## Prerequisites

- DevContainer running
- App start command available from repo root:

```bash
dotnet run --project src/BikeTracking.AppHost
```

- Frontend commands available in `src/BikeTracking.Frontend`

## TDD Gate Sequence (Mandatory)

1. Write failing tests for one behavior slice.
2. Run tests and confirm failures are behavior-related.
3. Implement minimal code to pass.
4. Re-run tests until green.
5. Refactor with tests still green.

## Implementation Order

### 1) PWA Baseline (Manifest + Service Worker Registration)

- Add/verify manifest metadata for installability.
- Add/verify service worker registration and boot lifecycle.
- Ensure installed launch opens in app-style window.

Tests first:
- Frontend unit: manifest-driven UI affordance visibility state.
- E2E: install entry point present in supported environment.

### 2) Install UX and Unsupported Environment Guidance

- Add clear install action when supported.
- Add clear guidance when unsupported OS/browser or install not available.

Tests first:
- Frontend unit: unsupported environment message rendering.
- E2E: non-supported environment keeps browser usage path available.

### 3) Online-Only Runtime Behavior

- Detect offline state in installed window.
- Show connectivity-required guidance and retry action for ride operations.

Tests first:
- Frontend unit: offline guard behavior.
- E2E: offline launch displays guidance without app crash.

### 4) Automatic Update on Relaunch/Refresh

- Implement service worker update flow signaling (`checking`, `ready`, `applied`, `failed`).
- Surface update status messaging.

Tests first:
- Frontend unit: update state transition handling.
- E2E: outdated instance updates on relaunch/refresh in supported environment.

### 5) 7-Day Inactivity Session Timeout

- Persist session activity timestamp across launches.
- Enforce re-authentication after 7 days inactivity.

Tests first:
- Frontend unit: inactivity expiration calculation.
- E2E: relaunch after simulated >7 days requires sign-in.

## Suggested Test Inventory

- Vitest: install capability detection, unsupported guidance, offline guard, update-state reducer/handler, session-expiry calculation.
- Playwright: supported install flow (Windows Chrome/Edge), relaunch behavior, update application behavior, inactivity timeout behavior.
- API tests: only if auth token semantics require backend validation change.

## Verification Commands

```bash
# Solution tests
dotnet test BikeTracking.slnx

# Frontend quality and unit tests
cd src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit

# End-to-end tests (app must be running via Aspire)
npm run test:e2e
```

## Notes

- Keep feature scope constrained to Windows install support in v1.
- Do not add offline ride create/edit in this feature.
- Preserve existing backend contracts unless a strictly necessary auth compatibility issue emerges.

## Validation Results (2026-05-20)

### Frontend Checklist (T039)

- `npm run lint` (from `src/BikeTracking.Frontend`): passed
- `npm run build` (from `src/BikeTracking.Frontend`): passed
	- Note: Vite reported a large chunk size warning for `dist/assets/index-*.js`, no build failure.
- `npm run test:unit` (from `src/BikeTracking.Frontend`): passed
	- Result: 27 files passed, 163 tests passed, 0 failed.
- `npm run test:e2e` (from `src/BikeTracking.Frontend`): passed
	- Result: 38 passed, 0 failed.

### Full Solution Regression (T040)

- `dotnet test BikeTracking.slnx` (from repo root): passed
	- Result: total 353, failed 0, succeeded 351, skipped 2.
