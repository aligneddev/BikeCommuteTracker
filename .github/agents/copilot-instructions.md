# neCodeBikeTracking Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-13

## Active Technologies
- TypeScript 5.x (React 19 + Vite); .NET 10 C# / F# backend (unchanged) + `react-router-dom` v7 (new); React 19, Vite, ASP.NET Core Minimal API (existing) (003-user-login)
- `sessionStorage` (client-side auth session only); SQLite via EF Core (existing, unchanged) (003-user-login)
- C# (.NET 10), F# (domain project present), TypeScript (React 19 + Vite) + ASP.NET Core Minimal API, EF Core, React, MSAL auth flow, existing outbox publisher services (004-create-the-record-ride-mvp)
- SQLite local-file profile via EF Core (with existing SQL-compatible patterns) and outbox events table (004-create-the-record-ride-mvp)

- .NET 10 (C#), F# (domain project), TypeScript 5.x (Aurelia 2 frontend) + ASP.NET Core Minimal API, Microsoft Aspire AppHost, Entity Framework Core + SQLite provider, Aurelia 2 + `@aurelia/router`, .NET `System.Security.Cryptography` (PBKDF2), background worker for outbox retry (001-user-signup-pin)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

.NET 10 (C#), F# (domain project), TypeScript 5.x (Aurelia 2 frontend): Follow standard conventions

## Recent Changes
- 004-create-the-record-ride-mvp: Added C# (.NET 10), F# (domain project present), TypeScript (React 19 + Vite) + ASP.NET Core Minimal API, EF Core, React, MSAL auth flow, existing outbox publisher services
- 003-user-login: Added TypeScript 5.x (React 19 + Vite); .NET 10 C# / F# backend (unchanged) + `react-router-dom` v7 (new); React 19, Vite, ASP.NET Core Minimal API (existing)

- 001-user-signup-pin: Added .NET 10 (C#), F# (domain project), TypeScript 5.x (Aurelia 2 frontend) + ASP.NET Core Minimal API, Microsoft Aspire AppHost, Entity Framework Core + SQLite provider, Aurelia 2 + `@aurelia/router`, .NET `System.Security.Cryptography` (PBKDF2), background worker for outbox retry

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
