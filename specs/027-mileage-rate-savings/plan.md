# Implementation Plan: Split Savings Display Metrics

**Branch**: `027-mileage-rate-savings` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-mileage-rate-savings/spec.md`

## Summary

Split the dashboard/results savings presentation into two explicit metrics and stop presenting a merged single-total savings value in that view. Keep scope limited to savings calculation/display, preserve existing formatting/rounding behavior, and keep backend/frontend tests aligned with the two formulas defined in the spec:
- Mileage rate savings = `configuredMileageRate * periodMiles` (using `UserSettings.MileageRateCents` for dashboard period aggregations)
- Gallons-based savings = `gallonsSaved * miles`
- Canonical mapping: UI label "Gallons-based savings" -> contract field `totals.moneySaved.fuelCostAvoided`

## Technical Context

**Language/Version**: .NET 10 (C# backend), F# 9 (domain), TypeScript 5.x + React 19 (frontend)

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core (SQLite), React Router, xUnit, Vitest + React Testing Library, Playwright

**Storage**: SQLite via existing ride/settings entities (no new storage engine)

**Testing**: `dotnet test BikeTracking.slnx`, `cd src/BikeTracking.Frontend && npm run test:unit`, `cd src/BikeTracking.Frontend && npm run test:e2e`

**Target Platform**: Local-first web app (Aspire-hosted API + React frontend)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: Out of scope for this feature; no explicit performance acceptance target added

**Constraints**:
- Do not broaden to unrelated dashboard redesign work
- Keep currency/unit/rounding behavior unchanged
- Keep ride-entry and persisted data shape unchanged
- Keep mileage-rate source aligned to current settings for dashboard month/year aggregation logic

**Scale/Scope**: Single dashboard/results savings card/section and its backing aggregation/tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Directive | Status | Notes |
|-----------|--------|-------|
| DevContainer environment | ✅ PASS | No environment/tooling change required |
| Trunk-based delivery + PR flow | ✅ PASS | Work remains on existing feature branch |
| TDD mandatory | ✅ PASS | Plan requires backend + frontend failing tests first |
| E2E required on every PR | ✅ PASS | Add/adjust Playwright coverage for split metrics |
| Ports/adapters boundaries | ✅ PASS | Changes remain in existing dashboard service + contracts + UI layers |
| Result-style domain outcomes | ✅ PASS | No exception-driven flow introduced |
| Transactional relational write model | ✅ PASS (N/A) | Read/compute/display update only; no new writes |
| Local-first runtime posture | ✅ PASS | SQLite + local stack unchanged |

**Post-design re-check (Phase 1)**: ✅ All gates remain green. Design remains additive/tight and does not introduce new services, infra, or persistence shape changes.

## Project Structure

### Documentation (this feature)

```text
specs/027-mileage-rate-savings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-split-savings-contract.md
└── tasks.md   # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
src/BikeTracking.Api/
├── Application/Dashboard/GetDashboardService.cs        # update savings aggregation output as needed
├── Contracts/DashboardContracts.cs                     # keep split fields explicit; remove merged display dependency
└── Tests via src/BikeTracking.Api.Tests/Application/Dashboard/

src/BikeTracking.Frontend/src/
├── pages/dashboard/dashboard-page.tsx                  # render two labeled metrics; remove merged line in summary display
├── services/dashboard-api.ts                           # keep frontend contract/types aligned
└── tests under pages/dashboard and tests/e2e

src/BikeTracking.Frontend/tests/e2e/
└── dashboard.spec.ts / savings-calculation.spec.ts     # validate both metrics appear together
```

**Structure Decision**: Use existing web-app layout and modify only existing dashboard service/contracts/UI/test files directly tied to split-savings behavior.
