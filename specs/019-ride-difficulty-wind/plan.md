# Implementation Plan: Ride Difficulty & Wind Resistance Rating

**Branch**: `019-ride-difficulty-wind` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/019-ride-difficulty-wind/spec.md`

## Summary

Add optional ride difficulty rating (1–5) and primary travel direction (8-point compass) fields to the record-ride and edit-ride flows. At save time, compute and persist a `WindResistanceRating` (−4 to +4) using a cosine-based formula against the ride's captured wind speed and direction. The Advanced Dashboard gains a difficulty analytics section (overall average, calendar-month breakdown, most-difficult-month ranking, wind resistance distribution chart). CSV import is extended to accept `Difficulty` and `Direction` columns. The wind resistance formula lives as a pure F# function in `BikeTracking.Domain.FSharp`; all UI suggestion pre-filling mirrors the formula in TypeScript for instant feedback without a round-trip.

## Technical Context

**Language/Version**: C# (.NET 10) — API layer; F# (latest stable) — domain layer; TypeScript/React 19 — frontend  
**Primary Dependencies**: ASP.NET Core Minimal API, Entity Framework Core (SQLite), Recharts 3.x, React Router v7, .NET Aspire  
**Storage**: SQLite via EF Core Code-First migrations (auto-applied on startup via `MigrateAsync()`)  
**Testing**: xUnit 2.9.3; EF Core In-Memory for unit tests; SQLite integration tests for endpoints  
**Target Platform**: .NET Aspire local-first; containerised deployment via Azure Container Apps (optional)  
**Project Type**: Web service + SPA frontend  
**Performance Goals**: API response <500ms p95; difficulty suggestion pre-fill <1 second (SC-002); dashboard section loads within existing dashboard budget (SC-005)  
**Constraints**: No inline CSS; no TypeScript `any` types; three-layer validation (client / server / DB); outbox pattern for all ride mutations; Railway Oriented Programming in F# domain  
**Scale/Scope**: Single-rider, local-first; existing ride history rows extended with 3 nullable columns; 3 new F# types; 2 new migration columns + 1 index

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| **I – Ports & Adapters** | Wind resistance formula is a pure F# function in domain layer; C# service layer calls it; no business logic in API endpoints | ✅ PASS |
| **I – No god services** | Formula logic lives in `WindResistance.fs`; `RecordRideService` / `EditRideService` are orchestrators only | ✅ PASS |
| **I – ACL for third-party** | No new third-party integrations; existing `IWeatherLookupService` already wraps Open-Meteo | ✅ PASS |
| **II – Pure functions** | `WindResistance.fs` has zero side effects; same inputs always return same output; F# `Result<'T>` for error paths | ✅ PASS |
| **III – Event Sourcing** | `RideRecordedEventPayload` and `RideEditedEventPayload` extended with new fields; outbox pattern preserved | ✅ PASS |
| **IV – TDD gates** | Unit tests for F# formula module required; integration tests for RecordRide/EditRide with direction; dashboard difficulty tests required | ✅ PASS |
| **V – Three-layer validation** | React client-side (1–5 range, enum); DataAnnotations server-side; DB CHECK constraints in migration | ✅ PASS |
| **VI – C# Result types** | F# domain returns `Result<int * int, WindResistanceError>`; C# unwraps via `FSharpValue.GetUnionFields` pattern | ✅ PASS |
| **VII – Frontend standards** | CSS class-only styling; TypeScript string literal union for `CompassDirection`; no `any` types | ✅ PASS |
| **VIII – Outbox** | All ride mutations (RecordRide, EditRide) publish via OutboxEventEntity; no direct event publish | ✅ PASS |
| **X – Trunk-based dev** | Short-lived feature branch `019-ride-difficulty-wind`; PR-gated merge; no long-lived branches | ✅ PASS |

**Gate result: ALL PASS — no violations requiring justification.**

## Project Structure

### Documentation (this feature)

```text
specs/019-ride-difficulty-wind/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← entity changes + F# types
├── quickstart.md        ← developer implementation guide
├── contracts/
│   ├── rides-api.md     ← modified ride endpoints
│   ├── dashboard-api.md ← extended advanced dashboard endpoint
│   └── csv-import-format.md ← extended CSV column spec
└── tasks.md             ← Phase 2 output (NOT created by /speckit.plan)
```

### Source Code Changes (repository root)

```text
src/
├── BikeTracking.Domain.FSharp/
│   └── WindResistance.fs                        # NEW: pure wind resistance module
│
├── BikeTracking.Api/
│   ├── Infrastructure/Persistence/
│   │   ├── Entities/
│   │   │   └── RideEntity.cs                    # EXTEND: +Difficulty, +PrimaryTravelDirection, +WindResistanceRating
│   │   └── Migrations/
│   │       └── YYYYMMDD_AddRideDifficultyAndWindRating.cs  # NEW
│   ├── Application/
│   │   ├── Rides/
│   │   │   ├── RecordRideService.cs             # EXTEND: compute WindResistanceRating at save
│   │   │   └── EditRideService.cs               # EXTEND: recompute on PrimaryTravelDirection change
│   │   ├── Imports/
│   │   │   ├── CsvValidationRules.cs            # EXTEND: Difficulty + Direction columns
│   │   │   ├── CsvParser.cs                     # EXTEND: parse new columns
│   │   │   └── SampleCsvGenerator.cs            # NEW: generate sample CSV with all columns
│   │   ├── Events/
│   │   │   ├── RideRecordedEventPayload.cs      # EXTEND: +Difficulty, +PrimaryTravelDirection, +WindResistanceRating
│   │   │   └── RideEditedEventPayload.cs        # EXTEND: same new fields
│   │   └── Dashboard/
│   │       └── GetAdvancedDashboardService.cs   # EXTEND: difficulty analytics section
│   ├── Contracts/
│   │   ├── RidesContracts.cs                    # EXTEND: request/response records
│   │   └── DashboardContracts.cs               # EXTEND: AdvancedDashboardDifficultySection
│   └── Endpoints/
│       ├── RidesEndpoints.cs                    # EXTEND: wire GET /api/rides/csv-sample
│       └── DashboardEndpoints.cs               # EXTEND (if separate file exists)
│
├── BikeTracking.Frontend/src/
│   ├── pages/
│   │   ├── RecordRidePage.tsx                   # EXTEND: direction + difficulty fields + auto-suggest
│   │   ├── HistoryPage.tsx                      # EXTEND: direction/difficulty columns in grid
│   │   └── import-rides/
│   │       └── ImportRidesPage.tsx              # EXTEND: Difficulty/Direction error messages
│   └── pages/advanced-dashboard/
│       ├── advanced-dashboard-page.tsx          # EXTEND: render DifficultyAnalyticsSection
│       └── DifficultyAnalyticsSection.tsx       # NEW: monthly chart + ranking + wind resistance chart
│   ├── services/
│   │   └── ridesService.ts                      # EXTEND: types for new fields
│   └── utils/
│       └── windResistance.ts                    # NEW: client-side formula mirror for instant suggestion
│
└── BikeTracking.Api.Tests/
    ├── Application/
    │   ├── Rides/
    │   │   └── WindResistanceCalculationTests.cs  # NEW
    │   └── Dashboard/
    │       └── DifficultyAnalyticsTests.cs         # NEW
    └── Endpoints/
        └── Rides/
            └── RecordRideWithDifficultyTests.cs    # NEW (integration)

## Complexity Tracking

> No violations — gate check clean; no complexity justification required.
