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

## Next Step

Continue with task execution and verification using specs/001-user-signup-pin/tasks.md.
