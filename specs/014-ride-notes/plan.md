# Implementation Plan: Ride Notes

**Branch**: `014-ride-notes` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-ride-notes/spec.md`

## Summary

Add rider notes across three existing flows: manual ride record/edit, ride history display, and CSV import. Notes are optional plain text capped at 500 characters, rendered safely via escaped text, and surfaced in history through a compact info indicator with hover/focus/tap accessibility. Oversized imported notes fail row-level validation while valid rows continue importing.

## Technical Context

**Language/Version**: C# .NET 10 (API), TypeScript 6 + React 19 (frontend), F# domain unchanged
**Primary Dependencies**: ASP.NET Core Minimal API, EF Core + SQLite, React 19 + Vite, existing import pipeline (`CsvRideImportService`), existing ride services (`RecordRideService`, `EditRideService`)
**Storage**: SQLite `Rides` table (add nullable note column), existing import job/row tables already include import notes
**Testing**: xUnit (`BikeTracking.Api.Tests`), Vitest (`BikeTracking.Frontend`), Playwright E2E
**Target Platform**: Local-first Aspire web app (Linux/macOS/Windows via DevContainer)
**Project Type**: Full-stack web app (React frontend + Minimal API backend)
**Performance Goals**: No degradation of existing ride record/history UX; history row height remains stable with note indicator; import behavior remains row-resilient
**Constraints**: 500-character hard limit; plain-text storage and escaped rendering; touch and keyboard accessibility; preserve existing event and versioning patterns
**Scale/Scope**: Single feature slice touching existing rides contracts, services, persistence, history page, and import validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Clean Architecture / DDD / Ports-Adapters | PASS | Extend existing contracts, services, and repository-backed EF entity without leaking infra concerns to UI/domain boundaries |
| Functional Core / Side Effects | PASS | Validation and note-display helpers remain deterministic; persistence and HTTP remain at edges |
| Event Sourcing & CQRS | PASS | Ride write path remains through existing ride services/events; additive note field only |
| Quality-First / TDD | PASS | Quickstart defines mandatory red tests first with user confirmation before implementation |
| UX Consistency & Accessibility | PASS | History note reveal includes hover, focus, and touch interaction; row density preserved |
| Performance & Observability | PASS | Compact indicator avoids grid expansion; no new heavy background workloads |
| Data Validation & Integrity | PASS | Dual validation (client + server) with import row-level invalidation for oversized notes |
| Security / Learning | PASS | Plain-text notes and escaped rendering mitigate XSS risks while preserving user-entered content |
| Modularity / Contract-First | PASS | API/frontend contracts for notes defined in contracts artifact before implementation |
| TDD mandatory gate | PASS | Plan enforces red-green-refactor and explicit user confirmation on failing tests |
| Migration test coverage policy | PASS | Additive migration must include migration coverage policy test update |
| Spec completion gate | PASS | Completion includes migration application and full backend/frontend/E2E validation |

**Constitution Check post-design**: PASS. No constitutional violations introduced; design remains additive, modular, and test-first.

## Project Structure

### Documentation (this feature)

```text
specs/014-ride-notes/
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
├── Contracts/
│   ├── RidesContracts.cs
│   └── ImportContracts.cs
├── Application/
│   ├── Rides/
│   │   ├── RecordRideService.cs
│   │   ├── EditRideService.cs
│   │   └── GetRideHistoryService.cs
│   ├── Imports/
│   │   ├── CsvValidationRules.cs
│   │   └── CsvRideImportService.cs
│   └── Events/
│       └── RideRecordedEventPayload.cs
└── Infrastructure/
    └── Persistence/
        ├── Entities/
        │   └── RideEntity.cs
        └── Migrations/

src/BikeTracking.Api.Tests/
├── Application/
│   ├── RidesApplicationServiceTests.cs
│   └── Imports/
│       └── CsvRideImportServiceTests.cs
└── Infrastructure/
    └── MigrationTestCoveragePolicyTests.cs

src/BikeTracking.Frontend/src/
├── pages/
│   ├── RecordRidePage.tsx
│   ├── RecordRidePage.test.tsx
│   ├── HistoryPage.tsx
│   ├── HistoryPage.css
│   └── HistoryPage.test.tsx
├── pages/import-rides/
│   ├── ImportRidesPage.tsx
│   └── ImportRidesPage.test.tsx
└── services/
    └── ridesService.ts
```

**Structure Decision**: Reuse the current backend/frontend split and extend only existing ride/import slices. No new projects are required.

## Implementation Phases

### Phase 0 - Research

Resolved in `research.md`:
- Best-fit note model (optional plain text, max 500 chars)
- Security-safe rendering strategy (escaped output, no HTML rendering)
- Accessible compact history display pattern (hover/focus/tap)
- Import row-level failure behavior for oversized notes
- Test coverage strategy that aligns with TDD and constitution gates

### Phase 1 - Design and Contracts

**Slice 1.1 - Contracts first**
- Add note fields and validation constraints to ride request/response contracts
- Confirm import contracts already carry `Notes` and document oversized-note error contract

**Slice 1.2 - Persistence and event/write model**
- Add nullable note field to `RideEntity` via migration
- Thread note through record/edit services and history projections
- Ensure ride event payload/update path preserves note

**Slice 1.3 - Import validation**
- Extend `CsvValidationRules` with 500-char note validation
- Keep row-level invalid behavior while allowing valid row processing

**Slice 1.4 - Frontend UX**
- Add note input/validation to record ride form
- Add compact note indicator and reveal interactions in history table
- Ensure imported notes render in history via same pattern

### Phase 2 - Verification-ready planning output

- Define red tests first for backend, frontend, and E2E note flows
- Define migration coverage update and full validation command matrix

## Test Plan Summary

| Category | Count | Location |
|----------|-------|----------|
| Backend unit - ride record/edit note validation | 6 | `RidesApplicationServiceTests.cs` and ride service tests |
| Backend unit - import oversized note row handling | 4 | import service/validation tests |
| Endpoint/integration - ride contracts with notes | 4 | rides endpoint tests |
| Persistence/migration coverage | 2 | migration + policy coverage tests |
| Frontend unit - record/history note UX | 8 | `RecordRidePage.test.tsx`, `HistoryPage.test.tsx` |
| Frontend unit - import preview note errors | 3 | `ImportRidesPage.test.tsx` |
| E2E | 3 | create/view note, import mixed rows, safe escaped rendering |
| **Total** | **30** | |

## Complexity Tracking

No constitution violations requiring exception.
