# Implementation Plan: Rider Dashboard Statistics

**Branch**: `012-dashboard-stats` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-dashboard-stats/spec.md`

## Summary

Replace the current lightweight miles landing page with a real rider dashboard backed by a
dedicated dashboard API. The backend will aggregate month, year, and lifetime mileage totals;
average temperature, miles per ride, and ride duration; and two savings calculations
(mileage-rate reimbursement equivalent and fuel-cost avoided). To preserve historical accuracy,
ride create/edit flows will snapshot calculation-relevant user settings into both ride storage
and ride event payloads. The frontend will move to a dedicated dashboard route and render a more
complete visual layout using Recharts with locally vendored ShadCN-style chart primitives that
fit the existing CSS architecture.

## Technical Context

**Language/Version**: C# .NET 10 (API layer); F# .NET 10 (domain layer unchanged for this feature); TypeScript 6 + React 19 (frontend)  
**Primary Dependencies**: .NET 10 Minimal API, Entity Framework Core with SQLite, Microsoft Aspire, React 19 + Vite, Recharts, locally vendored ShadCN-style chart primitives adapted to existing CSS  
**Storage**: SQLite local file via EF Core; additive columns on `Rides` and `UserSettings`; existing outbox event store payloads extended  
**Testing**: xUnit (backend unit + integration), Vitest (frontend unit), Playwright (E2E)  
**Target Platform**: Local-first web app on Windows/macOS/Linux, developed in DevContainer  
**Project Type**: Aspire-orchestrated local web application (React frontend + Minimal API + SQLite)  
**Performance Goals**: Dashboard endpoint ≤ 750 ms p95 for cached local queries at expected single-user scale; initial dashboard page render visually complete within 2 seconds on seeded local data  
**Constraints**: No full Tailwind migration; preserve existing CSS architecture; historical savings must not change when user settings change later; missing snapshot/weather/fuel data must degrade individual metrics only; SQLite-compatible additive schema changes only  
**Scale/Scope**: Single-user local deployment; expected history in the hundreds to low thousands of rides; one new dashboard endpoint, one new frontend page, one migration, and focused ride/settings contract extensions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Clean Architecture / Domain-Driven Design | ✅ PASS | Dedicated dashboard query service and endpoint keep aggregation logic out of controllers and UI |
| Functional Programming (pure/impure sandwich) | ✅ PASS | Snapshot selection and savings formulas can be isolated as pure helpers inside application services |
| Event Sourcing & CQRS | ✅ PASS | Ride recorded/edited event payloads are extended with calculation snapshots; dashboard is a read-side query |
| Quality-First / TDD | ✅ PASS | Quickstart defines failing backend, frontend, and E2E tests before implementation |
| UX Consistency & Accessibility | ✅ PASS | Dashboard remains React/CSS-based, uses accessible cards/charts, and preserves clear empty and partial-data states |
| Performance / Observability | ✅ PASS | Dedicated endpoint avoids page-size hacks; aggregations remain local-query bounded and observable via existing Aspire telemetry |
| Data Validation & Integrity | ✅ PASS | Snapshot and preference fields are additive, validated server-side, and backed by DB defaults/constraints where applicable |
| Experimentation / Security | ✅ PASS | Small-batch rollout via one dashboard route and one endpoint; no new secrets; no browser-side external API access |
| Modularity / Contract-First | ✅ PASS | New dashboard contracts are defined before implementation; settings and ride payload extensions are documented |
| TDD Mandate (mandatory gate) | ✅ PASS | Plan includes explicit red tests and requires user confirmation before implementation starts |
| Migration test coverage policy | ✅ PASS | One new migration implies one new/updated migration coverage policy entry |
| Spec completion gate | ✅ PASS | Plan assumes final validation includes migration application plus unit/lint/build/E2E checks |

**Constitution Check post-design**: No violations. The design stays additive, contract-first, and
aligned with the repository’s current frontend/backend split.

## Project Structure

### Documentation (this feature)

```text
specs/012-dashboard-stats/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-contracts.md
└── tasks.md
```

### Source Code Layout

```text
src/BikeTracking.Api/
├── Application/
│   ├── Dashboard/
│   │   └── GetDashboardService.cs                 ← NEW
│   ├── Events/
│   │   ├── RideRecordedEventPayload.cs           ← extend with calculation snapshots
│   │   └── RideEditedEventPayload.cs             ← extend with calculation snapshots
│   ├── Rides/
│   │   ├── RecordRideService.cs                  ← snapshot user settings into ride + event
│   │   └── EditRideService.cs                    ← same for edits
│   └── Users/
│       └── UserSettingsService.cs                ← extend with dashboard metric approvals
├── Contracts/
│   ├── DashboardContracts.cs                     ← NEW
│   ├── RidesContracts.cs                         ← optional dashboard-facing read-model reuse only if needed
│   └── UsersContracts.cs                         ← extend with optional metric approval fields
├── Endpoints/
│   ├── DashboardEndpoints.cs                     ← NEW
│   └── UsersEndpoints.cs                         ← existing settings endpoint continues with extended contract
└── Infrastructure/
    └── Persistence/
        ├── BikeTrackingDbContext.cs              ← extend entity config
        ├── Entities/
        │   ├── RideEntity.cs                     ← add snapshot columns
        │   └── UserSettingsEntity.cs             ← add dashboard preference booleans
        └── Migrations/
            └── {timestamp}_AddDashboardSnapshotsAndPreferences.cs

src/BikeTracking.Api.Tests/
├── Application/
│   ├── Dashboard/
│   │   └── GetDashboardServiceTests.cs           ← NEW
│   ├── RidesApplicationServiceTests.cs           ← extend snapshot persistence behavior
│   └── Users/
│       └── UserSettingsServiceTests.cs           ← extend preference persistence
├── Endpoints/
│   ├── DashboardEndpointsTests.cs                ← NEW
│   └── UsersEndpointsTests.cs                    ← extend settings contract assertions
└── Infrastructure/
    ├── MigrationTestCoveragePolicyTests.cs       ← add migration entry
    └── RidesPersistenceTests.cs                  ← verify snapshot column round-trip

src/BikeTracking.Frontend/src/
├── components/
│   ├── dashboard/                                ← NEW dashboard cards/sections/charts
│   └── ui/
│       └── chart.tsx                             ← NEW ShadCN-style chart wrapper adapted to repo CSS
├── pages/
│   ├── dashboard/
│   │   ├── dashboard-page.tsx                    ← NEW
│   │   ├── dashboard-page.css                    ← NEW
│   │   └── dashboard-page.test.tsx               ← NEW
│   ├── miles/
│   │   └── miles-shell-page.tsx                  ← retire or redirect
│   └── settings/
│       ├── SettingsPage.tsx                      ← extend optional metric approvals
│       └── SettingsPage.test.tsx                 ← extend
├── services/
│   ├── dashboard-api.ts                          ← NEW
│   ├── dashboard-api.test.ts                     ← NEW
│   └── users-api.ts                              ← extend settings DTOs
└── App.tsx                                       ← route/main-page updates
```

**Structure Decision**: Existing web application structure. Backend work stays in
`src/BikeTracking.Api/` and tests in `src/BikeTracking.Api.Tests/`; frontend work stays in
`src/BikeTracking.Frontend/src/`. No new projects are added.

## Implementation Phases

### Phase 0 — Research

Resolved decisions documented in `research.md`:
- dedicated dashboard API endpoint instead of overloading ride history summaries
- snapshot storage on ride rows plus ride event payloads for historical accuracy
- optional metric approvals persisted in `UserSettingsEntity`
- ShadCN-style charts implemented via Recharts + local wrapper, not full Tailwind adoption
- safe fallback rules for legacy rides missing snapshot data

### Phase 1 — Backend Design and Contracts

**Slice 1.1 — Contracts first**
- Add `DashboardContracts.cs` and extend `UsersContracts.cs`
- Document `GET /api/dashboard` and settings DTO changes

**Slice 1.2 — Persistence**
- Extend `RideEntity` with snapshot fields
- Extend `UserSettingsEntity` with optional metric approval booleans
- Generate one migration and update migration coverage policy tests

**Slice 1.3 — Query service**
- Add `GetDashboardService` that computes cards, averages, chart series, missing-data counts, and suggestions
- Isolate savings formulas and legacy-ride fallback rules in testable helpers

**Slice 1.4 — Write-path integration**
- Update `RecordRideService` and `EditRideService` to capture current calculation settings into ride rows and event payloads

**Slice 1.5 — Endpoint wiring**
- Add authenticated `DashboardEndpoints`
- Extend user settings endpoint/service for optional metric approvals

### Phase 2 — Frontend Design

**Slice 2.1 — API client and route changes**
- Add `dashboard-api.ts`
- Make dashboard the authenticated landing page
- Redirect legacy `/miles` traffic to the new dashboard route to preserve compatibility

**Slice 2.2 — Dashboard page and charts**
- Add summary cards, averages, partial-data messaging, and two baseline charts
- Use Recharts with a local ShadCN-style wrapper component and CSS variables, not Tailwind

**Slice 2.3 — Optional metric suggestion flow**
- Show gallons avoided and goal progress as suggested metrics first
- Persist approvals through user settings and render only when enabled

## Test Plan Summary

| Category | Count | Location |
|----------|-------|----------|
| Backend unit — dashboard aggregation | 8 | `Application/Dashboard/GetDashboardServiceTests.cs` |
| Backend unit — ride snapshot capture | 4 | `Application/RidesApplicationServiceTests.cs` |
| Backend unit — settings preference persistence | 3 | `Application/Users/UserSettingsServiceTests.cs` |
| Endpoint/integration — dashboard + settings contracts | 4 | `Endpoints/DashboardEndpointsTests.cs`, `Endpoints/UsersEndpointsTests.cs` |
| Persistence / migration | 3 | `Infrastructure/RidesPersistenceTests.cs`, `MigrationTestCoveragePolicyTests.cs` |
| Frontend unit | 5 | dashboard page/tests + settings/tests + API client tests |
| E2E (Playwright) | 4 | dashboard landing, totals refresh, settings-change stability, optional metric approval |
| **Total** | **31** | |

## Complexity Tracking

No constitution violations. The design avoids a separate analytics database, avoids Tailwind
adoption, and reuses the current settings/write paths with additive schema changes only.
