# Bike Tracking Agent Guide

Bike Tracking is a local-first commuter app that records rides and computes savings using a .NET Minimal API, F# domain logic, and a React TypeScript frontend.

## Always Applies
- Work inside the DevContainer only.
- Run the app with `dotnet run --project src/BikeTracking.AppHost`.
- Use TDD with mandatory failing-test proof before implementation.
- E2E tests are required for every PR.
- Run the post-change verification matrix before merge.

## Instruction Packs
- [Architecture Principles](docs/agent/architecture-principles.md)
- [Domain And Error Handling](docs/agent/domain-and-error-handling.md)
- [Testing And Quality Gates](docs/agent/testing-and-quality-gates.md)
- [Frontend And UX](docs/agent/frontend-and-ux.md)
- [Data Events And Projections](docs/agent/data-events-and-projections.md)
- [Delivery And Git Workflow](docs/agent/delivery-and-git-workflow.md)
- [Runtime And Observability](docs/agent/runtime-and-observability.md)
- [Stack And Environment](docs/agent/stack-and-environment.md)
- [Flagged For Deletion](docs/agent/flagged-for-deletion.md)
