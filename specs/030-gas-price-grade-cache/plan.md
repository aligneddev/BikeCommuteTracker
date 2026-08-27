# Implementation Plan: Gas Price Grade Selection & Cache Refresh Policy

**Branch**: `030-gas-price-grade-cache` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/030-gas-price-grade-cache/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a rider-level "gas grade" preference (Regular/Premium) to `UserSettingsEntity`, make the `GasPriceLookups` cache key grade-aware (`WeekStartDate` + `Grade` instead of `WeekStartDate` alone), and introduce a 3-day freshness window measured from `RetrievedAtUtc` so stale entries are re-fetched on next access (with graceful fallback to the stale value on refresh failure, and cross-request de-duplication so only one external EIA call happens per (week, grade) per staleness event). `GasPriceLookupEntity` gains a nullable `Grade` column (legacy pre-feature rows keep `Grade = NULL` and are never migrated); all rows written going forward always set an explicit `"Regular"`/`"Premium"` value, so grade-aware queries (`WHERE WeekStartDate = @w AND Grade = @g`, `@g` always non-null) never match legacy rows — they become inert history exactly as FR-004a requires, with no separate migration/backfill step needed for old rows (see research.md Decision 2). `EiaGasPriceLookupService`/`IGasPriceLookupService` gain a `grade` parameter that selects the correct EIA product series (`EPMR` regular vs `EPMP` premium) instead of the current all-grades `EPM0` series, apply the 3-day freshness check, and run stale refreshes through a singleton per-(week, grade) de-duplication coordinator. `RidesEndpoints.GetGasPrice` accepts an optional `grade` query-param override (falling back to the rider's saved `UserSettingsEntity.GasGrade`), and the Settings page/API gain a grade selector. A migration adds the nullable `Grade` column to `GasPriceLookups`, replaces its unique index with a composite `(WeekStartDate, Grade)` index, and adds non-nullable `GasGrade` to `UserSettings` (backfilled to `"Premium"` for pre-existing rows via the migration's data-seed step, defaulting to `"Regular"` at the application layer for newly-created settings rows).

## Technical Context

**Language/Version**: .NET 10 (C# backend), F# 9 (domain — not touched by this feature; see research.md Decision 5), TypeScript 5.x + React 19 (frontend)

**Primary Dependencies**: ASP.NET Core Minimal API, EF Core (SQLite) + `IHttpClientFactory` (EIA HTTP calls), xUnit, Vitest + React Testing Library, Playwright

**Storage**: SQLite via EF Core migrations — extends existing `GasPriceLookups` (add `Grade`, replace unique index) and `UserSettings` (add `GasGrade`) tables; no new tables

**Testing**: `dotnet test BikeTracking.slnx`, `cd src/BikeTracking.Frontend && npm run test:unit`, `cd src/BikeTracking.Frontend && npm run test:e2e`

**Target Platform**: Local-first web app (Aspire-hosted API + React frontend)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: No new SLA; adds at most one extra `WHERE Grade = @grade` predicate to an existing indexed single-row lookup, and a bounded per-key async lock only on the (rare) stale-refresh path — negligible added latency on the hot cache-hit path (SC-002 requires same-session reflect of a changed preference, not a performance target)

**Constraints**:
- Grade-aware cache key MUST be `(WeekStartDate, Grade)`; pre-feature ungraded rows MUST remain untouched/unmigrated and MUST NOT be matched by grade-aware queries (FR-004a)
- 3-day freshness is measured from `RetrievedAtUtc` (UTC, via injected `TimeProvider` per repo convention — see research.md Decision 4), survives process restarts because it is durable, not in-memory (Acceptance Scenario 4, US2)
- Stale-refresh de-duplication MUST cap external calls to at most one per (week, grade) per 3-day window under concurrency (FR-007a, SC-003); a refresh failure MUST NOT clear/replace a valid stale cache row (FR-009)
- `UserSettings.GasGrade` MUST be non-nullable after migration; pre-existing rows backfilled to `"Premium"`, new rows default to `"Regular"` at the database/service level (FR-002, FR-002a)
- Endpoint MUST accept an optional `grade` query parameter that overrides the saved preference for a single call without persisting it (FR-011)
- No retroactive changes to gas prices already stored on recorded `RideEntity` rows (FR-005, SC-006)

**Scale/Scope**: `GasPriceLookupEntity`/`EiaGasPriceLookupService`/`IGasPriceLookupService` (backend cache + external lookup), `RidesEndpoints.GetGasPrice` (endpoint), `UserSettingsEntity`/`UserSettingsService`/`UsersContracts` (rider preference), one EF Core migration, `SettingsPage` + `users-api.ts` (frontend preference UI), `ridesService.ts` (grade-aware gas price fetch)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Directive | Status | Notes |
|-----------|--------|-------|
| DevContainer environment | ✅ PASS | No environment/tooling change required |
| Trunk-based delivery + PR flow | ✅ PASS | Work remains on existing feature branch `030-gas-price-grade-cache` |
| TDD mandatory | ✅ PASS | Plan requires failing tests for: grade-aware cache key/index, 3-day staleness, refresh de-duplication, endpoint override param, settings backfill migration, and frontend grade selector — before implementation |
| E2E required on every PR | ✅ PASS | Extend/add an E2E spec asserting a rider can set a gas grade preference in Settings and see it reflected in the ride form's suggested gas price |
| Ports/adapters boundaries | ✅ PASS | Grade/freshness logic stays inside the existing `Application/Rides` + `Application/Users` service layer and `Infrastructure/Persistence` entities; no new external boundary introduced beyond the existing EIA HTTP adapter (now parameterized by grade) |
| Result-style domain outcomes | ✅ PASS | `GetOrFetchAsync` continues to return `decimal?` (null = no price available), matching existing graceful-degradation convention; no new exception-based control flow |
| Transactional relational write model | ✅ PASS | Cache writes remain single-row EF Core inserts/updates with the existing "insert races to unique constraint, re-read on conflict" pattern, extended to `(WeekStartDate, Grade)`; audit-log behavior for rides is unaffected |
| Local-first runtime posture | ✅ PASS | SQLite + local stack unchanged; de-duplication coordinator is in-process (per API instance), consistent with local-first single-instance deployment |

**Post-design re-check (Phase 1)**: ✅ All gates remain green. Design adds one migration, one entity column, one service parameter (`grade`), one small singleton coordinator class, one contract field, and corresponding frontend selector — no new projects, external dependencies, or architectural layers.

## Project Structure

### Documentation (this feature)

```text
specs/030-gas-price-grade-cache/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── gas-price-grade-cache-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/BikeTracking.Api/
├── Application/Rides/GasPriceLookupService.cs              # add grade param, EIA product-series selection, 3-day staleness check, refresh de-dup wiring
├── Application/Rides/GasPriceRefreshCoordinator.cs          # NEW: singleton per-(week, grade) in-flight refresh de-duplication
├── Application/Users/UserSettingsService.cs                 # read/write GasGrade; default "Regular" for new settings rows
├── Contracts/RidesContracts.cs                               # GasPriceResponse: add Grade; GetGasPrice route: add `grade` query param
├── Contracts/UsersContracts.cs                               # UserSettingsUpsertRequest/View: add GasGrade
├── Endpoints/RidesEndpoints.cs                               # GetGasPrice: resolve grade (query override → saved preference), pass to service
├── Infrastructure/Persistence/Entities/GasPriceLookupEntity.cs   # add nullable Grade column
├── Infrastructure/Persistence/Entities/UserSettingsEntity.cs     # add non-nullable GasGrade column
├── Infrastructure/Persistence/BikeTrackingDbContext.cs       # replace unique index WeekStartDate → (WeekStartDate, Grade); configure GasGrade
├── Infrastructure/Persistence/Migrations/                    # NEW migration: AddGasGradeAndCacheRefreshPolicy (add columns, replace index, backfill existing UserSettings rows to "Premium")
└── Program.cs                                                 # register GasPriceRefreshCoordinator as singleton

src/BikeTracking.Api.Tests/
├── Application/GasPriceLookupServiceTests.cs                 # extend: grade-aware cache key, 3-day staleness, refresh-failure fallback, concurrent-refresh de-dup, legacy-row non-match
├── Application/Users/UserSettingsServiceTests.cs              # extend: GasGrade default/save/read
└── Endpoints/RidesEndpointsTests.cs                           # extend: `grade` query-param override behavior

src/BikeTracking.Frontend/src/
├── services/users-api.ts                                     # add gasGrade to settings request/response types
├── services/ridesService.ts                                   # add optional grade param to getGasPrice
├── pages/settings/SettingsPage.tsx                            # add Regular/Premium grade selector
└── pages/settings/SettingsPage.test.tsx                       # assert grade selector renders/saves/defaults

src/BikeTracking.Frontend/tests/e2e/
└── settings.spec.ts                                           # extend to cover setting gas grade preference and its effect on the ride form's suggested price
```

**Structure Decision**: Use the existing web-app layout (C# API service/entity/contract layer → React frontend), extending the existing gas-price and user-settings vertical slices in place. The only new production type is a small singleton `GasPriceRefreshCoordinator` for stale-refresh de-duplication (FR-007a) — no new projects, controllers, or persistence layers are introduced. The F# domain project (`BikeTracking.Domain.FSharp`) is unaffected: grade/freshness logic is I/O-and-cache-shape concerned (HTTP + EF Core), not a pure calculation, so it belongs in the existing C# application service per the ports-and-adapters boundary (see research.md Decision 5).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
