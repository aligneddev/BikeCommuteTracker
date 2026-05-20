# BikeTracking Frontend

React + TypeScript + Vite frontend for the BikeTracking application.

## Prerequisites

- Node.js 20+
- npm

## Install

```powershell
npm install
```

## Local Run

```powershell
npm run dev
```

By default the frontend calls the API at `http://localhost:5436`.

## Quality & Test Commands

```powershell
npm run lint         # ESLint + Stylelint
npm run build        # Production build
npm run test:unit    # Vitest unit tests
npm run test:e2e     # Playwright end-to-end tests
```

## Required Verification After Changes

Use the project constitution command matrix:

1. Frontend-only changes: `npm run lint`, `npm run build`, `npm run test:unit`
2. Backend/domain-only changes: run `dotnet test` from repo root
3. Auth/login/cross-layer changes: run all impacted checks plus `npm run test:e2e`

## PWA Behavior (Feature 022)

### Install Support (v1)

- Supported install target: Windows desktop with current Chrome or Edge.
- Unsupported environments continue to work in browser mode.
- Install action and status are available in the Settings page.

### Update Lifecycle

- App checks for updates on relaunch/refresh while online.
- Header status messaging surfaces lifecycle states:
	- checking
	- downloading
	- failed

### Session Timeout Policy

- Auth session persists across launches for up to 7 days of inactivity.
- Activity timestamps are refreshed during authenticated API usage.
- Expired sessions are forced back to login before protected routes render.

### Connectivity Requirements (Installed Mode)

- Ride operations in installed mode require network connectivity in v1.
- Record Ride displays a connectivity-required guard and retry action when offline.

### E2E PWA Helpers

- Shared helpers for PWA scenarios are in:
	- `tests/e2e/support/auth-helpers.ts`
- Includes utilities to:
	- emulate PWA environment values
	- force online/offline state during tests

## Notes

- Playwright configuration is in `playwright.config.ts`.
- Vitest configuration is in `vitest.config.ts`.
