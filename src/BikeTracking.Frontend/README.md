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

## Notes

- Playwright configuration is in `playwright.config.ts`.
- Vitest configuration is in `vitest.config.ts`.
