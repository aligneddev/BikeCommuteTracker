# Bike Tracking Constitution

## Purpose
This constitution defines the non-negotiable engineering governance for Bike Tracking and delegates implementation detail to focused instruction packs.

## Project Statement
Bike Tracking is a local-first commuter application that records rides and computes savings using a .NET Minimal API, an F# domain layer, and a React TypeScript frontend.

## Constitutional Directives
1. Development occurs in the DevContainer environment.
2. Trunk-based delivery applies: short-lived branches, PR-only merge flow, and issue-linked work.
3. TDD is mandatory: failing-test proof must be shown before implementation starts.
4. E2E tests are required for every PR.
5. Architecture follows ports-and-adapters with strict boundary protection and anti-corruption layers.
6. Domain expected-flow outcomes are represented as explicit Result-style values; exceptions are for unexpected failures.
7. Write model is transactional relational with explicit audit logs; read-side projections allowed where helpful. Event sourcing not required.
8. Local-first runtime and observability posture is the default; cloud deployment remains a supported profile.

## Operational Instruction Packs
Detailed rules are maintained in the AGENTS progressive-disclosure tree:

- [Root Agent Guide](../../AGENTS.md)
- [Architecture Principles](../../docs/agent/architecture-principles.md)
- [Domain And Error Handling](../../docs/agent/domain-and-error-handling.md)
- [Testing And Quality Gates](../../docs/agent/testing-and-quality-gates.md)
- [Frontend And UX](../../docs/agent/frontend-and-ux.md)
- [Data Events And Projections](../../docs/agent/data-events-and-projections.md)
- [Delivery And Git Workflow](../../docs/agent/delivery-and-git-workflow.md)
- [Runtime And Observability](../../docs/agent/runtime-and-observability.md)
- [Stack And Environment](../../docs/agent/stack-and-environment.md)
- [Flagged For Deletion](../../docs/agent/flagged-for-deletion.md)

## Conflict Resolution Snapshot
The following governance choices are intentional:

- Authentication: current local PIN/session flow, with OAuth/MSAL as future-phase architecture.
- Frontend delivery: Vite/Aspire dev workflow now, static-hosting profile for deployment scenarios.
- TDD gate: failing-test proof required, committed red checkpoint optional.
- PR gate: E2E required on every PR.

## Change Control
When a directive changes, update this file first, then update impacted instruction pack files in the same change.
