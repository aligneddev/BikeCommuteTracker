# Implementation Plan: Year Stats Dashboard

**Branch**: `026-year-stats-dashboard` | **Date**: 2026-07-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-year-stats-dashboard/spec.md`

## Summary

Add a new, navigable "Year Stats Dashboard" page that lets a rider pick a calendar year and see the same chart types already shown on the main dashboard (mileage trend, savings breakdown) and the advanced dashboard (difficulty by month, most-difficult months, wind resistance distribution), scoped to exactly that year (Jan–Dec) instead of a rolling 12-month or all-time window. The enabling refactor extracts the existing chart-rendering pieces out of `dashboard-chart-section.tsx` and `DifficultyAnalyticsSection.tsx` into standalone, presentational components that already only consume props — so no rendering-layer extraction is required — and instead adds a new backend endpoint + service (`GetYearStatsDashboardService`) that reshapes the *same* F# domain calculations and EF Core query patterns already used by `GetDashboardService`/`GetAdvancedDashboardService`, but filtered to a specific year and iterating Jan–Dec instead of a rolling window or lifetime buckets. No new domain calculation logic is needed; existing pure F# functions (`AdvancedDashboardCalculations.fs`, `WindResistance.fs`) and per-ride snapshot fields (`SnapshotMileageRateCents`, `SnapshotAverageCarMpg`) are reused unchanged for historical accuracy.

## Technical Context

**Language/Version**: .NET 10 (C# 13 backend), F# 9 (domain layer), TypeScript 5.x (React 19 frontend)

**Primary Dependencies**: ASP.NET Core Minimal API, Entity Framework Core 9 (SQLite), Recharts (frontend charting, already in use by `dashboard-chart-section.tsx` / `DifficultyAnalyticsSection.tsx`), xUnit (backend/domain tests), Vitest + React Testing Library (frontend unit tests), Playwright (E2E)

**Storage**: SQLite via existing EF Core entities (`RideEntity`, `UserSettingsEntity`, `RideDifficultySnapshot`-equivalent fields). No schema changes — the feature is read-only and reuses existing columns (`RideDateTimeLocal`, `SnapshotMileageRateCents`, `SnapshotAverageCarMpg`, difficulty/wind fields already read by `GetAdvancedDashboardService`).

**Testing**: `dotnet test BikeTracking.slnx` (new `GetYearStatsDashboardServiceTests`), `cd src/BikeTracking.Frontend && npm run test:unit` (new component/page tests), `npm run test:e2e` (new year-stats-dashboard E2E spec) — per `docs/agent/testing-and-quality-gates.md` verification matrix (cross-layer change → all three required).

**Target Platform**: Local-first desktop web app (SQLite, .NET Aspire host, Tauri sidecar packaging). No new external dependency.

**Project Type**: Web-service with React frontend (existing app extension) — Option 2 layout, matching `018-advanced-dashboard` and `025-monthly-summary-import`.

**Performance Goals**: Year switch must update all charts in under 2 seconds (SC-001). A single year's rides for one rider is a small, indexed, `RiderId`-filtered query (same shape as existing dashboard queries) — no pagination or async job needed.

**Constraints**: Must not change the main dashboard's or advanced dashboard's existing rolling-window/all-time behavior (FR-005, SC-003) — achieved by adding new year-scoped code paths rather than modifying existing rolling-window enumerations. Must reuse ride-setting snapshot fields for historical accuracy (FR-006) — no recomputation against current settings.

**Scale/Scope**: Single rider per request. One year of rides is at most a few hundred rows. Three chart categories (mileage trend, savings breakdown, difficulty/wind analytics) plus a year selector.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Directive | Status | Notes |
|-----------|--------|-------|
| DevContainer environment | ✅ PASS | No tooling changes; work occurs inside existing DevContainer |
| Trunk-based delivery + PR flow | ✅ PASS | Feature branch `026-year-stats-dashboard`; PR-only merge |
| TDD mandatory — failing-test proof first | ✅ PASS | Plan requires failing `GetYearStatsDashboardServiceTests` and frontend component tests before implementation |
| E2E required on every PR | ✅ PASS | New `year-stats-dashboard.spec.ts` Playwright test is a delivery gate |
| Ports-and-adapters + ACL | ✅ PASS | New `GetYearStatsDashboardService` follows the same Application-layer service pattern as `GetDashboardService`/`GetAdvancedDashboardService`; no new external integration |
| Result-style domain outcomes | ✅ PASS | No new F# domain functions needed; existing pure functions already return `option`/typed results. "No data for year" is represented as an explicit empty-state DTO field, not an exception |
| Transactional relational + explicit audit logs | ✅ PASS (N/A) | Read-only feature; no writes, no audit log needed |
| Local-first runtime posture | ✅ PASS | SQLite only; no cloud dependency added |

**Post-design re-check (Phase 1)**: All gates remain green. The design adds one read-only endpoint, one application service, and frontend components/pages only. No existing endpoint, service, or F# module signature changes — `GetDashboardService` and `GetAdvancedDashboardService` are untouched, satisfying FR-005/SC-003.

## Project Structure

### Documentation (this feature)

```text
specs/026-year-stats-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 findings (resolved unknowns)
├── data-model.md         # Response shape, entities touched, no schema changes
├── contracts/
│   └── year-stats-dashboard-api.md   # API endpoint contract
├── quickstart.md        # Validation guide (run guide, not implementation)
└── tasks.md             # Phase 2 output — generated by /speckit.tasks
```

### Source Code (repository root)

```text
src/BikeTracking.Api/
├── Application/
│   └── Dashboard/
│       ├── GetDashboardService.cs              # UNCHANGED — rolling-window main dashboard
│       ├── GetAdvancedDashboardService.cs       # UNCHANGED — all-time/calendar-window advanced dashboard
│       └── GetYearStatsDashboardService.cs      # NEW — year-scoped mileage/savings/difficulty/wind
├── Contracts/
│   └── DashboardContracts.cs                    # EXTEND — add YearStatsDashboardResponse + related DTOs
│                                                 #   (or new YearStatsDashboardContracts.cs if the
│                                                 #   existing file conventions favor a new file)
└── Endpoints/
    └── DashboardEndpoints.cs                    # EXTEND — add GET /api/dashboard/year-stats?year={yyyy}
                                                  #   and GET /api/dashboard/year-stats/years (available years)

src/BikeTracking.Api.Tests/
└── Application/
    └── Dashboard/
        └── GetYearStatsDashboardServiceTests.cs # NEW — year filtering, empty-year state, snapshot accuracy

src/BikeTracking.Domain.FSharp/
# NO NEW FILES — AdvancedDashboardCalculations.fs and WindResistance.fs are reused unchanged;
# year-filtering of the ride list happens in the C# application service before calling into them.

src/BikeTracking.Frontend/src/
├── pages/
│   └── year-stats-dashboard/
│       ├── year-stats-dashboard-page.tsx        # NEW — page: year selector + composed charts
│       └── year-stats-dashboard-page.test.tsx   # NEW
├── components/
│   └── dashboard/
│       ├── dashboard-chart-section.tsx          # EXTEND — accept optional `year`/`seriesLabel` props
│       │                                        #   so it can render either rolling-window (existing,
│       │                                        #   default) or year-scoped (new) series without
│       │                                        #   behavior change when `year` is omitted
│       └── year-selector.tsx                    # NEW — reusable year <select>/segmented control
│   └── (advanced-dashboard components remain colocated with advanced-dashboard page; imported by
│       the new page for the difficulty/wind sections)
├── pages/advanced-dashboard/
│   └── DifficultyAnalyticsSection.tsx           # UNCHANGED (already props-only) — reused as-is by
│                                                  #   passing the year-scoped `section` prop
├── components/app-header/
│   └── app-header.tsx                           # EXTEND — add "Year Stats" NavLink alongside
│                                                  #   Dashboard / Advanced Stats
├── services/
│   └── dashboard-api.ts (or year-stats-dashboard-api.ts)  # NEW/EXTEND — typed fetch helpers:
│                                                  #   getYearStatsDashboard(year), getAvailableYears()
└── App.tsx                                       # EXTEND — register `/dashboard/year-stats` route

src/BikeTracking.Frontend/tests/
└── e2e/
    └── year-stats-dashboard.spec.ts              # NEW — E2E: nav → select year → charts update →
                                                     #   empty-year state
```

**Structure Decision**: Web-application layout (Option 2), matching the existing `018-advanced-dashboard` and `025-monthly-summary-import` features. Backend follows the existing Application/Contracts/Endpoints layering — a new `GetYearStatsDashboardService` sits alongside (not inside) the two existing dashboard services so their rolling/calendar-window behavior is provably untouched (FR-005). Frontend follows the existing `pages/` + `components/` + `services/` pattern; the "extraction into reusable components" required by FR-004 is achieved primarily by threading an optional `year` prop through the already-presentational `dashboard-chart-section.tsx` and by reusing `DifficultyAnalyticsSection.tsx` as-is (it already only depends on a `section` prop, so no code motion is required there — only a year-scoped data source, which is a backend concern).

## Implementation Phases

### Phase 1 — Backend: Year-Scoped Application Service (TDD)

**Scope**: New `GetYearStatsDashboardService.cs` in `src/BikeTracking.Api/Application/Dashboard/`.

- `GetAsync(riderId: long, year: int, cancellationToken)`:
  - Loads rides for `riderId` (same `dbContext.Rides.Where(...).AsNoTracking()` pattern as `GetDashboardService`/`GetAdvancedDashboardService`).
  - Filters to `RideDateTimeLocal.Year == year`.
  - Builds a fixed Jan–Dec series (12 months of the *selected* year, not a rolling window) for mileage and savings, reusing the same per-ride snapshot math (`SnapshotMileageRateCents`, `SnapshotAverageCarMpg`) already in `GetDashboardService`. Months with no rides yield `Miles: 0` / null savings, not omitted — matches "only elapsed/data months" edge case for the in-progress year by naturally returning zero-filled future months, which the frontend renders as flat/no-data rather than projected.
  - Calls existing F# functions from `AdvancedDashboardCalculations.fs` (`calculateDifficultyByMonth`, `calculateWindResistanceDistribution`, `calculateOverallAverageDifficulty`) against the year-filtered ride/snapshot list — no F# changes needed since these already operate on a `RideDifficultySnapshot list` the caller controls.
  - Returns an explicit `HasDataForYear: bool` (or per-section `IsEmpty` flags) so the frontend can render "no data for this year" (FR-007) instead of inferring emptiness from zeroed numbers.
- `GetAvailableYearsAsync(riderId, cancellationToken)`: returns distinct years present in the rider's rides (descending), or `[currentYear]` if none — backs the year selector's option list (FR-002, FR-008).

**TDD gate**: `GetYearStatsDashboardServiceTests.cs` written and run red first, covering:
  - Year with full 12 months of rides → correct per-month mileage/savings.
  - Year with partial data (in-progress year) → non-data months are zero-filled, not fabricated.
  - Year with zero rides → `HasDataForYear == false` / empty-state flags set, no exception.
  - Savings/gallons figures use each ride's own snapshot fields, not current `UserSettings` (regression-proves FR-006).
  - Available-years list reflects distinct ride years only, current year as fallback when no rides exist.

### Phase 2 — Backend: Contracts + Endpoint

**Scope**: Extend `DashboardEndpoints.cs` and dashboard contracts.

- `DashboardContracts.cs` (or new file if the existing one is large): add `YearStatsDashboardResponse`, `YearStatsMileagePoint`, `YearStatsSavingsPoint`, `YearStatsDifficultySection`, `AvailableYearsResponse` records — mirroring the shape/naming of existing `DashboardMileagePoint`/`DashboardSavingsPoint` records for consistency.
- `DashboardEndpoints.cs`:
  - `GET /api/dashboard/year-stats?year={yyyy}` → resolves `riderId` from the `"sub"` claim (same pattern as existing handlers), validates `year` is a plausible int, calls `GetYearStatsDashboardService.GetAsync`.
  - `GET /api/dashboard/year-stats/years` → calls `GetAvailableYearsAsync`.
  - Both `RequireAuthorization()`, documented with `.WithName`/`.WithSummary`/`.Produces<...>` matching existing endpoint conventions.
- No changes to the two existing `/api/dashboard` and `/api/dashboard/advanced` handlers.

### Phase 3 — Frontend: Year Selector + API Client

**Scope**: New reusable year selector and typed API client functions.

- `year-selector.tsx`: presentational component, props `{ years: number[], selectedYear: number, onChange: (year: number) => void }`. Mobile-first, WCAG 2.1 AA (native `<select>` or accessible listbox pattern), no `any` types.
- `dashboard-api.ts` (or new `year-stats-dashboard-api.ts` if the existing file's conventions favor per-feature files, matching `monthly-import-api.ts`): `getYearStatsDashboard(year: number): Promise<ApiResponse<YearStatsDashboardResponse>>`, `getAvailableYears(): Promise<ApiResponse<AvailableYearsResponse>>` — typed request/response interfaces mirrored from the C# contracts, no `any`.

### Phase 4 — Frontend: Chart Component Reuse + New Page

**Scope**: Thread a `year` capability through existing chart-rendering pieces and compose the new page.

- `dashboard-chart-section.tsx`: add optional props (e.g., `title` overrides and a `year`-scoped data source) so the same mileage/savings chart rendering serves both the rolling 12-month main dashboard (default, unchanged) and a fixed Jan–Dec year view — verified by an existing/updated `dashboard-page.test.tsx` snapshot-equivalent assertion proving no visual/behavioral change (SC-003).
- `DifficultyAnalyticsSection.tsx`: reused unchanged — the new page simply passes it a year-scoped `section` prop fetched from the new endpoint.
- `year-stats-dashboard-page.tsx`: composes `year-selector.tsx` + (year-scoped) `dashboard-chart-section.tsx` + `DifficultyAnalyticsSection.tsx`; on mount, fetches available years, defaults to current year or most recent year with data (FR-008), fetches year-stats data on year change (`useEffect` keyed on `selectedYear`), renders in-place updates without navigation (FR-009), and renders an explicit empty state per chart when `HasDataForYear`/section-level empty flags are false (FR-007).
- `App.tsx`: register `<Route path="/dashboard/year-stats" element={<YearStatsDashboardPage />} />` inside the existing `<ProtectedRoute />` block.
- `app-header.tsx`: add a `NavLink` to `/dashboard/year-stats` alongside the existing Dashboard/Advanced Stats links (FR-001, User Story 3).

### Phase 5 — Tests (E2E Gate)

`year-stats-dashboard.spec.ts` Playwright scenarios:
1. Navigate via header nav link → lands on year stats dashboard with a year already selected and charts rendered (US3).
2. Default year is current year, or most recent year with data if current year is empty (FR-008).
3. Switching the year selector updates mileage, savings, and difficulty/wind charts in place, without a page navigation (FR-009).
4. Selecting a year with no ride data shows an explicit "no data for this year" state per chart, not an error or blank chart (FR-007, edge case).
5. Main dashboard (`/dashboard`) still renders its existing rolling 12-month charts unchanged after the refactor (regression check for FR-005/SC-003).

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New service vs. modifying existing dashboard services | New `GetYearStatsDashboardService`, existing services untouched | Directly protects FR-005/SC-003 (no regression to rolling-window/all-time behavior); keeps each service single-purpose per `architecture-principles.md` ("prefer small composable services") |
| Year filtering location | C# application service (LINQ filter before calling F# functions) | F# domain functions (`calculateDifficultyByMonth`, etc.) already accept a caller-supplied list — filtering by year is a query/orchestration concern, not a domain rule, so no F# signature changes are needed |
| Chart component extraction | Thread `year` as an optional prop through existing components rather than physically relocating files | `dashboard-chart-section.tsx` and `DifficultyAnalyticsSection.tsx` are already presentational/props-only (per exploration), so the "extraction" the spec asks for (FR-004) is satisfied by parameterization, avoiding needless file churn while still enabling reuse |
| Empty-year representation | Explicit `HasDataForYear`/per-section empty boolean in the response DTO | Matches "Represent expected... outcomes with explicit... values" (domain-and-error-handling.md); avoids the frontend guessing emptiness from zeroed numbers, satisfying FR-007 |
| Historical accuracy | Reuse per-ride `SnapshotMileageRateCents`/`SnapshotAverageCarMpg` fields exactly as `GetDashboardService` does | Directly satisfies FR-006 and the constitution's audit/accuracy posture; no new snapshot mechanism needed since it already exists |
| Available years source | Query distinct `RideDateTimeLocal.Year` from the rider's own rides, fallback to current year | Matches FR-002/FR-008 exactly; avoids exposing years with no data as selectable, preventing an "empty by surprise" selection |
| New endpoints under `/api/dashboard/year-stats` | Sibling routes to `/api/dashboard` and `/api/dashboard/advanced` | Consistent with existing route grouping in `DashboardEndpoints.cs`; keeps all dashboard-flavored endpoints in one file/route group |
