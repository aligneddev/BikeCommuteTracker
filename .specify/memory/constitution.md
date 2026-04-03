# Bike Tracking Application Constitution
<!-- Sync Impact Report v1.12.0
Rationale: Added explicit modularity and contract-first collaboration governance so teams can deliver independently in parallel while preserving interoperability through stable interfaces and versioned contracts.
Modified Sections:
- Principle IX: Added explicit Modularity, Interfaces & Contract-First Collaboration principle
- Development Workflow: Added contract-first parallel delivery guidance
- Definition of Done: Added interface/contract compatibility verification requirement
- Testing Strategy: Added integration contract-compatibility testing expectation
- Development Approval Gates: Added contract boundary freeze gate before implementation
- Compliance Audit Checklist: Added modular boundary and contract compatibility checks
- Guardrails: Added non-negotiable interface/contract boundary rules for cross-module integration
Status: Approved — modular architecture and contract-first parallel delivery are now constitutional requirements
Current Update (v1.13.0): Added Principle X — Trunk-Based Development, Continuous Integration & Delivery. Codified branching strategy (short-lived feature branches, git worktrees, PR-gated merges with validation builds), feature flag governance (max 5 active, mandatory cleanup), and PR completion policy (owner-only completion, GitHub issue linkage required).
Previous Update (v1.12.3): Added mandatory per-migration test coverage governance requiring each migration to include a new or updated automated test, enforced by a migration coverage policy test in CI.
Previous Updates:
- v1.12.2: Added mandatory spec-completion gate requiring database migrations to be applied and E2E tests to pass before a spec can be marked done.
- v1.11.0: Strengthened TDD mandate with a strict gated red-green-refactor workflow requiring explicit user confirmation of failing tests before implementation.
- v1.10.2: Codified a mandatory post-change verification command matrix so every change runs explicit checks before merge.
- v1.10.1: Clarified the local deployment approach for end-user machines by standardizing SQLite local-file storage as the default profile and documenting safety expectations for storage path and upgrades.
- v1.10: Added an explicit engineering mindset for small-batch experimentation, continuous learning, complexity management, mandatory change validation, and proactive security teaching/remediation.
- v1.9: Replaced Blazor WebAssembly frontend direction with Aurelia 2. Updated Principle V and all frontend-related sections for consistency. Added an explicit rule to always reference official Aurelia documentation at https://docs.aurelia.io/.
- v1.8: Scoped Aspire Dashboard to local development only; removed cloud Aspire Dashboard requirement. Clarified local-first deployment priority with Azure as a future target. Strengthened public GitHub repository secret safety guidance.
- v1.7: Clarified that Blazor WASM frontend is fully orchestrated by Aspire locally; a single `dotnet run` command starts the entire application stack including API, database, and WASM frontend.
- v1.6: Adopted Blazor WebAssembly (WASM) as the frontend hosting model, enabling static site hosting for the UI while maintaining containerized API in both local and cloud.
- v1.5: Standardized containerized hosting for local development and cloud deployments using Azure Container Apps. Clarified that static hosting for the Blazor app is allowed only for Blazor WebAssembly builds.
- v1.4: Applied Aspire Dashboard UI requirement to cloud deployments in addition to local diagnostics.
- v1.3: Standardized telemetry on Aspire built-in OpenTelemetry for all services exporting to Application Insights and required the Aspire Dashboard UI for observability.
- v1.2: Changed Infrastructure as Code approach from Bicep to Azure CLI. Azure CLI scripts provide scriptable, imperative infrastructure management suitable for both automation and manual deployment workflows. Works seamlessly with azd and GitHub Actions.
- v1.1: Added local deployment optionality. Application can run entirely locally with local database or deploy to Azure. Azure services optional deployment targets. Local-first development supported with SQLite or SQL Server LocalDB.
- v1.0: Documented adoption of F# for domain layer (events, entities, value objects, services, command handlers) via BikeTracking.Domain.FSharp project. C# remains for API layer, infrastructure, and frontend. Clarified hybrid C#/F# architecture with FSharpValueConverters for EF Core integration.
-->

## Mission

**Problem**: Commuters lack a simple, integrated way to track bike rides and visualize savings vs. driving.

**Solution**: Enable users to quickly record rides with automatic weather capture, track distance/time/expenses, and visualize cumulative savings through intuitive charts and historical analysis. **Deployment Flexibility**: Local-only deployment is the primary target; Azure cloud deployment is planned as a future phase when multi-user or team access is needed.

**Decision Record**: This constitution encodes decisions made on 2025-12-11 (and amended 2026-03-04) to avoid re-litigating:
- Why F# for domain? Discriminated unions enforce valid states; pure functions are deterministic and testable
- Why Event Sourcing? Provides complete audit trail, enables temporal queries for savings analysis, supports future replays
- Why Aspire? Local-first development orchestration; Aspire simplifies the full local stack now, with optional Azure cloud deployment planned for a future phase
- Why React? Mature, widely adopted TypeScript frontend ecosystem with composable UI patterns, strong tooling, and flexible static hosting for local-first development
- Why Minimal API? Lightweight, performant, integrates seamlessly with Aspire and domain layers
- Why local-first architecture? Users own their data locally; cloud deployment optional for sharing/collaboration
- Why SQLite local-file default for user-machine installs? No separate database install, reliable offline operation, and simpler support/backup through a single user-owned database file
- Why Trunk-Based Development? Short-lived branches with continuous integration keep `main` always releasable, reduce merge pain, and enable continuous delivery; feature flags decouple deployment from release
- **Why DevContainer (mandatory)?** Eliminates "works on my machine" problems; ensures identical development environment across all contributors; pre-configures all tooling (C#, F#, Node.js, npm, CSharpier); supports seamless onboarding; enables reproducible builds and tests; backend and frontend dependencies coexist without system-level pollution. **All development MUST occur inside the DevContainer**; no exceptions during active development.

For detailed amendment history, see [DECISIONS.md](./DECISIONS.md).

## Core Principles

### I. Clean Architecture & Domain-Driven Design

Domain logic isolated from infrastructure concerns via layered architecture aligned with Biker Commuter aggregates: Rides, Expenses, Savings Calculations. Infrastructure dependencies (database, HTTP clients, external APIs) must be injectable and independently testable. Use domain models to express business rules explicitly; repositories and services should abstract data access. Repository pattern separates domain models from persistence details.

**Rationale**: Testability without mocking infrastructure; business logic remains framework-agnostic and reusable; easier to reason about domain behavior independent of deployment environment.

### II. Functional Programming (Pure & Impure Sandwich)

Core calculations and business logic implemented as pure functions: distance-to-distance conversions, expense-to-savings transformations, weather-to-recommendation mappings. Pure functions have no side effects—given the same input, always return the same output. Use immutable data structures. Impure edges (database reads/writes, external API calls, user input, system time) explicitly isolated at application boundaries. Handlers orchestrate pure logic within impure I/O boundaries. **F# discriminated unions and active patterns preferred for domain modeling** (domain layer uses F#); Railway Oriented Programming (Result<'T> type) for error handling; C# records used in API surface for interop. **C# expected business/validation/conflict flows MUST use explicit Result-style return values and MUST NOT use exceptions for routine control flow. Exceptions are reserved for unexpected/exceptional failures only.**

**Rationale**: Pure functions are trivially testable, deterministic, and composable. Side effect isolation makes dataflow explicit and reduces debugging complexity. Immutable data structures preferred where practical. F# enforces immutability and pattern matching, reducing entire categories of bugs. Discriminated unions make invalid states unrepresentable.

### III. Event Sourcing & CQRS

Every domain action (ride recorded, expense added, savings recalculated) generates an immutable, append-only event stored in the event store. Commands transform to events; events drive projections (read models). Current state always derived from event history. Write and read models separated: writes append events; reads query projections (materialized views). Change Event Streaming (CES) triggers background functions to build read-only projections asynchronously.

**Rationale**: Complete audit trail guaranteed; temporal queries enabled; event replays support debugging and future features; projections scale independently of event volume; data consistency enforced via event contracts.

### IV. Quality-First Development (Test-Driven)

Red-Green-Refactor cycle is **non-negotiable** and follows a strict, gate-controlled sequence:

1. **Plan**: Every specification and planning phase **must** include a test plan that explicitly identifies failing tests to be written — what will fail, why, and what it proves.
2. **Write Failing Tests**: Before any implementation code is written, the agent writes the tests that define the expected behavior. Tests are committed in failing state.
3. **Run & Prove Failure**: The failing tests are executed and their output is shown to the user. The user **must review and confirm** that tests fail for the right reasons (not infrastructure or compilation errors — genuine behavioral failures).
4. **Implement**: Only after user confirmation of red tests does implementation begin. Implementation must target making the failing tests pass — no speculative or extra logic.
5. **Run After Each Change**: Tests are run after each meaningful implementation change to track incremental progress toward green.
6. **All Tests Pass**: Implementation is complete only when all tests pass. No merge occurs until the full test suite is green.
7. **Consider Refactoring**: Once tests are green, evaluate the implementation for clarity, duplication, and simplicity. Refactor while keeping tests green. Refactoring is optional but explicitly encouraged at this stage.
8. **Commit At Each TDD Gate**: Commits are mandatory at each TDD gate transition with clear gate intent in the message. Required checkpoints: (a) red baseline committed after failing tests are written and user confirms failures, (b) green implementation committed when approved tests pass, (c) refactor committed separately when refactoring is performed.

TDD commit messages must include gate and spec/task context (for example: "TDD-RED: spec-006 ride history edit conflict tests" or "TDD-GREEN: spec-006 make edit totals refresh pass").

Unit tests validate pure logic (target 85%+ coverage). Integration tests verify each vertical slice end-to-end. Contract tests ensure event schemas remain backwards compatible. Security tests validate OAuth isolation and data access. **Agent must suggest tests with rationale; user approval required before implementation. User must confirm test failures before implementation begins.**

**Rationale**: Tests act as executable specifications; catches bugs early; refactoring confidence; documents intended behavior; prevents regressions. Requiring user review of red tests proves that tests are meaningful and not vacuously passing.

### V. User Experience Consistency & Accessibility

All frontend UI built with React (latest stable) and TypeScript using design tokens derived from brand palette (FFCDA4, FFB170, FF7400, D96200, A74C00). Centralized theme tokens and reusable React components enforce visual consistency. WCAG 2.1 AA compliance mandatory (semantic HTML, color contrast, keyboard navigation, screen reader support). Mobile-first responsive design (breakpoints: mobile ≤600px, tablet 601-1024px, desktop >1024px). OAuth identity integration ensures users access only their own data; public data (leaderboards, shared rides) clearly marked. Simple, intuitive UX; avoid feature creep. **React implementation details must always be validated against official docs: https://react.dev/**

**Rationale**: Brand consistency builds trust; accessibility ensures inclusive product; responsive design reaches all devices; identity isolation ensures privacy compliance; simplicity reduces cognitive load and maintenance burden.

### VI. Performance, Scalability & Observability

API response times must remain **<500ms at p95** under normal load; database indexes optimized for event queries. Static assets served via CDN (cloud) or local cache (local deployment). Background projection updates via Azure Functions (cloud) or in-process handlers (local) build read projections asynchronously; acceptable lag is eventual consistency within 5 seconds. Structured logs (JSON), metrics, and traces must use Aspire built-in OpenTelemetry for all services; any export to Application Insights must use Aspire OpenTelemetry exporters. Local deployments export to console/file sinks; cloud deployments export to Application Insights. Aspire Dashboard UI is required for local diagnostics only; cloud deployments use Application Insights exclusively for observability — do not deploy the Aspire Dashboard to cloud environments. Metrics tracked: API latency, event processing lag, error rates, user engagement. Aspire orchestration enables local debugging and local-only deployment; Azure Container Apps provides optional cloud scalability via Managed Identity and VNet integration.

**Rationale**: Sub-500ms response ensures fluid UX regardless of deployment; scalable projections decouple write and read performance; structured observability enables rapid incident response; local deployment trades cloud elasticity for data ownership; cloud deployment provides autoscaling for demand spikes.

### VII. Data Validation & Integrity

All user input **MUST** be validated in three layers: (1) **Client-side (React)** using React form handling patterns and standard browser constraints for immediate feedback and UX responsiveness; (2) **Server-side (Minimal API)** using DataAnnotationsAttributes with attribute-based validation on command/event DTOs; (3) **Database layer** via constraints (NOT NULL, UNIQUE, FOREIGN KEY, CHECK). Validation rules enforced consistently across frontend and backend—if a field is required in a React form, the API endpoint MUST also enforce that constraint via data annotations. No data enters the system without validation. Referenced documentation: https://react.dev/

**Rationale**: Defense-in-depth prevents invalid data from corrupting event store or projections; client-side validation improves UX responsiveness; server-side validation prevents bypass attacks; database constraints provide last-line guarantees. Combined approach ensures data integrity without redundant checks.

### VIII. Experimentation, Learning & Secure Validation

Engineering work should prioritize experimentation in small, reversible batches to discover what software creates the best user value while keeping complexity manageable. Continuous learning is expected in every slice: document what was learned, what complexity was reduced, and what the next increment should test.

Every change **MUST** be validated end-to-end before merge and before phase transitions: solution compiles, coding standards pass, automated tests confirm behavior, and deployment pipeline checks succeed. Security is a first-class requirement on every change: identify issues, explain risks and mitigations to contributors, and remediate vulnerabilities before release.

**Rationale**: Small batches reduce blast radius and improve feedback speed. Continuous learning drives better product decisions under uncertainty. Mandatory validation and security remediation protect reliability, delivery confidence, and user trust.

### IX. Modularity, Interfaces & Contract-First Collaboration

System capabilities must be split into cohesive modules with explicit ownership and clear boundaries (for example: identity, rides, projections, analytics, frontend feature areas). Cross-module collaboration must occur through stable interfaces and versioned contracts (API schemas, event schemas, shared DTO contracts), not by direct internal coupling. Teams should define and agree contracts first, then implement modules independently in parallel; integration happens against contracts with compatibility tests before merge. Contract evolution must be backwards compatible by default and versioned when breaking changes are unavoidable.

**Rationale**: Strong module boundaries reduce coordination overhead, minimize merge conflicts, and allow teams to move in parallel without blocking each other. Contract-first integration preserves system cohesion as complexity grows and enables safer incremental delivery.

### X. Trunk-Based Development, Continuous Integration & Delivery

All development follows **Trunk-Based Development (TBD)** with short-lived feature branches. The `main` branch must always be in a **releasable state** — no broken builds, no failing tests, no incomplete features visible to users.

**Branching Strategy**:
- All work happens on short-lived feature branches created from `main`. No long-lived branches.
- Use **git worktrees** for parallel work streams; merge branches back to `main` as soon as possible (ideally within 1–2 days; never longer than a few days).
- Direct pushes to `main` are **prohibited**. All changes enter `main` via Pull Request (PR) only.
- Every PR must reference a **GitHub issue** that describes the work being done.
- PR validation builds are **mandatory**: all tests (unit, integration, E2E) and code quality checks (linting, formatting, build) must pass before a PR can be completed.
- **PR completion policy**: Only the repository owner may complete (merge) a PR. Squad team members may review, provide feedback, request changes, and approve — but they **cannot** complete the PR. This ensures the owner maintains final merge authority.

**Continuous Integration**:
- Every push to a feature branch triggers the full CI validation pipeline (build, test, lint, format).
- Branches must be up-to-date with `main` before merge (rebase or merge from `main` required).
- Merge conflicts must be resolved before PR completion; never merge broken code.

**Feature Flags**:
- Use feature flags to hide in-progress work that is merged to `main` but not yet ready for users. This decouples **deployment** (code in `main`) from **release** (feature visible to users).
- Feature flags must be implemented at the minimum viable scope — wrap only the entry points to new features, not deep internal logic.
- **Maximum 5 active feature flags** at any time to limit complexity and cognitive overhead. If the limit is reached, existing flags must be cleaned up before new ones are introduced.
- After a feature behind a flag is deemed production-ready and the flag is permanently enabled, the flag, its conditional branches, the old code path, and any flag-specific tests must be **removed** in a dedicated cleanup PR. Feature flag debt is not tolerated.
- Feature flag state is managed via configuration (appsettings, environment variables); never hard-coded in source.

**Continuous Delivery**:
- `main` is always deployable. Any commit on `main` can be released to production at any time.
- Deployment and release are separate concerns: code reaches `main` via PR; features reach users via feature flag enablement or configuration change.

**Rationale**: Trunk-Based Development minimizes integration risk by keeping branches short-lived and merging frequently. Feature flags enable continuous delivery without exposing incomplete work. PR-gated merges with mandatory validation builds ensure `main` never breaks. Owner-only PR completion provides a final quality gate. Git worktrees enable efficient parallel work without branch-switching overhead.

## Technology Stack Requirements

### Development Environment (Mandatory)

**All development MUST occur inside the DevContainer.** This is non-negotiable and applies to all contributors, both local and remote.

- **DevContainer Image**: Built from `.devcontainer/Dockerfile` (base `mcr.microsoft.com/devcontainers/dotnet:1-10.0-noble`) with Node.js 24+ and GitHub CLI features
- **Pre-configured Tools**: .NET 10 SDK, F# compiler, Node.js 24+, npm, CSharpier (code formatter), VS Code extensions (C#, F#, ESLint, Prettier, Docker)
- **Post-Create Setup**: Runs `dotnet restore BikeTracking.slnx && npm ci --prefix src/BikeTracking.Frontend && dotnet build BikeTracking.slnx`; SDK and global CLI tooling are baked into the image build
- **Benefits**: 
  - Eliminates "works on my machine" problems across all contributors
  - Ensures consistent environment (C#, F#, Node.js versions)
  - Frontend and backend tools coexist without system-level pollution
  - Seamless onboarding for new contributors
  - Reproducible builds and test results
  - Simplifies CI/CD environment parity (local DevContainer mirrors GitHub Actions runner)
- **Development Workflow**: 
  - Open workspace in VS Code
  - Press `Ctrl+Shift+P` → "Dev Containers: Open Folder in Container"
  - VS Code connects to running container (takes ~2-3 min on first run)
  - All terminals run inside container; `dotnet run`, `npm install`, `git`, etc. execute in containerized environment
  - All source code accessible via volume mount; changes reflect immediately
- **No Exceptions**: Local development on host machine (without DevContainer) is prohibited during active development phases. The DevContainer is the sole authorized development environment.

### Backend & Orchestration
- **Framework**: .NET 10 Minimal API (latest stable)
- **Orchestration**: Microsoft Aspire (latest stable) for local and cloud development
- **Language (API Layer)**: C# (latest language features: records, pattern matching, async/await, follow .editorconfig for code formatting)
- **Language (API Layer)**: C# (latest language features: records, pattern matching, async/await, follow .editorconfig for code formatting); expected-flow outcomes MUST be represented with explicit Result objects rather than exception-driven control flow
- **Language (Domain Layer)**: F# (latest stable) for domain entities, events, value objects, services, and command handlers. Discriminated unions, active patterns, and Railway Oriented Programming pattern used for domain modeling and error handling.
- **NuGet Discipline**: All packages must be checked monthly for updates; security patches applied immediately; major versions reviewed for breaking changes before upgrade
- **Domain-Infrastructure Interop**: EF Core value converters (FSharpValueConverters) enable transparent mapping of F# discriminated unions to database columns

### Frontend
- **Framework**: React (latest stable) with TypeScript + Vite
- **UI Approach**: React components with centralized CSS design tokens (brand palette enforced); avoid framework lock-in to server-rendered component libraries
- **Hosting Model**: Static site hosting for compiled React app; serves frontend as static assets (HTML, CSS, JavaScript) from CDN or blob storage
- **Authentication**: OAuth (via MSAL.js)
- **API Communication**: Fetch API or HttpClient-style wrapper with OAuth bearer token to containerized backend API
- **Design System**: Centralized theme tokens and shared React component patterns; theme colors locked to brand palette
- **Validation**: React client-side validation patterns mirrored with server-side DataAnnotations and database constraints
- **Documentation Rule**: Always reference official React documentation when implementing or reviewing frontend code: https://react.dev/

### Data & Persistence
- **Primary Database**: 
  - **Local Deployment**: SQLite local file database (default for single-user and user-machine installs); SQL Server LocalDB/Express optional for advanced multi-user local scenarios
  - **Cloud Deployment**: Azure SQL Database (serverless elastic pools in production)
  - **Database abstraction**: EF Core provider configured via connection string; application code database-agnostic
- **ORM & Data Access**: Entity Framework Core (latest .NET 10 compatible version) for all database interactions; DbContext per aggregate root; repositories abstract EF Core from domain layer. EF Core value converters integrated for F# type marshaling.
- **Schema Management**: EF Core migrations for code-first schema evolution (same migrations work across SQLite, SQL Server, Azure SQL)
- **Event Store**: Dedicated event table (Events with columns: EventId, AggregateId, EventType, Data JSON, Timestamp, Version); events stored as JSON via EF Core value converters
- **Read Projections**: Separate read-only tables (e.g., RideProjection, SavingsProjection) built by background functions or in-process handlers; queried via dedicated read-only DbContext
- **Change Event Streaming**: 
  - **Local Deployment**: In-process event handlers or polling-based projection updates
  - **Cloud Deployment**: Azure SQL Change Tracking/Change Data Capture triggering Azure Functions
- **User-Machine Install Profile (Local)**:
  - Default to SQLite file storage with no separate database server dependency
  - Store database file in a user-writable application-data path (not the application install directory)
  - Apply startup migrations automatically and create a pre-migration database backup during upgrades

### Infrastructure & DevOps
- **Hosting**: 
  - **Local Deployment**: Single `dotnet run` orchestrates entire stack via Aspire: (1) React frontend container serving compiled static assets, (2) .NET Minimal API container, (3) SQLite/LocalDB database container. All services discoverable via Aspire AppHost; frontend connects to API via `localhost:API_PORT`
  - **Cloud Deployment**: React app compiled to static assets, hosted in Azure Static Web Apps or Blob Storage + CDN. Containerized API runs in Azure Container Apps
- **Identity**: 
  - **Local Deployment**: User Secrets for local development; environment variables for configuration
  - **Cloud Deployment**: Azure Managed Identity for service-to-service authentication; no connection strings in code
- **Secrets Management**: 
  - **Local Deployment**: .NET User Secrets (development) or local environment variables (production-local)
  - **Cloud Deployment**: Azure Key Vault for database credentials, API keys, OAuth secrets
- **Logging & Monitoring**: 
  - **Local Deployment**: Aspire OpenTelemetry (logs, metrics, traces) with console/file exporters for backend API; browser console for frontend; Aspire Dashboard UI enabled
  - **Cloud Deployment**: Aspire OpenTelemetry exporters to Application Insights for backend API; frontend telemetry optional (browser-side logging to Application Insights via SDK); centralized logs, metrics, traces in Application Insights
- **CI/CD**: 
  - **Local Deployment**: Manual `dotnet run` (Aspire containers) or local Docker Compose
  - **Cloud Deployment**: GitHub Actions with Aspire and azd (Azure Developer CLI) for orchestrated deployment
- **Deployment Artifacts**: 
  - **Local Deployment**: Aspire AppHost (`Program.cs`) defines all services (frontend, API, database); `dotnet run` builds and runs containers locally. Frontend built as part of Aspire orchestration, served by embedded HTTP container
  - **Cloud Deployment**: React static assets (HTML, CSS, JS bundles) deployed to Azure Static Web Apps or Blob Storage; API containerized in Azure Container Apps via Azure CLI scripts

### Package Management & Updates
- Check latest NuGet versions monthly; update patches for security; propose major/minor upgrades with test coverage
- Pin versions explicitly in .csproj or Directory.Packages.props
- Use mcp_nuget_get-latest-package-version to verify package status before implementation

## Development Workflow

### Specification & Vertical Slices
Each specification defines a **complete, deployable vertical slice**:
- **Frontend**: React page/component + reusable components with centralized theme token styling
- **API**: One or more Minimal API endpoints handling commands/queries
- **Database**: Event table, read projection table, SQL migrations via .sqlproj
- **Integration**: Background function or event handler to materialize projections (if applicable)
- **Deployment**: Tested locally via single `dotnet run` (Aspire orchestrates frontend, API, database), deployable to Azure Static Web Apps (frontend) + Azure Container Apps (API)

Example: "User records a bike ride" slice includes:
- React form component (e.g., ride-recorder.tsx, styled with centralized theme tokens, with React validation patterns) compiled and served by Aspire
- POST /rides API endpoint (command handler with DataAnnotationsAttributes on DTO) in containerized backend
- Events table with RideRecorded event; Projections table (RideProjection)
- Background function listening to CES to update RideProjection
- Aspire AppHost configuration for frontend + API + database orchestration; Azure CLI deployment scripts for Static Web Apps (frontend) and Container Apps (API)

Run `csharpier format .` to enforce code formatting (`dotnet tool install csharpier -g` is required). Run `dotnet format .` for additional .editorconfig-driven diagnostics.

Best Practice: Use CSharpier for consistent formatting and dotnet format for linting/code-style enforcement (for example, dotnet_diagnostic.IDE0130.severity=error).

Run TypeScript linting and formatting via `npm run lint` and `npm run format` in the frontend directory.

Use `dotnet run --project src/BikeTracking.AppHost` to start the local stack; use GitHub Actions for CI/CD to Azure.

### Contract-First Parallel Delivery

For features spanning multiple modules, delivery must be organized for parallel execution:

1. Define integration seams up front (command/query APIs, event contracts, shared value contracts) and record contract owners.
2. Freeze a first-pass contract for the slice before implementation starts; changes after freeze require explicit review from impacted owners.
3. Implement producers and consumers in parallel against contract tests/stubs, not each other's internal code.
4. Run contract compatibility tests in CI for both directions (provider and consumer) before integration merge.

This contract-first workflow complements vertical slices and the TDD gates; it does not replace them.

### Branching Strategy & Continuous Integration

All development follows Trunk-Based Development with git worktrees for parallel work:

**Branch Lifecycle**:
1. Create a GitHub issue describing the work
2. Create a short-lived feature branch from `main` (e.g., `feature/issue-42-record-ride`)
3. Use `git worktree add` to work on the branch in a separate directory when parallel work is needed
4. Commit frequently with meaningful messages; push to remote regularly
5. Open a PR referencing the GitHub issue (e.g., "Closes #42") as soon as the first commit is ready (draft PR for work-in-progress)
6. Keep the branch up-to-date with `main` via rebase
7. Once CI passes and review feedback is addressed, the owner completes the PR
8. Remove the worktree and delete the merged branch: `git worktree remove <path> && git branch -d <branch>`

**CI Validation Pipeline** (runs on every PR and push to feature branches):
```
dotnet build BikeTracking.slnx
csharpier format . --check
dotnet test BikeTracking.slnx
cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit
```
All checks must pass before a PR can be completed. E2E tests run on PRs targeting `main`.

**Git Worktree Conventions**:
- Worktree directories placed in `../<repo>-worktrees/<branch-name>` (outside the main repo directory)
- Each worktree shares the same `.git` object store — no duplicate clones
- Clean up worktrees immediately after the branch is merged
- Never leave orphaned worktrees; run `git worktree list` periodically to audit

**PR Requirements**:
- Must reference a GitHub issue (linked via "Closes #N" or "Relates to #N")
- Must have a passing validation build (CI green)
- Must have at least one reviewer's feedback acknowledged
- Only the repository owner can complete (merge) the PR
- Squad members review, approve, or request changes — they cannot merge
- Use squash merge to keep `main` history clean

### Feature Flag Management

Feature flags decouple deployment from release, allowing incomplete work to be merged to `main` safely:

**Implementation**:
- Feature flags are boolean configuration values read from `appsettings.json` or environment variables
- Backend: Use an `IFeatureFlagService` (or equivalent) injected via DI to check flag state
- Frontend: Feature flags passed via API configuration endpoint or environment build variables
- Wrap only the **entry point** to a new feature (route registration, menu item, endpoint mapping) — do not scatter flag checks deep in business logic

**Lifecycle**:
1. **Create**: Add flag with `false` default in configuration; document the flag in a `FEATURE_FLAGS.md` file with owner, issue reference, and expected removal date
2. **Develop**: All code behind the flag merged to `main` continuously; flag remains `false` in production config
3. **Test**: Enable flag in test/staging environments; run E2E tests with flag on and off
4. **Release**: Set flag to `true` in production configuration to enable for users
5. **Cleanup**: Once the feature is stable in production, create a dedicated cleanup PR that removes the flag, the conditional branches, the old code path, and any flag-specific tests. Update `FEATURE_FLAGS.md`

**Hard Limits**:
- **Maximum 5 active feature flags** at any time across the entire codebase
- Before adding a new flag when at the limit, an existing flag must be cleaned up first
- Feature flags older than 30 days without a cleanup plan must be escalated for review
- `FEATURE_FLAGS.md` is the single source of truth for all active flags

### Post-Change Verification Matrix (Mandatory After Any Change)

After **every** code change, run verification commands based on the changed scope. These checks are required before merge and before phase transitions.

1. **Frontend-only changes** (React/TypeScript/CSS, frontend config):
  - `cd src/BikeTracking.Frontend`
  - `npm run lint`
  - `npm run build`
  - `npm run test:unit`
2. **Backend/domain-only changes** (API, F#, persistence, .NET configuration):
  - `dotnet test`
3. **Authentication/login/cross-layer changes** (routes, auth context, identify endpoint/service, contracts, frontend+backend touches):
  - Run **all impacted-layer commands** above
  - Additionally run `cd src/BikeTracking.Frontend && npm run test:e2e`

Evidence from these command runs (terminal output or CI artifacts) must be attached to the work item or PR notes.


### Vertical Slice Implementation Strategy: Minimal-First Approach

After the application structure is built, implementation proceeds in **vertical slices with minimal functionality first**:

1. **Identify Minimal Viable Feature**: Extract the smallest, testable piece of the specification that delivers user value (e.g., "User records a basic ride with just distance and date" vs. "User records ride with weather, auto-capture, and expense associations").
2. **Implement Minimal Functionality**: Build only what's needed for this slice to work end-to-end:
  - React form with essential fields only
   - API endpoint handling the core command
   - Event and projection for persistence
   - Database schema (migrations)
   - No bells, whistles, or optional features
3. **Test & Verify**: Run full test suite (unit, integration, E2E); deploy locally via `dotnet run` and manually verify the slice works as specified.  Each slice must be fully tested (unit, integration, E2E) and user-approved before proceeding to the next slice.
4. **User Decision Point**: Once minimal slice is verified and working, present the user with options:
   - **Approve Minimal & Iterate**: User approves the working slice, then we build next priority feature (additional fields, refinements, enhancement)
   - **Expand Current Slice**: User requests additional functionality for the current slice before finalizing (e.g., "add weather capture" to the ride recording feature)
   - **Pivot**: User validates that the minimal approach solves the problem; if solution is sufficient, ship as-is; otherwise, refine or fold into next slice
5. **Repeat**: Each new feature/slice follows the same pattern: minimal implementation → test → user approval → expand or next slice

**Rationale**: Minimal-first approach de-risks development by getting working code to user quickly; validates assumptions early; prevents over-engineering; enables user feedback to guide remaining work; reduces scope creep. Vertical slices remain deployable and testable at each iteration boundary. The Pragmatic Programmer calls this "Tracer Bullets" — get something working end-to-end before perfecting it.

### Definition of Done: Vertical Slice Completeness

A vertical slice is **production-ready** only when all items are verified:

- [ ] Specification written, approved by user, linked to spec directory
- [ ] Test plan approved (unit, integration, E2E, security, performance tests identified; each test's expected failure reason documented)
- [ ] All tests written and failing (red phase complete); failing test output shown to user
- [ ] **User confirmed test failures**: user reviewed failing test output and approved that failures are behavioral, not structural
- [ ] Implementation complete; all tests run after each meaningful change; all tests passing (green phase complete)
- [ ] Refactoring considered: implementation evaluated for clarity/duplication/simplicity with tests green; any refactoring applied with tests still passing
- [ ] Code review: architecture compliance verified, naming conventions followed, validation discipline observed
- [ ] Change validation complete: compile succeeds, coding standards checks pass, automated behavior tests pass
- [ ] Post-change verification matrix executed for the impacted scope and evidence recorded
- [ ] Feature branch deployed locally via `dotnet run` (entire Aspire stack: frontend, API, database)
- [ ] Integration tests pass; manual E2E test via Playwright (if critical user journey)
- [ ] Every migration introduced by the slice includes a new or updated automated test and an updated migration coverage policy mapping entry
- [ ] All validation layers implemented: client-side (React validation), API (DTO DataAnnotations), database (constraints)
- [ ] Events stored in event table with correct schema; projections materialized and queryable
- [ ] Module boundaries preserved; cross-module interactions occur only via approved interfaces/contracts with compatibility evidence
- [ ] SAMPLE_/DEMO_ data cleaned up; no test data committed to main branch
- [ ] PR created from feature branch referencing GitHub issue; CI validation build passes
- [ ] PR completed (merged) by repository owner only, after review feedback addressed
- [ ] Feature flags used for any in-progress work visible in `main`; flag count ≤5
- [ ] Feature flag cleanup PR created after feature is production-ready (removes flag, old code, flag-specific tests)
- [ ] Deployed to Azure staging environment via GitHub Actions + azd
- [ ] Pipeline deployment checks pass for the target environment
- [ ] Security review completed; identified vulnerabilities are explained and fixed (or formally approved risk acceptance)
- [ ] User acceptance testing completed; feature approved for production
- [ ] Commit made to main branch with spec reference in commit message

### Data Governance

#### Data Naming Conventions

All data created during development **MUST** follow strict naming conventions to ensure test data is never deployed to production:

- **SAMPLE_**: Prefix all representative, realistic sample data (e.g., SAMPLE_Ride_CoastalCommute, SAMPLE_User_AlexJones). Sample data demonstrates expected data shapes and is used for documentation and demos.
- **DEMO_**: Prefix all dummy, placeholder, or throwaway test data (e.g., DEMO_Ride_12345, DEMO_ExpenseTemp). Demo data is strictly for local development and testing; never deployed to production.
- **Production data**: Real user data without prefixes. No prefixes used for live, user-entered data.

**Agent must ask user approval before creating ANY data** (sample, demo, or production fixtures). User specifies: is this sample data for docs? Demo for testing? A fixture for a test scenario? Agent confirms naming prefix and purpose before generation.

**Rationale**: Clear naming prevents accidental production deployments of test data; naming convention facilitates automated cleanup of test data; explicit approval ensures data creation aligns with specification intent.

#### Data Retention & Cleanup

- **Sample/demo data**: Purged weekly before production deployments; no test data in main branch
- **Event log retention**: Retained indefinitely for audit trail; archived after 3 years per compliance
- **GDPR compliance**: User data deletion triggered via Delete User endpoint; all events and projections for that user removed
- **Test database cleanup**: Automated cleanup after integration test runs; no orphaned data in dev environments

#### Test Data Management

- Fixtures stored in `/bikeTracking.Tests/Fixtures/` directory (organized by aggregate: Rides, Expenses, Users)
- Seeding strategy for integration tests documented in test project README
- F# discriminated union test data generated via factory functions (e.g., `RideFactory.createSample()`)
- Cleanup happens via test teardown; all DEMO_ data removed after test execution

### Testing Strategy (User Approval Required)

Tests suggested by agent must receive explicit user approval before implementation. Test categories by slice:

**Unit Tests** (pure logic, 85%+ target coverage)
- F# discriminated unions and active pattern behavior
- Railway Oriented Programming composition (Result<'T> chaining)
- Event serialization/deserialization (F# to JSON and back)
- Validation rules (including DataAnnotationsAttributes behavior)
- Pure function calculations (F# functions and C# helpers)

**Integration Tests** (end-to-end slice verification)
- OAuth token validation → data isolation enforced
- Database migrations run successfully
- Entity Framework DbContext configuration validated, including FSharpValueConverters
- F# domain types successfully marshaled through EF Core value converters
- Validation attributes enforced on API endpoints
- F# command handlers compose with C# infrastructure (repositories, services)
- Cross-module API/event contracts validated for provider-consumer compatibility

**Contract Tests** (event schema stability)
- Event schema versioning
- Backwards compatibility of event handlers
- Projection schema changes

**Security Tests**
- OAuth token required for all user endpoints
- User can only access their own data
- Anonymous access to public data (if applicable)
- Data validation prevents injection attacks

**Database Tests**
- Migration up/down transitions
- Migration coverage policy test must map every discovered migration to a new or updated automated test action
- Event table constraints (unique EventId, non-null fields)
- Foreign key integrity for aggregates
- DataAnnotations constraints validated at database layer

**E2E Tests** (critical user journeys using Playwright MCP)
- Complete user workflows from frontend form submission to event storage to projection materialization
- Form validation feedback displayed correctly
- Data persisted and visible in read projections
- Responsive design verified across breakpoints

**Performance Tests** (under acceptance criteria)
- Projection lag <5 seconds after event insertion
- API endpoints meet <500ms p95 response time SLO under load

### Development Approval Gates

1. **Specification Approved**: Spec document completed and user-approved before coding
2. **Test Plan Approved**: Agent proposes all tests (unit, integration, E2E, security) with rationale for each; test plan explicitly identifies what each test proves and why it will initially fail; user approves the test plan before any code is written
3. **Contract Boundaries Frozen**: Module interfaces and integration contracts are agreed, versioned, and owner-approved before implementation begins; this enables parallel execution without internal coupling
4. **Failing Tests Written**: Agent writes the tests exactly as approved; no implementation code written yet
5. **Tests Run & Failures Confirmed by User**: Agent runs the tests and displays the full failure output; **user reviews and explicitly confirms** that tests fail for the right behavioral reasons (not build errors); this gate cannot be bypassed — user approval required before proceeding
6. **Implementation (Green)**: Code written incrementally to make failing tests pass; tests run after each meaningful change to track progress; no speculative or extra logic added beyond what tests require
7. **All Tests Pass**: Implementation is complete only when the full test suite is green; agent displays passing test output
8. **Refactor (Consider)**: With tests green, evaluate the implementation for clarity, duplication, and simplicity; refactor if warranted while keeping tests green; explicitly present refactoring opportunities to user even if skipped
9. **Code Review**: Implementation reviewed for architecture compliance, naming, performance, validation discipline
10. **Validation Gate**: Compile/build passes, coding standards checks pass, and automated tests validate behavior
11. **Security Gate**: Security issues are identified, explained to contributors, and remediated or explicitly accepted by user
12. **Local Deployment**: Slice deployed locally in containers via Aspire, tested manually with Playwright if E2E slice
13. **Azure Deployment**: Slice deployed to Azure Container Apps via GitHub Actions + azd
14. **User Acceptance**: User validates slice meets specification and data validation rules observed
15. **Phase Completion Commit**: Before starting the next phase, create a dedicated phase-completion commit that includes completed tasks and verification evidence for that phase
16. **Spec Completion Gate**: Before marking any specification as done, database migrations for that spec must be applied successfully to the target local runtime database and the spec's end-to-end (Playwright) tests must run green
17. **Migration Test Coverage Gate**: Every migration added or modified in a branch must include a new or updated automated test and must be represented in the migration coverage policy test map before merge

### Compliance Audit Checklist

#### Per-Specification Audit
- [ ] Spec references all ten core principles in acceptance criteria
- [ ] Event schema defined; backwards compatibility verified if updating existing events
- [ ] Data validation implemented at three layers: client (React), API (Minimal API), database (constraints)
- [ ] Test coverage for domain logic ≥85%; F# discriminated unions and ROP patterns tested
- [ ] Every change validated: compile/build, coding standards, automated tests, and pipeline deployment checks
- [ ] Post-change verification matrix executed for the changed scope (frontend, backend/domain, or auth/cross-layer) with evidence captured
- [ ] Module boundaries documented; cross-module integrations use approved interfaces/contracts only
- [ ] Contract compatibility tests executed for changed APIs/events (provider and consumer)
- [ ] Security issues recognized, explained, and remediated (or explicitly accepted by user)
- [ ] TDD gate commits created: red baseline commit, green commit, and separate refactor commit when applicable
- [ ] Phase completion commit created before moving to the next phase
- [ ] Database migrations for the spec are created and applied successfully to the runtime database used for validation
- [ ] Every migration introduced or modified by the spec has a corresponding new or updated automated test and a migration-coverage policy entry
- [ ] Spec-level E2E (Playwright) suite executed and passing before spec marked complete
- [ ] All SAMPLE_/DEMO_ data removed from code before merge
- [ ] Secrets NOT committed; `.gitignore` verified; pre-commit hook prevents credential leakage
- [ ] Validation rule consistency: if field required in React form, enforced in API DTOs and database constraints
- [ ] OAuth isolation verified: user only accesses their data; public data clearly marked
- [ ] All changes entered `main` via PR referencing a GitHub issue; no direct pushes
- [ ] PR validation build passed (build, tests, lint, format) before merge
- [ ] PR completed by repository owner only
- [ ] Feature flags used for in-progress work; active flag count ≤5; `FEATURE_FLAGS.md` up-to-date
- [ ] Feature flag cleanup completed for any flags permanently enabled during this spec

#### Monthly Technology Audit
- [ ] NuGet packages checked via `mcp_nuget_get-latest-package-version` for security patches
- [ ] Security patches applied immediately; major/minor versions proposed with test coverage
- [ ] React and Vite packages pinned to approved versions; latest compatible patch evaluated monthly
- [ ] MSAL.js updated; OAuth integration verified
- [ ] Frontend implementation guidance verified against official React docs (https://react.dev/)
- [ ] F# compiler version matches latest stable; discriminated union syntax up-to-date
- [ ] EF Core value converters still compatible with F# domain types
- [ ] Aspire OpenTelemetry exporters updated; Application Insights integration verified
- [ ] Aspire Dashboard UI enabled for local development only; local telemetry visible in Aspire dashboard; cloud observability via Application Insights
- [ ] Azure Container Apps pricing and scaling policies reviewed
- [ ] Key Vault access policies audited; expired certificates identified

#### Quarterly Architecture Review
- [ ] Clean Architecture layers remain isolated (domain → infrastructure decoupling verified)
- [ ] Event sourcing invariants maintained: events append-only, no mutation
- [ ] CQRS separation enforced: write path (commands) and read path (projections) distinct
- [ ] Module boundaries remain cohesive and independently deployable/testable where applicable
- [ ] Interface and contract versioning strategy enforced across APIs/events
- [ ] Performance SLOs verified: API <500ms p95, projection lag <5s
- [ ] Observability dashboards in Application Insights show active monitoring

### Guardrails (Non-Negotiable)

Breaking these guarantees causes architectural decay and technical debt accrual:

- **TDD cycle is strictly gated and non-negotiable** — implementation code must never be written before failing tests exist, have been run, and the user has reviewed and confirmed the failures. The sequence is always: plan tests → write tests → run and prove failure → get user confirmation → implement → run after each change → verify all pass → consider refactoring. Skipping or reordering any step is prohibited.
- **Commit gates are mandatory for TDD and phase transitions** — every TDD gate transition requires a commit (red, green, and refactor when performed), and every completed phase requires a dedicated phase-completion commit before proceeding.
- **Spec completion requires migration + E2E gates** — a spec cannot be marked done until its database migrations are applied to the runtime database and its Playwright E2E scenarios pass.
- **Every migration requires a test update** — each migration must ship with a new or updated automated test and an updated migration coverage policy entry; changes are blocked when migration coverage is incomplete.
- **Expected-flow C# logic uses Result, not exceptions** — validation, not-found, conflict, and authorization business outcomes must be returned via typed Result objects (including error code/message metadata). Throwing exceptions for these expected outcomes is prohibited; exceptions are only for truly unexpected failures.
- **Cross-module work is contract-first and interface-bound** — teams must integrate through explicit interfaces and versioned contracts only; direct coupling to another module's internal implementation is prohibited.
- **No Entity Framework DbContext in domain layer** — domain must remain infrastructure-agnostic. If domain needs persistence logic, use repository pattern abstracting EF.
- **Secrets management by deployment context** — **Cloud**: all secrets in Azure Key Vault; **Local**: User Secrets or environment variables. No connection strings, API keys, or OAuth secrets in appsettings.json, code, or GitHub. Pre-commit hooks enforce this. **⚠️ This repository is public on GitHub**: any committed secret is immediately and permanently exposed to the internet; treat any accidental secret commit as an immediate security incident requiring credential rotation.
- **Event schema is append-only** — never mutate existing events. If schema changes needed, create new event type and version old events. Immutability is non-negotiable.
- **F# domain types must marshal through EF Core value converters** — no raw EF entities exposed to C# API layer. C# records serve as API DTOs; converters handle F#-to-C# translation.
- **Tests must pass before merge** — no exceptions, no "fix later" debt. CI/CD pipeline blocks merge if test suite fails.
- **Post-change verification matrix must run after any change** — no change is complete without executing required commands for impacted scope; auth/cross-layer changes also require `npm run test:e2e`.
- **Three-layer validation enforced** — if field validated in React form, also validated in API DTOs and database constraints. No single-layer validation.
- **OAuth token required on all user endpoints** — anonymous access forbidden for personal data. Public data endpoints explicitly marked; separate authorization logic. (Optional for single-user local deployment; mandatory for cloud/multi-user.)
- **SAMPLE_/DEMO_ data never in production** — automated linting prevents prefixed data from deploying. Merge blocked if test data detected.
- **Database provider abstraction** — application code must work across SQLite (local), SQL Server LocalDB (local), and Azure SQL (cloud) without provider-specific queries. Use EF Core abstractions; avoid raw SQL unless necessary and provider-agnostic.
- **User-machine local data safety** — local deployments on end-user machines default to SQLite local-file storage in a user-writable app-data path; do not require a separate DB server for single-user installs. Before schema migration, create a backup copy of the SQLite file.
- **No direct pushes to `main`** — all changes enter `main` via Pull Request only. Every PR must reference a GitHub issue, pass the full CI validation build (build, test, lint, format), and be completed (merged) exclusively by the repository owner. Squad team members may review, approve, and request changes but cannot complete a PR. Violations are treated as process failures requiring immediate revert.
- **Feature flags are mandatory for in-progress work on `main`** — any incomplete feature merged to `main` must be behind a feature flag set to `false` by default. Maximum 5 active feature flags at any time. After a feature is production-ready and the flag is permanently enabled, a dedicated cleanup PR must remove the flag, old code paths, and flag-specific tests. Feature flag debt is not tolerated.
- **Branches must be short-lived** — feature branches must be merged back to `main` as quickly as possible (target 1–2 days). Long-lived branches are prohibited; they create merge pain and integration risk. Use git worktrees for parallel work; clean up worktrees immediately after merge.

### Onboarding Checklist for New Contributors

1. **Read constitution** (~20 min): Understand mission, ten core principles, technology stack, development workflow
2. **Review decision history** (~15 min): [DECISIONS.md](./DECISIONS.md) explains why F#, why Event Sourcing, why Aspire, why Aurelia 2
3. **Clone repo and bootstrap** (~5 min): `git clone` → `dotnet tool install --global specify-cli` → `dotnet run` (Aspire orchestrates frontend, API, database)
4. **Explore specification examples** (~30 min): Review `/specs/` directory; read 2–3 completed specifications to understand vertical slice completeness
5. **Review test examples** (~20 min): Browse `/bikeTracking.Tests/Unit/` and `/bikeTracking.Tests/Integration/` to understand test patterns (F# unit tests, integration test fixtures, E2E Playwright)
6. **Pair with contributor on first spec** (~2–4 hours): Shadow an experienced team member through red-green-refactor cycle; understand test approval and code review gates
7. **Deploy locally** (~10 min): `dotnet run` and verify Aspire dashboard shows all containers (API, frontend, database, functions)
8. **Review [README.md](../../README.md)** (~10 min): Quick start, prerequisites, development setup, CI/CD pipeline

## Approved MCP Tools

### Documentation & Learning
- **mcp_microsoftdocs_microsoft_docs_search** – Search Microsoft Learn for .NET and Azure documentation
- **mcp_microsoftdocs_microsoft_code_sample_search** – Retrieve official C# and .NET code samples
- **mcp_microsoftdocs_microsoft_docs_fetch** – Fetch full documentation pages for detailed guidance (tutorials, prerequisites, troubleshooting)

### Azure Services & Infrastructure
- **mcp_microsoft_azu2_documentation** – Azure-specific guidance and best practices
- **mcp_microsoft_azu2_deploy** – Deployment planning, architecture diagram generation, IaC rules, app logs
- **mcp_microsoft_azu2_extension_cli_generate** – Generate Azure CLI commands for infrastructure setup
- **mcp_microsoft_azu2_azd** – Azure Developer CLI for Aspire orchestration and deployment
- **mcp_microsoft_azu2_appservice** – Manage Azure App Service resources (if used for preview deployments)
- **mcp_microsoft_azu2_sql** – Azure SQL operations: list databases, execute queries, manage servers
- **mcp_microsoft_azu2_storage** – Storage account management for CDN, static assets
- **mcp_microsoft_azu2_keyvault** – Azure Key Vault secrets and certificate management
- **mcp_microsoft_azu2_get_bestpractices** – Azure best practices for code generation, operations, and deployment

### Package & Dependency Management
- **mcp_nuget_get-latest-package-version** – Check for latest NuGet package versions
- **mcp_nuget_get-package-readme** – Retrieve package documentation and usage examples
- **mcp_nuget_update-package-to-version** – Update packages to specific versions with dependency resolution

### Testing & Quality Assurance
- **Playwright MCP** – End-to-end browser automation for critical user journeys; write and run Playwright test code for UI validation, form submission, and responsive design verification

### Source Control & Examples
- **github_repo** – Search GitHub repositories for code examples and patterns (e.g., Event Sourcing with .NET, React authentication)

## Governance

### Constitution as Governing Document
This constitution supersedes all other project guidance. All architectural decisions, code reviews, deployment approvals, and spec acceptance gates must verify compliance with these ten core principles and technology stack requirements.

### Amendment Procedure
Amendments must:
1. Document rationale for change
2. Propose new or modified principle(s) with concrete examples
3. Identify affected specifications and templates (plan, spec, tasks, commands)
4. Include migration plan for in-flight work
5. Receive user approval before ratification

Version bumping:
- **MAJOR**: Principle removal or redefinition (e.g., removing Event Sourcing, changing auth model)
- **MINOR**: New principle, new technology stack component, or major section expansion (e.g., adding data validation requirements, new MCP tool category)
- **PATCH**: Clarifications, wording refinements, typo fixes, example updates (no semantic change to governance)

### Compliance Review
- Weekly: Code reviews verify architecture compliance (Clean Architecture layers, pure/impure separation, event semantics, validation discipline)
- Per-spec: Testing strategy approved before implementation; vertical slice completeness validated; data naming conventions observed
- Monthly: Technology stack checked for security patches and major updates; NuGet packages reviewed; data validation audit (sample/demo data cleaned up before production deployments)

### Template Alignment
All SpecKit templates must reflect this constitution:
- **.specify/templates/plan-template.md**: Incorporate constitution principles into success criteria; include data naming conventions
- **.specify/templates/spec-template.md**: Mandate event sourcing schemas, testing categories, acceptance criteria, validation requirements
- **.specify/templates/tasks-template.md**: Align task types with principles (e.g., "Event Handler", "Projection", "Integration Test", "Security Audit", "Playwright E2E Test")
- **.specify/templates/commands/*.md**: Reference this constitution for guidance; agent-specific names (e.g., "Copilot") replaced with generic guidance

### Runtime Guidance
Development workflow guidance documented in [README.md](../../README.md) and .github/prompts/ directory. This constitution establishes governance; runtime prompts add context and tool references.

Always commit at each TDD gate and before continuing to a new phase.

### Related Documents
- **[DECISIONS.md](./DECISIONS.md)**: Amendment history, version changelog, rationale for major decisions
- **[README.md](../../README.md)**: Quick start, prerequisites, CI/CD pipeline setup
- **.specify/templates/**: Plan, spec, task, and command templates aligned with this constitution
- **.github/prompts/**: Runtime prompts for agent-developer interaction

---

**Version**: 1.13.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-04-03

