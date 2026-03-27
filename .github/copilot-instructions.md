# Bike Tracking: Copilot Development Guide

Local-first commute tracking app using .NET Aspire, Minimal API, F# domain, and React 19 frontend. Built for end-user machines (SQLite-based, no cloud infrastructure required).

## Quick Setup

**Mandatory: Use DevContainer** (all tooling pre-configured).
- `Ctrl+Shift+P` → "Dev Containers: Open Folder in Container"
- Once connected, all dependencies ready (.NET 10 SDK, Node 24+, npm, CSharpier)

**Start the app:**
```bash
dotnet run --project src/BikeTracking.AppHost
```
Aspire Dashboard opens at http://localhost:19629 — launch frontend and API from there.

## Commands

### Backend (.NET 10 / C# / F#)
- **Full solution tests:** `dotnet test BikeTracking.slnx`
- **Single test project:** `dotnet test src/BikeTracking.Api.Tests/BikeTracking.Api.Tests.csproj`
- **Restore deps:** `dotnet restore BikeTracking.slnx`
- **Code formatting:** `csharpier format .` (run from repo root; required before commits)
- **Watch mode (API):** `dotnet watch --project src/BikeTracking.Api` (auto-rebuild on changes)

### Frontend (TypeScript / React 19 / Vite)
From `src/BikeTracking.Frontend`:
- **Dev server:** `npm run dev` (HMR on http://localhost:5173)
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint + Stylelint)
- **Unit tests:** `npm run test:unit` (Vitest; use `--ui` flag for interactive mode)
- **E2E tests:** `npm run test:e2e` (Playwright; runs against live API/DB). You must start the application with Aspire before running E2E tests.
- **Watch unit tests:** `npm run test:unit:watch`

### CI Validation
- **Full CI pipeline:** Run locally before pushing: `dotnet test BikeTracking.slnx && cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit && npm run test:e2e`
- Tests are run in `.github/workflows/ci.yaml` on all PRs and pushes to main

## Architecture

### Projects
- **BikeTracking.AppHost** — .NET Aspire orchestration; starts API, frontend, and dashboard for local dev
- **BikeTracking.Api** — Minimal API (C#); handles routes, EF Core migrations, outbox publishing
- **BikeTracking.Api.Tests** — xUnit backend tests
- **BikeTracking.Domain.FSharp** — Domain logic (F#): discriminated unions for events, pure functions for state transitions, immutable value objects
- **BikeTracking.Frontend** — React 19 + Vite + TypeScript; form-driven UI with react-router-dom v7 for navigation
- **BikeTracking.ServiceDefaults** — Shared Aspire telemetry and OpenTelemetry wiring (all services configured via this)

### Data Model
- **SQLite** (local user-machine deployment; no database service needed)
- EF Core Code-First migrations auto-applied on startup
- **Outbox pattern**: All domain events written to outbox table; background worker retries with progressive delay (up to 30s) until published
- **Event sourcing**: User registration, login, ride records are immutable events; current state derived from event history

### Layering

**F# Domain Layer (BikeTracking.Domain.FSharp):**
- Pure functions: state transitions, calculations
- Discriminated unions: enforce valid event and command structures  
- Immutable types: all domain state immutable by default
- No I/O; no dependencies; trivially testable

**C# API Layer (BikeTracking.Api):**
- Receives commands from frontend (JSON), validates with data annotations
- Calls F# domain functions; receives immutable events
- Writes events to SQLite outbox; EF Core persists
- Minimal API endpoints (no controllers)
- Dependency injection wired via Aspire

**Frontend (React/TypeScript):**
- Form-driven signup (name + PIN), login identify screen
- Client-side validation (required fields, format)
- Server-side validation enforced by API (defense-in-depth)
- sessionStorage for auth tokens (not persisted to disk)

## Key Conventions & Patterns

### Test-Driven Development (TDD)
- **Mandatory red-green-refactor cycle**: Write failing tests first, confirm failure with user, implement, validate all green
- Backend tests (xUnit) target pure domain logic (F#) — 85%+ coverage expected
- Frontend tests: unit tests (Vitest) for components; E2E tests (Playwright) for full-stack signup/login flow against live API
- E2E tests use SQLite DB, throw data away after each test (integration-like behavior)
- Always validate test failures before implementation (prove tests are meaningful, not vacuous)

### F# Domain Patterns
- **Railway Oriented Programming (Result<'T>)**: All domain functions return `Result<'T, Error>` for explicit error handling
- **Discriminated unions**: Commands and Events use DUs to enforce valid states (no invalid combinations)
- **Active patterns**: Optional patterns for complex state matching
- **Immutable records**: All domain types immutable; constructors enforce invariants
- Reference F# docs: https://fsharp.org/

### C# API Patterns
- **Data annotations** on request DTOs: [Required], [StringLength], [EmailAddress], etc. (enforced by ASP.NET Core)
- **Minimal API endpoints**: Map HTTP verbs directly; no controller classes
- **Dependency injection**: Services registered in Program.cs; Aspire handles wiring
- **EF Core DbContext**: QueryTimeout for long-running queries; migrations auto-applied on startup
- Reference: https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis

### React / TypeScript Frontend
- **React 19 patterns**: Hooks (useState, useEffect), functional components only
- **React Router v7**: useNavigate() for programmatic navigation, useParams() for route params
- **Form handling**: Uncontrolled forms (ref-based) or controlled components (useState); validate before submit
- **Client-side validation**: Required fields, format checks; must match server-side rules
- **No inline CSS**: Use .css files with Stylelint + ESLint rules; import in component
- **Component organization**: One component per file; descriptive PascalCase names; co-locate tests with components
- Reference: https://react.dev/

**TypeScript Type Safety (Critical):**
- **NO `any` types allowed** — use explicit types for all variables, parameters, return values
- **Component props**: Define explicit interface (e.g., `interface SignupFormProps { onSuccess: () => void; }`)
- **API contracts**: Define TypeScript types matching backend DTOs (e.g., `interface UserSignupRequest { name: string; pin: string; }`)
- **React hooks**: Type hook parameters and return values (e.g., `const [name, setName] = useState<string>('')`)
- **Form refs**: Type refs explicitly (e.g., `useRef<HTMLInputElement>(null)`)
- **Event handlers**: Type event objects (e.g., `(e: React.FormEvent<HTMLFormElement>) => void`)
- **Route params**: Define param types (e.g., `interface RouteParams { userId: string; }` then `useParams<RouteParams>()`)
- **Service functions**: Return typed Promises (e.g., `async function identifyUser(name: string, pin: string): Promise<User> { ... }`)
- Use `unknown` only when truly dynamic; narrow with type guards
- Use discriminated unions for state variants (e.g., `type PageState = { status: 'loading' } | { status: 'success'; data: User } | { status: 'error'; message: string }`)
- Reference TypeScript handbook: https://www.typescriptlang.org/docs/

### Event Sourcing & Outbox
- **No direct side effects in domain**: Domain functions are pure; I/O happens at API layer
- **Events are immutable**: Once persisted, events never change; corrections via new events
- **Outbox table**: Every API write also writes to outbox; background job publishes with exponential backoff
- **Idempotency**: Handlers must be safe to re-execute (outbox may retry)

## Local Development Deployment

- **Target deployment**: Local user machines (Windows, macOS, Linux)
- **Database**: SQLite file (default: `biketracking.local.db` in app root; move to user-writable app-data folder for packaged installs)
- **Pre-install safety**: Before schema upgrades, users should back up the SQLite file
- **No separate services needed**: No Docker, no separate database server, no cloud provider required
- **Multi-user setup**: For multi-user requirements on a single machine, consider SQL Server LocalDB or SQL Server Express (future phase)
