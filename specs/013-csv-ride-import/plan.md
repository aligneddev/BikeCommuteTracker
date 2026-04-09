# Implementation Plan: CSV Ride Import

**Branch**: `013-csv-ride-import` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-csv-ride-import/spec.md`

## Summary

Add a new rider-facing CSV import workflow linked from Settings. Riders upload a CSV containing
Date, Miles, Time, Temp, Tags, and Notes, preview validation results, resolve duplicates, and run
a long-running server-side import job with 25% progress updates and 5-minute rounded ETA. Import
enrichment follows a cache-first strategy for gas price and weather, then external lookup on cache
miss with retry-once-on-failure behavior and 4 calls/second throttling.

## Technical Context

**Language/Version**: C# .NET 10 (API), F# .NET 10 (domain unchanged), TypeScript 6 + React 19 (frontend)
**Primary Dependencies**: .NET 10 Minimal API, EF Core + SQLite, Aspire orchestration, React 19 + Vite, react-router-dom, existing gas/weather application services, existing realtime notification stack
**Storage**: SQLite local database via EF Core; additive import-job and import-row persistence; existing ride/event/outbox persistence
**Testing**: xUnit (backend unit/integration), Vitest (frontend unit), Playwright (E2E)
**Target Platform**: Local-first web app in DevContainer on Linux/macOS/Windows hosts
**Project Type**: Aspire-orchestrated web app (React frontend + Minimal API backend)
**Performance Goals**: Import progress visible within 2 seconds of confirmation; progress events at 25/50/75/100%; 100-row import completes within 5 minutes in normal local conditions
**Constraints**: Preserve existing event-sourced ride model; no breaking API contract changes; enrich from cache first; external lookup throttle 4 calls/sec; retry once then skip enrichment field; duplicate detection keyed by date+miles; cancellation keeps already imported rows
**Scale/Scope**: Single-rider local deployment; expected imports in tens to low thousands of rows; one new import page, one import job backend slice, additive contracts and persistence

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Clean Architecture / DDD | PASS | Import orchestration in application service; parsing/validation/enrichment isolated from endpoints/UI |
| Functional Core / Side Effects | PASS | Row normalization, duplicate detection keys, ETA calculation are pure helpers; file I/O and API calls remain at edges |
| Event Sourcing & CQRS | PASS | Imported rides still persisted as ride events + read models through existing write path |
| Quality-First / TDD | PASS | Quickstart defines explicit red tests for parser, duplicate flow, progress signaling, enrichment fallback |
| UX Consistency & Accessibility | PASS | New Settings-linked page keeps existing React/CSS patterns and accessible dialogs/status messaging |
| Performance & Observability | PASS | Long-running job includes progress telemetry, retry policy, throttling, and status query surface |
| Data Validation & Integrity | PASS | CSV schema + row validation mirrors existing ride validation; duplicate resolution explicit before writes |
| Experimentation / Security | PASS | Small vertical slice behind authenticated route; external API calls remain server-side only |
| Modularity / Contract-First | PASS | API/import contracts documented first in contracts artifact before implementation |
| TDD mandatory gate | PASS | Plan requires user confirmation on failing tests before code implementation |
| Migration test coverage policy | PASS | New persistence objects/migration must include migration policy test update |
| Spec completion gate | PASS | Completion requires migration apply + backend tests + frontend lint/build/unit + E2E |

**Constitution Check post-design**: PASS. Phase 1 design keeps additive schemas, contract-first boundaries, and test-first workflow with no constitutional violations.

## Project Structure

### Documentation (this feature)

```text
specs/013-csv-ride-import/
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
│   ├── Imports/
│   │   ├── CsvRideImportService.cs                 ← NEW
│   │   ├── CsvParser.cs                            ← NEW
│   │   ├── DuplicateResolutionService.cs           ← NEW
│   │   └── ImportProgressEstimator.cs              ← NEW
│   ├── Rides/
│   │   ├── RecordRideService.cs                    ← reuse for imported rows
│   │   └── EditRideService.cs                      ← optional replacement path when user selects replace
│   └── Notifications/
│       └── ImportProgressNotifier.cs               ← NEW (25% milestones)
├── Contracts/
│   ├── ImportContracts.cs                          ← NEW
│   └── RidesContracts.cs                           ← may extend summary payload references
├── Endpoints/
│   ├── ImportEndpoints.cs                          ← NEW
│   └── SettingsEndpoints.cs                        ← extend navigation metadata if needed
└── Infrastructure/
    └── Persistence/
        ├── Entities/
        │   ├── ImportJobEntity.cs                  ← NEW
        │   └── ImportRowEntity.cs                  ← NEW
        ├── BikeTrackingDbContext.cs                ← NEW mappings
        └── Migrations/
            └── {timestamp}_AddCsvRideImport.cs     ← NEW

src/BikeTracking.Api.Tests/
├── Application/
│   ├── Imports/
│   │   ├── CsvParserTests.cs                       ← NEW
│   │   ├── CsvRideImportServiceTests.cs            ← NEW
│   │   ├── DuplicateResolutionServiceTests.cs      ← NEW
│   │   └── ImportProgressEstimatorTests.cs         ← NEW
│   └── Rides/
│       └── RecordRideServiceTests.cs               ← extend imported-row integration coverage
├── Endpoints/
│   └── ImportEndpointsTests.cs                     ← NEW
└── Infrastructure/
    └── MigrationTestCoveragePolicyTests.cs         ← extend with migration entry

src/BikeTracking.Frontend/src/
├── pages/
│   ├── settings/
│   │   ├── SettingsPage.tsx                        ← add Import Rides entry
│   │   └── SettingsPage.test.tsx                   ← extend
│   └── import-rides/
│       ├── ImportRidesPage.tsx                     ← NEW
│       ├── ImportRidesPage.css                     ← NEW
│       └── ImportRidesPage.test.tsx                ← NEW
├── components/
│   └── import-rides/
│       ├── DuplicateResolutionDialog.tsx           ← NEW
│       └── ImportProgressPanel.tsx                 ← NEW
├── services/
│   ├── import-api.ts                               ← NEW
│   └── import-api.test.ts                          ← NEW
└── App.tsx                                         ← route wiring
```

**Structure Decision**: Existing web app split retained. Backend artifacts stay in
`src/BikeTracking.Api` and `src/BikeTracking.Api.Tests`; frontend artifacts stay in
`src/BikeTracking.Frontend/src`. No new projects added.

## Implementation Phases

### Phase 0 - Research

Resolved in `research.md`:
- CSV parsing strategy and header normalization
- Duplicate key policy (date+miles) and override behavior
- Progress signaling milestones and ETA rounding algorithm
- Cache-first enrichment with external lookup fallback and retry/throttle rules
- Cancellation semantics and partial completion guarantees

### Phase 1 - Design and Contracts

**Slice 1.1 - Contracts first**
- Define request/response contracts for upload, preview, duplicate resolution, job start, status,
  cancellation, and completion summary
- Define frontend DTOs matching backend contracts

**Slice 1.2 - Data model and persistence**
- Add import job + import row entities and states
- Add migration and migration coverage policy update

**Slice 1.3 - Import orchestration**
- Implement parser/validator pipeline
- Implement duplicate resolution + override flow
- Integrate ride creation through existing write services

**Slice 1.4 - Enrichment integration**
- Cache-first gas/weather lookup
- External lookup on cache miss
- Retry once then skip enrichment field
- Apply shared throttling (4 calls/sec)

**Slice 1.5 - Progress + cancellation**
- Compute milestone thresholds and emit 25/50/75/100 updates
- Persist job status and ETA snapshots
- Support cancel-in-progress while keeping imported rows

### Phase 2 - Frontend UX slice

**Slice 2.1 - Navigation + upload**
- Add Settings link and import route
- Upload file, parse preview, show validation errors

**Slice 2.2 - Duplicate workflow**
- Show duplicate dialog with existing vs incoming details
- Keep existing / replace / override-all options

**Slice 2.3 - Long-running feedback**
- Progress panel with milestone updates
- ETA in 5-minute increments
- Completion and cancellation summaries

## Test Plan Summary

| Category | Count | Location |
|----------|-------|----------|
| Backend unit - CSV parsing/validation | 8 | `Application/Imports/CsvParserTests.cs` |
| Backend unit - duplicate detection/resolution | 6 | `Application/Imports/DuplicateResolutionServiceTests.cs` |
| Backend unit - enrichment fallback/retry/throttle | 7 | `Application/Imports/CsvRideImportServiceTests.cs` |
| Backend unit - progress + ETA | 5 | `Application/Imports/ImportProgressEstimatorTests.cs` |
| Endpoint/integration - import lifecycle | 7 | `Endpoints/ImportEndpointsTests.cs` |
| Persistence/migration coverage | 3 | `Infrastructure/MigrationTestCoveragePolicyTests.cs` + persistence tests |
| Frontend unit | 8 | import page/dialog/progress panel + API service tests |
| E2E | 5 | upload/preview, duplicate resolution, override-all, long-run progress, cancellation |
| **Total** | **49** | |

## Complexity Tracking

No constitution violations requiring exception.
