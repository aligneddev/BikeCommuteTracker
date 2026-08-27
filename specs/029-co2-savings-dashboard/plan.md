# Implementation Plan: CO2 Savings on Advanced Dashboard

**Branch**: `029-co2-savings-dashboard` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/029-co2-savings-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add an on-demand (never persisted) CO2-saved metric to each of the advanced dashboard's four existing savings windows (weekly, monthly, yearly, all-time), plus a fixed CO2-saved-per-mile value shown alongside the totals. CO2 saved for a window is computed as `windowTotalMiles * 0.90 lb/mile` (EPA average passenger-vehicle emission factor), rounded to 2 decimal places, consistent with the existing gallons/currency rounding convention. The calculation is a pure function added next to the existing gallons/fuel-cost/mileage-rate calculations, wired into `GetAdvancedDashboardService`'s existing per-window aggregation, exposed on the existing `AdvancedSavingsWindow` contract plus a new per-mile constant on the response, and rendered as two additional columns/values in `SavingsWindowsTable`.

## Technical Context

**Language/Version**: .NET 10 (C# backend), F# 9 (domain), TypeScript 5.x + React 19 (frontend)

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core (SQLite), React Router, xUnit, Vitest + React Testing Library, Playwright

**Storage**: SQLite via existing `RideEntity` (no new storage engine, no new tables, no migrations — CO2 is derived at request time from existing `Miles` data)

**Testing**: `dotnet test BikeTracking.slnx`, `cd src/BikeTracking.Frontend && npm run test:unit`, `cd src/BikeTracking.Frontend && npm run test:e2e`

**Target Platform**: Local-first web app (Aspire-hosted API + React frontend)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: Out of scope; CO2 calculation is O(1) per window given already-computed `TotalMiles`, negligible cost added to existing advanced-dashboard request path

**Constraints**:
- CO2 value MUST NOT be persisted or cached between requests (recomputed every load per FR-005/SC-004)
- CO2-per-mile factor is a fixed constant (0.90 lb/mile) and MUST NOT vary by user MPG/vehicle settings (FR-007)
- Rounding MUST be 2 decimal places, consistent with existing gallons/currency conventions (FR-009)
- Reuse existing weekly/monthly/yearly/all-time window boundaries already established by the advanced dashboard — the advanced dashboard's yearly window already scopes to the current calendar year with no persisted, user-selectable year control; this feature does not add one (see research.md Decision 1)
- No new backend persistence, migration, or storage schema

**Scale/Scope**: Single advanced-dashboard savings computation path (`GetAdvancedDashboardService` + `AdvancedDashboardCalculations` F# module + `AdvancedSavingsWindow`/response contracts) and its rendering in `SavingsWindowsTable`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Directive | Status | Notes |
|-----------|--------|-------|
| DevContainer environment | ✅ PASS | No environment/tooling change required |
| Trunk-based delivery + PR flow | ✅ PASS | Work remains on existing feature branch `029-co2-savings-dashboard` |
| TDD mandatory | ✅ PASS | Plan requires failing F# calculation tests, backend service tests, and frontend component tests before implementation |
| E2E required on every PR | ✅ PASS | Extend `savings-calculation.spec.ts` (or add a CO2-focused spec) to assert CO2 values render on the advanced dashboard |
| Ports/adapters boundaries | ✅ PASS | New calculation lives in the existing F# domain module; service/contract/UI changes stay within existing advanced-dashboard layers |
| Result-style domain outcomes | ✅ PASS | Pure function returns a plain `decimal`; zero-miles/zero-rides windows produce `0m`, not exceptions or nulls |
| Transactional relational write model | ✅ PASS (N/A) | Read/compute/display only; no new writes, no migrations |
| Local-first runtime posture | ✅ PASS | SQLite + local stack unchanged |

**Post-design re-check (Phase 1)**: ✅ All gates remain green. Design adds one pure calculation function, one contract field per window, one response-level constant, and new UI rendering — no new services, infrastructure, or persistence shape changes.

## Project Structure

### Documentation (this feature)

```text
specs/029-co2-savings-dashboard/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── advanced-dashboard-co2-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/BikeTracking.Domain.FSharp/
└── AdvancedDashboardCalculations.fs             # add calculateCo2Saved (pure fn) + Co2PerMileLbs constant

src/BikeTracking.Api/
├── Application/Dashboard/GetAdvancedDashboardService.cs   # call new calculation per window; add per-mile constant to response
├── Contracts/AdvancedDashboardContracts.cs                # add Co2Saved to AdvancedSavingsWindow; add Co2SavedPerMile to response
└── (tests) src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs

src/BikeTracking.Frontend/src/
├── services/advanced-dashboard-api.ts                     # add co2Saved / co2SavedPerMile to TS types
├── pages/advanced-dashboard/SavingsWindowsTable.tsx        # render CO2 Saved column + per-mile factor
└── pages/advanced-dashboard/SavingsWindowsTable.test.tsx   # assert CO2 rendering/formatting

src/BikeTracking.Frontend/tests/e2e/
└── savings-calculation.spec.ts                             # extend to assert CO2 total + per-mile figure visible
```

**Structure Decision**: Use the existing web-app layout (F# domain → C# API service/contracts → React frontend) and modify only the existing advanced-dashboard calculation/service/contract/UI/test files directly tied to CO2 display. No new projects, services, or persistence layers are introduced.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
