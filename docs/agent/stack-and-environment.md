# Stack And Environment

## Scope
Tooling and stack constraints that apply across tasks.

## Required
- Develop inside the DevContainer.
- Backend stack: .NET 10 Minimal API with C# and F# domain layer.
- Frontend stack: React + TypeScript + Vite.
- Local-first data profile uses SQLite by default.
- Keep package dependencies maintained with regular update reviews.

## Canonical Commands
- Start full local stack:
  - `dotnet run --project src/BikeTracking.AppHost`
- Backend tests:
  - `dotnet test BikeTracking.slnx`
- Frontend checks:
  - `cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit`
- E2E tests:
  - `cd src/BikeTracking.Frontend && npm run test:e2e`
