# Commute Bike Tracker

Local-first Bike Tracking application built with .NET Aspire orchestration, .NET 10 Minimal API, F# domain modules, and an Aurelia 2 frontend.

## Current Feature Slice

- Local user signup with name and PIN
- PIN protection through salted, non-reversible hashing (PBKDF2)
- Duplicate-name rejection using trimmed, case-insensitive normalization
- User identification with progressive retry delay (up to 30 seconds)
- User registration outbox with background retry until successful publication

## Project Structure

- src/BikeTracking.AppHost - Aspire orchestration host
- src/BikeTracking.Api - Minimal API service
- src/BikeTracking.ServiceDefaults - Shared Aspire defaults and telemetry wiring
- src/BikeTracking.Domain.FSharp - Domain event and type modules (F#)
- src/BikeTracking.Frontend - Aurelia 2 frontend app

## Prerequisites

- .NET SDK 10.x
- Node.js 20+ and npm
- CSharpier global tool (required for formatting checks):

```powershell
dotnet tool install csharpier -g
```

run it with `csharpier format .` from the repo root to format all C# code.

- Helpful editor integration: VS Code CSharpier extension (`csharpier.csharpier-vscode`)

## Quick Start

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

3. Open Aspire dashboard and launch:
- frontend service for the signup and identify screen
- api service for local identity endpoints

## Local Identity Endpoints

- GET / - API status
- POST /api/users/signup - create local user record and queue UserRegistered event
- POST /api/users/identify - authorize user by normalized name and PIN

## Local Scope Boundaries

- This slice is local-only and intentionally excludes OAuth and Azure hosting.
- Name and PIN are validated on client and server.
- PIN plaintext is never stored or emitted in events.
- Future cloud and OAuth expansion will be delivered in a separate feature.

## Local User-Machine Install Approach

For local-first deployment to end-user machines, the default persistence model is a local SQLite file.

- No separate database installation or database service is required.
- The API currently defaults to a local SQLite file named biketracking.local.db.
- Startup applies EF Core migrations automatically to create or update schema.
- For packaged installs, place the SQLite file in a user-writable application-data folder rather than the application install directory.
- Before schema upgrades, create a safety backup copy of the SQLite file.
- Use SQL Server LocalDB or SQL Server Express only when local multi-user requirements exceed the single-user SQLite profile.

## Next Step

Continue with task execution and verification using specs/001-user-signup-pin/tasks.md.
