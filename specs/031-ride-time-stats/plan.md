# Implementation Plan: Riding Time Totals

**Branch**: `031-ride-time-stats` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-ride-time-stats/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Surface a total riding time (sum of each ride's existing `RideEntity.RideMinutes`, rides with `null` duration excluded) on three existing read-only dashboard surfaces: the main dashboard (all-time), the advanced dashboard (all-time only), and the year stats dashboard (selected calendar year). The API returns an integer **total minutes** value on each response (`DashboardTotals.TotalRideMinutes`, `AdvancedDashboardResponse.TotalRideMinutes`, `YearStatsTotals.TotalRideMinutes`), always non-null (`0` when nothing qualifies). The sum lives in one small shared C# helper, `RidingTimeRules`, next to the existing `SavingsCalculationRules`, so all three services use the same calculation. The frontend formats minutes as whole hours and minutes (`"42h 15m"`, `"1,042h 30m"`) with one shared helper, `formatHoursMinutes`, in `src/utils/ridingTime.ts`. It adds a "Riding Time" summary card on the main dashboard, an "All-time riding time" line above the advanced dashboard's Savings Breakdown table, and a "Total riding time" item in the year stats text summary. No schema change, no migration, no new endpoint.

## Technical Context

**Language/Version**: .NET 10 (C# backend), F# 9 (domain — not touched; see research.md Decision 3), TypeScript 5.x + React 19 (frontend)

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core (SQLite), xUnit, Vitest + React Testing Library, Playwright

**Storage**: SQLite via EF Core — reads the existing nullable `Rides.RideMinutes` column (`CK_Rides_RideMinutes_GreaterThanZero` already guarantees `NULL` or `> 0`); no new tables, columns, or migrations

**Testing**: `dotnet test BikeTracking.slnx`, `cd src/BikeTracking.Frontend && npm run test:unit`, `cd src/BikeTracking.Frontend && npm run test:e2e`

**Target Platform**: Local-first web app (Aspire-hosted API + React frontend)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: No new SLA. Each service already loads the rider's rides into memory; adding one more O(n) in-memory sum over that list adds no measurable latency and no extra queries.

**Constraints**:
- Only rides with a non-null `RideMinutes` contribute to the sum (FR-004); this matches how `CalculateAverageRideMinutes` already filters.
- Scope matches each surface's existing ride set: all rides for the main and advanced dashboards, the selected calendar year's rides for year stats (FR-001–FR-003). Each service already filters by `RiderId` (FR-007).
- The value is computed on every request and never stored or snapshotted, because duration is a recorded fact on each ride (spec Assumption 2).
- Display is always whole `Xh Ym`, never decimal hours (FR-006). The hours part uses thousands separators and has no upper limit (Edge Case 2).
- Zero states: main and advanced dashboards show `0h 0m`. On year stats, a year with no rides keeps the existing "No ride data for {year}." empty state, and a year that has rides but no durations shows `0h 0m` (FR-005, Edge Cases 1 & 4).
- Advanced dashboard: only the all-time figure is in scope, not one per window (spec Assumption 1).

**Scale/Scope**: 3 contract records (+1 field each), 3 dashboard services, 1 new internal static helper (`RidingTimeRules`), 2 TS service type files, 3 page components, 1 new TS util, matching unit/service tests, and extensions to 3 existing E2E specs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Directive | Status | Notes |
|-----------|--------|-------|
| DevContainer environment | ✅ PASS | No tooling or environment change |
| Trunk-based delivery + PR flow | ✅ PASS | Feature branch `031-ride-time-stats`; PR links its GitHub issue (T031) |
| TDD mandatory | ✅ PASS | Failing tests come first for: `RidingTimeRules` (nulls excluded, empty list → 0), the three services' new totals (scope, rider isolation, year boundaries), `formatHoursMinutes` (0, <60, exact hours, ≥1,000h), and each page rendering the stat |
| E2E required on every PR | ✅ PASS | Extend `dashboard.spec.ts`, `savings-calculation.spec.ts` (advanced dashboard), and `year-stats-dashboard.spec.ts` to record rides with durations and assert the formatted totals |
| Ports/adapters boundaries | ✅ PASS | The calculation stays in the `Application/Dashboard` service layer, like the mileage sums and `SavingsCalculationRules`. Contracts change only by additive fields. No new adapters. |
| Result-style domain outcomes | ✅ PASS | The calculation is total (cannot fail) and returns a plain `int`. No new exceptions or error paths. |
| Transactional relational write model | ✅ PASS | Read-only feature; nothing is written. Audit logs are unaffected. |
| Local-first runtime posture | ✅ PASS | No new external calls or infrastructure |

**Post-design re-check (Phase 1)**: ✅ All gates remain green. The design adds one internal static helper, three additive non-nullable `int` contract fields, one frontend util, and UI elements on existing pages. There are no new projects, dependencies, endpoints, persistence changes, or layers. All contract changes are additive, so existing clients that ignore unknown JSON fields are unaffected.

## Project Structure

### Documentation (this feature)

```text
specs/031-ride-time-stats/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── riding-time-totals-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/BikeTracking.Api/
├── Application/Dashboard/RidingTimeRules.cs                  # NEW: internal static SumRecordedRideMinutes(IEnumerable<RideEntity>) → int
├── Application/Dashboard/GetDashboardService.cs              # populate DashboardTotals.TotalRideMinutes from all rides
├── Application/Dashboard/GetAdvancedDashboardService.cs      # populate AdvancedDashboardResponse.TotalRideMinutes from all rides
├── Application/Dashboard/GetYearStatsDashboardService.cs     # populate YearStatsTotals.TotalRideMinutes from the year's rides (BuildTotalsSection)
├── Contracts/DashboardContracts.cs                           # DashboardTotals + YearStatsTotals: add int TotalRideMinutes
└── Contracts/AdvancedDashboardContracts.cs                   # AdvancedDashboardResponse: add int TotalRideMinutes (before optional DifficultySection)

src/BikeTracking.Api.Tests/Application/Dashboard/
├── RidingTimeRulesTests.cs                                   # NEW: null exclusion, empty input, plain sum
├── GetDashboardServiceTests.cs                               # extend: all-time total, other-rider isolation, no rides → 0
├── GetAdvancedDashboardServiceTests.cs                       # extend: all-time total, no rides → 0
└── GetYearStatsDashboardServiceTests.cs                      # extend: year-scoped total (Dec 31 / Jan 1 boundary), rides-without-duration year → 0

src/BikeTracking.Frontend/src/
├── utils/ridingTime.ts                                       # NEW: formatHoursMinutes(totalMinutes) → "1,042h 30m"
├── utils/ridingTime.test.ts                                  # NEW
├── services/dashboard-api.ts                                 # DashboardTotals + YearStatsTotals: totalRideMinutes: number
├── services/advanced-dashboard-api.ts                        # AdvancedDashboardResponse: totalRideMinutes: number
├── pages/dashboard/dashboard-page.tsx                        # new "Riding Time" DashboardSummaryCard (+ empty default totalRideMinutes: 0)
├── pages/dashboard/dashboard-page.test.tsx                   # extend
├── pages/advanced-dashboard/advanced-dashboard-page.tsx      # "All-time riding time" line in the Savings Breakdown section
├── pages/advanced-dashboard/advanced-dashboard-page.test.tsx # extend
├── pages/year-stats-dashboard/year-stats-dashboard-page.tsx  # "Total riding time" <dt>/<dd> in year-stats-summary-totals
└── pages/year-stats-dashboard/year-stats-dashboard-page.test.tsx # extend

src/BikeTracking.Frontend/tests/e2e/
├── dashboard.spec.ts                                         # extend: riding time card shows summed durations
├── savings-calculation.spec.ts                               # extend: advanced dashboard all-time riding time
└── year-stats-dashboard.spec.ts                              # extend: year-scoped total, updates on year change
```

**Structure Decision**: Use the existing web-app layout and extend the three dashboard vertical slices in place (C# service → contract → TS type → React page). The only new production types are a small `RidingTimeRules` helper in C#, following the `SavingsCalculationRules` pattern so the three services don't each re-implement the null-excluding sum, and a `formatHoursMinutes` util in TypeScript placed in `src/utils/` because three pages share it. The F# domain project is unchanged. The calculation is an aggregation over persisted ride rows, like the existing mileage totals the services already compute in C#. It is not a domain rule with constants or policy, which is the kind of logic that went to F# for CO2 (see research.md Decision 3).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
