# Implementation Plan: CSV Data Export

**Branch**: `028-csv-data-export` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/028-csv-data-export/spec.md`

## Summary

Add two export buttons to the Settings page: one downloads all expense records as a single CSV file; the other downloads ride history as a ZIP archive containing one CSV per calendar year. Both exports are scoped to the authenticated user, generated synchronously, contain raw data rows only (no totals), and must handle special characters via RFC 4180 quoting.

Technical approach: two new backend application services (`ExpenseCsvExportService`, `RideHistoryCsvExportService`) behind a new `ExportEndpoints` route group (`GET /api/exports/expenses` and `GET /api/exports/rides`). ZIP creation uses the built-in `System.IO.Compression.ZipArchive`. CSV quoting uses a lightweight in-project `CsvRowBuilder` helper (no new NuGet dependency needed). Frontend adds a new `export-api.ts` service with blob-download helpers and two buttons on `SettingsPage`.

## Technical Context

**Language/Version**: .NET 10 / C# (backend), TypeScript / React 19 (frontend)

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core 10 / SQLite, System.IO.Compression (built-in), Vite + React 19, React Router v6, Vitest, Playwright

**Storage**: SQLite via EF Core — reads `Rides` and `Expenses` tables; no schema changes, no migrations

**Testing**: xUnit + custom `ApiHost` harness (backend integration tests), Vitest (frontend unit), Playwright (E2E)

**Target Platform**: Local-first, DevContainer + .NET Aspire; packaged desktop targets (Windows/macOS/Linux)

**Project Type**: Full-stack web service (Minimal API) + React SPA

**Performance Goals**: SC-001 — expenses CSV in <5 s for 5,000 records; SC-002 — rides ZIP in <10 s for 5,000 rides spanning 10 years

**Constraints**: Synchronous generation; no job queue, no background processing, no scheduling; user-scoped data only; no new database tables or migrations

**Scale/Scope**: Up to 5,000 expense records and 5,000 ride records per user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| TDD mandatory — failing test before implementation | ✅ PASS | Tests written first per constitution §3 |
| E2E required on every PR | ✅ PASS | Playwright E2E covering both export buttons required |
| Ports-and-adapters — strict boundary protection | ✅ PASS | Export services live in `Application/Export/`; DbContext injected through constructor; no direct EF leakage into endpoints |
| Domain outcomes as Result-style values | ✅ PASS | No new domain decisions needed; read-only export, no state mutation |
| Write model transactional relational, explicit audit logs | ✅ PASS | No writes; read-only feature |
| Short-lived branches, PR-only merge | ✅ PASS | Feature branch `028-csv-data-export` |
| No unjustified new projects | ✅ PASS | No new projects; feature lives entirely in existing `BikeTracking.Api` and `BikeTracking.Frontend` |

**Post-design re-check**: No violations introduced in Phase 1 design. No migrations required. No new NuGet packages added.

## Project Structure

### Documentation (this feature)

```text
specs/028-csv-data-export/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── export-endpoints.md
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code

```text
src/BikeTracking.Api/
├── Application/
│   └── Export/                              # NEW folder
│       ├── CsvRowBuilder.cs                 # NEW — RFC 4180 quoting helper
│       ├── ExpenseCsvExportService.cs       # NEW — reads Expenses, produces CSV string
│       └── RideHistoryCsvExportService.cs   # NEW — reads Rides, produces ZIP stream
├── Endpoints/
│   └── ExportEndpoints.cs                   # NEW — maps /api/exports group
└── Contracts/
    └── ExportContracts.cs                   # NEW — (empty placeholder; no request DTOs needed)

src/BikeTracking.Api.Tests/
└── Endpoints/
    └── Export/
        ├── ExpenseExportEndpointTests.cs    # NEW — xUnit integration tests
        └── RideExportEndpointTests.cs       # NEW — xUnit integration tests

src/BikeTracking.Frontend/src/
├── services/
│   └── export-api.ts                        # NEW — fetch + blob-download helpers
└── pages/settings/
    ├── SettingsPage.tsx                     # MODIFIED — add two export buttons + state
    └── SettingsPage.test.tsx                # MODIFIED — add export button unit tests

src/BikeTracking.Frontend/tests/e2e/
└── export.spec.ts                           # NEW — Playwright E2E for both exports
```

**Structure Decision**: All backend code is added to the existing `BikeTracking.Api` project. No new C# projects. Frontend changes are scoped to `SettingsPage` and a new `export-api.ts` service. This follows the established flat-folder-per-concern pattern used throughout the application.
