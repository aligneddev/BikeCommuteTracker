# Implementation Plan: Local User Signup and PIN Identity

**Branch**: `001-user-signup-pin` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-user-signup-pin/spec.md`

## Summary

Deliver the first local identity vertical slice: a minimal React signup/identify flow using name + PIN, local persistence with generated user IDs, secure PIN storage via salted non-reversible hash, progressive delay anti-bruteforce protection, and reliable `UserRegistered` event publication with retry semantics after persistence.

## Technical Context

**Language/Version**: .NET 10 (C#), F# (domain project), TypeScript 5.x (React 19 frontend)  
**Primary Dependencies**: ASP.NET Core Minimal API, Microsoft Aspire AppHost, Entity Framework Core + SQLite provider, React 19 + Vite, .NET `System.Security.Cryptography` (PBKDF2), background worker for outbox retry  
**Storage**: SQLite local database with EF Core migrations (users, credentials, attempt-state, outbox events)  
**Testing**: xUnit integration/unit tests for API/domain, Playwright MCP for end-to-end user journeys, React component tests for form validation  
**Target Platform**: Local development on Windows/macOS/Linux; desktop and mobile browsers for UI  
**Project Type**: Aspire-orchestrated web application (frontend + API + local database)  
**Performance Goals**: API endpoints <500ms p95 under normal local load; identification throttle behavior deterministic; event publication catch-up <5s typical  
**Constraints**: Local-only scope; no OAuth or Azure hosting in this slice; no plaintext PIN persistence or response; normalized-name matching (trim + case-insensitive); progressive delay capped at 30s; eventual event publication required after persistence  
**Scale/Scope**: Single local deployment, initial identity workflow only (signup + identify + event emission), hundreds of local user records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Review

| Gate | Status | Notes |
|------|--------|-------|
| Clean Architecture & DDD | PASS | Keep domain rules and value transformations isolated from API/infrastructure concerns. |
| Functional Core / Impure Edge | PASS | Hashing, normalization, and delay calculation remain deterministic functions; DB and event publication isolated at edges. |
| Event Sourcing & CQRS | PASS | `UserRegistered` event is immutable and drives projection/event consumers asynchronously. |
| Quality-First (TDD) | PASS | Test plan will be created in `/speckit.tasks`; implementation remains gated on approved tests. |
| UX Consistency & Accessibility | PASS | React form flow with accessible labels, keyboard navigation, and clear validation feedback. |
| Performance & Observability | PASS | Response and event-lag targets align with constitution SLOs; service defaults keep telemetry enabled locally. |
| Three-Layer Validation | PASS | Validation planned in React form state, API DTO validation, and DB constraints/indexes. |

**Gate Decision**: PASS. No constitutional violations require exception handling.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-signup-pin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── signup-identify-api.yaml
│   └── user-registered-event.schema.json
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── BikeTracking.Api/
│   ├── Program.cs
│   ├── Endpoints/
│   │   └── UsersEndpoints.cs
│   ├── Contracts/
│   │   └── UsersContracts.cs
│   ├── Application/
│   │   ├── Users/
│   │   │   ├── SignupService.cs
│   │   │   └── IdentifyService.cs
│   │   └── Events/
│   │       └── OutboxPublisherService.cs
│   ├── Infrastructure/
│   │   ├── Persistence/
│   │   │   ├── BikeTrackingDbContext.cs
│   │   │   └── Migrations/
│   │   └── Security/
│   │       └── PinHasher.cs
│   └── appsettings.json
├── BikeTracking.Domain.FSharp/
│   ├── Users/
│   │   ├── UserTypes.fs
│   │   └── UserEvents.fs
│   └── Library.fs
├── BikeTracking.Frontend/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── pages/
│       │   └── signup/
│       │       ├── signup-page.tsx
│       │       └── signup-page.css
│       └── services/
│           └── users-api.ts
├── BikeTracking.AppHost/
│   └── AppHost.cs
└── BikeTracking.ServiceDefaults/
    └── Extensions.cs

tests/
├── BikeTracking.Api.Tests/
│   ├── Integration/
│   └── Unit/
└── BikeTracking.Frontend.Tests/
    └── Components/
```

**Structure Decision**: Keep the existing Aspire multi-project monorepo and add feature-specific vertical-slice folders in API, Domain, and Frontend. Introduce dedicated test projects to satisfy constitution quality gates.

## Phase 0 Research Outcomes

Research decisions are documented in [research.md](research.md) and resolve cryptography, throttling, event reliability, and normalized-name matching strategies for this feature.

## Phase 1 Design Outcomes

Phase 1 artifacts are documented in [data-model.md](data-model.md), [contracts/signup-identify-api.yaml](contracts/signup-identify-api.yaml), [contracts/user-registered-event.schema.json](contracts/user-registered-event.schema.json), and [quickstart.md](quickstart.md).

## Post-Design Constitution Re-Check

| Gate | Status | Notes |
|------|--------|-------|
| Clean Architecture & DDD | PASS | Data model separates user identity, credential security, and outbox concerns cleanly. |
| Functional Core / Impure Edge | PASS | Contracts and model keep deterministic rules independent of infrastructure. |
| Event Sourcing & CQRS | PASS | Event contract is immutable and outbox-backed for eventual delivery. |
| Quality-First (TDD) | PASS | Quickstart and contracts define testable behavior for upcoming `/speckit.tasks` generation. |
| UX Consistency & Accessibility | PASS | API and UI contracts keep a minimal accessible flow with explicit validation outcomes. |
| Performance & Observability | PASS | Outbox retry and bounded throttle preserve responsiveness while maintaining reliability. |
| Three-Layer Validation | PASS | Validation rules captured across UI, API contract, and database model. |

**Gate Decision**: PASS after Phase 1 design.

## Complexity Tracking

No constitutional violations or exceptions were introduced in this plan.
