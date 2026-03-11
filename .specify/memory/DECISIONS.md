# Bike Tracking Application — Decision Record

This document preserves the amendment history and decision rationale for the [Bike Tracking Constitution](./constitution.md). Refer to this file when understanding why specific architectural choices were made and how the project governance has evolved.

## Key Decision Rationales

### Why Specification-Driven Development (SDD)?

The Bike Tracking project uses SpecKit to enforce Specification-Driven Development. Each feature is captured in a specification document before coding begins. Benefits:

- **Clarity**: Spec approval removes ambiguity before implementation
- **Testing discipline**: Test plan approved upfront; tests written idempotently
- **Accountability**: User signs off on specifications and acceptance criteria
- **Traceability**: Each commit references a spec; easy to understand why code exists
- **Quality gates**: Code review verifies architecture alignment with constitution

### Why Event Sourcing + CQRS?

Bike Tracking tracks rides, expenses, and savings over time. Event Sourcing enables:

- **Complete audit trail**: Every change (record ride, edit distance, recalculate savings) stored as immutable event
- **Temporal queries**: "Show me rides in March 2024" via event filters  
- **Replay & debugging**: Event replay reconstructs state at any point in time
- **CQRS separation**: Write path (append events) faster than read path (query projections)
- **Future analytics**: Events preserve data for future analyses (e.g., weather correlations, motivation patterns)

Trade-offs: Added complexity (separate event/projection tables, eventual consistency, schema versioning). Justified for a financial/historical application.

### Why F# for Domain Layer?

F# enforces functional programming discipline at compile time, reducing bug categories:

- **Discriminated unions**: Model "ride recorded" vs "ride deleted" as separate types; compiler prevents invalid state transitions
- **Pattern matching**: Exhaustive event handling; compiler warns if new event type not handled
- **Immutability by default**: All data structures immutable unless explicitly marked mutable (rare)
- **Reduced null references**: F# option types (`Some`/`None`) replace nullable C# (no "null reference exception" fears)
- **ROP (Railway Oriented Programming)**: Error handling via `Result<'T, 'E>` instead of exceptions; control flow explicit

Trade-offs: Team requires F# training; C#/F# interop requires value converters. Effort pays off in reduced production bugs (discriminated unions catch invalid states at compile time).

### Why Aspire Orchestration?

Microsoft Aspire enables:

- **Local-to-cloud parity**: Develop locally with Docker containers; same Bicep IaC deploys to Azure
- **Service discovery**: Services find each other automatically in Aspire dashboard (no hardcoded URLs)
- **Secrets management**: Azure Key Vault connection tested locally; same vault used in Azure
- **Team onboarding**: `dotnet run` spins up full stack (API, frontend, DB, functions) with one command
- **Health checks**: Dashboard shows service health in real-time

Trade-offs: Docker/Podman required; slight learning curve. Simplifies DevOps and debugging pipelines.

### Why Three-Layer Validation?

Data integrity is non-negotiable for financial data (savings calculations):

1. **Client-side (Aurelia 2)**: Immediate feedback; better UX responsiveness
2. **Server-side (API)**: Prevents bypass attacks; enforces business rules
3. **Database layer**: Last-line defense; constraints prevent corrupted data from entering event store

If any layer is missing, data corruption risk rises. All three required.

### Why Aurelia 2?

Aurelia 2 provides a lightweight, modern TypeScript-based frontend with:

- **Strong composability**: Components are simple, reusable, and testable; no framework lock-in
- **Standards-based**: Built on modern web standards (ES modules, Web Components patterns); minimal runtime overhead
- **Flexible deployment**: Static site hosting for local-first development; compiles to plain HTML/CSS/JavaScript with no server dependency
- **TypeScript support**: Full type safety; integrates seamlessly with modern build tooling
- **Validation patterns**: Native browser constraints + Aurelia validation library; official docs at https://docs.aurelia.io/

Trade-offs: Smaller ecosystem than Blazor; requires JavaScript/TypeScript familiarity. Justified for high portability and low deployment friction (static site hosting) in local-first architecture.

### Amendment: Why Switched from Blazor WebAssembly to Aurelia 2 (v1.9)?

**Decision Date**: 2026-03-11  
**Trigger**: User evaluation of frontend technology alternatives for local-first deployment  
**Rationale**: 
- Blazor WASM introduces browser download overhead (initial 2–6MB load) and requires .NET runtime download, which conflicts with mobile-first design goals
- Aurelia 2 compiles to lightweight static assets suitable for both local and cloud-static hosting (Azure Static Web Apps)
- TypeScript ecosystem provides strong tooling, clear separation of frontend/backend concerns, and simpler local development (no ASP.NET integration needed for frontend build)
- Aurelia's official docs (https://docs.aurelia.io/) provide canonical implementation guidance

**Changes**:
- Constitution v1.9: All frontend references updated from Blazor WASM to Aurelia 2
- Principle V: UI built with Aurelia 2 components + centralized theme tokens
- Principle VII: Client-side validation switched to Aurelia 2 validation patterns
- Frontend stack: Framework = Aurelia 2 v2.x; Authentication = MSAL.js; Hosting = static assets
- Infrastructure: Local deployment frontend built as Aurelia app; cloud deployment as static assets in Azure Static Web Apps or Blob Storage

**Impact**: 
- No C# required for frontend; backend remains .NET 10/C# (Aspire, Minimal API, EF Core)
- Clear technology boundary: backend (C#/.NET) handles business logic + API; frontend (TypeScript/Aurelia) handles UI
- Simpler local onboarding: no Blazor build pipeline; TypeScript tooling familiar to web developers

**Affected Specs**: Any new specs referencing frontend must target Aurelia 2; all Blazor-specific validation examples in specs are obsolete

---

## Future Potential Amendments

These topics are under consideration for future constitution amendments (not yet ratified):

### Option 1: Projection Lag SLO
**Trigger**: If business needs tighter saga/process manager orchestration  
**Change**: Reduce "eventual consistency within 5 seconds" to "within 1 second" for critical projections  
**Impact**: May require moving from Change Event Streaming to in-process event handlers; architectural complexity or Azure Cosomos DB
**Decision pending performance measurement in production**

### Option 2: API Versioning Strategy
**Trigger**: When breaking Minimal API changes are required (e.g., new command format)  
**Change**: Add API versioning principle via URL paths (/v1/, /v2/) or headers  
**Impact**: Multiple code paths to maintain; dual testing of old+new APIs  
**Decision pending first breaking change scenario**

---

**Last Review**: 2026-03-11  
**Next Review**: 2026-04-11
