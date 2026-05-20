# Implementation Plan: Local PWA Installation

**Branch**: `022-pwa-local-install` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-pwa-local-install/spec.md`

## Summary

Enable local desktop installation for Bike Tracking as a PWA on Windows (Chrome/Edge), with
online-only ride operations in v1, automatic app updates on relaunch/refresh, and persisted sign-in
for up to 7 days of inactivity. Implementation centers on frontend PWA enablement (manifest,
service worker lifecycle, install UX), plus authentication session persistence policy updates and
clear unsupported-environment messaging.

## Technical Context

**Language/Version**: C# .NET 10 (API), F# .NET 10 (domain unchanged), TypeScript + React 19 (frontend)  
**Primary Dependencies**: ASP.NET Core Minimal API, EF Core SQLite, Aspire, React 19 + Vite, browser PWA capabilities  
**Storage**: SQLite local file for domain data; browser local storage/session storage for client auth/session metadata  
**Testing**: xUnit (backend), Vitest (frontend), Playwright (E2E)  
**Target Platform**: Windows desktop end-user machines; Chrome and Edge for supported install flows  
**Project Type**: Local-first web application (Aspire orchestrated API + frontend)  
**Performance Goals**: Preserve existing API goal (<500ms p95 normal operations); install affordance visible within 1s of app boot; session rehydrate <300ms on launch  
**Constraints**: v1 online-only for ride operations; Windows-only install support; auto-update on relaunch/refresh; re-auth required after 7 days inactivity  
**Scale/Scope**: Single-user local deployment; one installable shell for existing ride tracking flows; no new backend aggregate introduced

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Clean Architecture / Ports-and-Adapters | PASS | PWA/browser APIs isolated in frontend adapter layer; no domain leakage |
| Functional Core / Impure Edges | PASS | Feature is primarily UI/runtime behavior; domain logic remains unchanged |
| Event Sourcing / CQRS | PASS | No changes to event schema required for v1 install capability |
| TDD Red-Green-Refactor | PASS | quickstart defines red tests first for install, session timeout, unsupported environments |
| UX Consistency / Accessibility | PASS | Install guidance and unsupported-environment messaging must remain accessible and keyboard navigable |
| Performance / Observability | PASS | No heavy runtime background work; retain API latency and add client install/update telemetry events |
| Data Validation / Integrity | PASS | Existing server validations unchanged; client session timeout state validated by deterministic timestamp checks |
| Security / Learning | PASS | 7-day inactivity sign-in policy limits stale auth risk; no secrets added to client assets |
| Modularity / Contract-First | PASS | PWA capability contract documented in `contracts/pwa-installation-contract.md` |
| Trunk-Based Delivery / CI | PASS | No branch strategy changes; full CI matrix remains required |

**Post-Design Constitution Re-check**: PASS. Phase 1 artifacts keep changes modular in frontend infrastructure (`src/BikeTracking.Frontend`) and avoid domain/event-store coupling.

## Project Structure

### Documentation (this feature)

```text
specs/022-pwa-local-install/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── pwa-installation-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── BikeTracking.Api/
│   ├── Program.cs
│   ├── Application/
│   ├── Contracts/
│   └── Infrastructure/
├── BikeTracking.Api.Tests/
├── BikeTracking.Domain.FSharp/
├── BikeTracking.Frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
└── BikeTracking.AppHost/
```

**Structure Decision**: Keep existing Aspire web application layout. Implement PWA install/update/session behavior inside `src/BikeTracking.Frontend` with minimal backend touch points only if auth-token semantics require API contract alignment.

## Complexity Tracking

No constitutional violations requiring justification.
