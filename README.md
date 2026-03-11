# Commute Bike Tracker

Scaffolded starter structure for a local-first Bike Tracking application.

## What exists now

- .NET 10 Aspire AppHost orchestration
- .NET 10 Minimal API backend with hello endpoints
- F# domain project placeholder
- Aurelia 2 frontend (Vite) with a simple hello screen
- No business logic implemented yet
- No database schema created yet

## Project structure

- src/BikeTracking.AppHost - Aspire orchestration host
- src/BikeTracking.Api - Minimal API service
- src/BikeTracking.ServiceDefaults - Shared Aspire defaults/telemetry wiring
- src/BikeTracking.Domain.FSharp - Domain layer starter project (F#)
- src/BikeTracking.Frontend - Aurelia 2 frontend app

## Prerequisites

- .NET SDK 10.x
- Node.js 20+ and npm

## Quick start

1. Install frontend dependencies:

```powershell
cd src/BikeTracking.Frontend
npm install
```

2. Run the full local app through Aspire:

```powershell
cd ../..
dotnet run --project src/BikeTracking.AppHost
```

3. Open Aspire dashboard and launch services:
- `frontend` for the Aurelia hello screen
- `api` for the Minimal API

## API starter endpoints

- `/` returns API running message
- `/hello` returns hello message

## Next step

Use SpecKit to define the first vertical slice before implementing features.
