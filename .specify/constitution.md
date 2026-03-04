# Bike Tracking Application Constitution
<!-- Sync Impact Report v1.7
Rationale: Clarified that Blazor WASM frontend is fully orchestrated by Aspire locally; a single `dotnet run` command starts the entire application stack including API, database, and WASM frontend.
Modified Sections:
- Technology Stack Requirements > Infrastructure & DevOps: Local Hosting clarified to show Aspire orchestrates both frontend and API
- Development Workflow: Updated to emphasize all services orchestrated by Aspire locally
- Onboarding Checklist: Simplified to single `dotnet run` command; no separate frontend build step needed for local dev
Status: Approved for Aspire-orchestrated local development
Previous Updates:
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

**Solution**: Enable users to quickly record rides with automatic weather capture, track distance/time/expenses, and visualize cumulative savings through intuitive charts and historical analysis. **Deployment Flexibility**: Application runs entirely locally (personal use) or deploys to cloud (team/shared use) with identical feature set.

**Decision Record**: This constitution encodes decisions made on 2025-12-11 (and amended 2026-03-04) to avoid re-litigating:
- Why F# for domain? Discriminated unions enforce valid states; pure functions are deterministic and testable
- Why Event Sourcing? Provides complete audit trail, enables temporal queries for savings analysis, supports future replays
- Why Aspire? Local-to-cloud parity enables seamless team development; optional cloud deployment via Azure or local-only hosting
- Why Blazor + Fluent UI? Single C# codebase for frontend, responsive design, enforced accessibility standards, we may switch UI technology in the future (such as a full F# stack with Fable and Falco, maybe)
- Why Minimal API? Lightweight, performant, integrates seamlessly with Aspire and domain layers
- Why local-first architecture? Users own their data locally; cloud deployment optional for sharing/collaboration

For detailed amendment history, see [DECISIONS.md](./DECISIONS.md).

## Core Principles

### I. Clean Architecture & Domain-Driven Design

Domain logic isolated from infrastructure concerns via layered architecture aligned with Biker Commuter aggregates: Rides, Expenses, Savings Calculations. Infrastructure dependencies (database, HTTP clients, external APIs) must be injectable and independently testable. Use domain models to express business rules explicitly; repositories and services should abstract data access. Repository pattern separates domain models from persistence details.

**Rationale**: Testability without mocking infrastructure; business logic remains framework-agnostic and reusable; easier to reason about domain behavior independent of deployment environment.

### II. Functional Programming (Pure & Impure Sandwich)

Core calculations and business logic implemented as pure functions: distance-to-distance conversions, expense-to-savings transformations, weather-to-recommendation mappings. Pure functions have no side effects—given the same input, always return the same output. Impure edges (database reads/writes, external API calls, user input, system time) explicitly isolated at application boundaries. Handlers orchestrate pure logic within impure I/O boundaries. **F# discriminated unions and active patterns preferred for domain modeling** (domain layer uses F#); Railway Oriented Programming (Result<'T> type) for error handling; C# records used in API surface for interop.

**Rationale**: Pure functions are trivially testable, deterministic, and composable. Side effect isolation makes dataflow explicit and reduces debugging complexity. Immutable data structures preferred where practical. F# enforces immutability and pattern matching, reducing entire categories of bugs. Discriminated unions make invalid states unrepresentable.

### III. Event Sourcing & CQRS

Every domain action (ride recorded, expense added, savings recalculated) generates an immutable, append-only event stored in the event store. Commands transform to events; events drive projections (read models). Current state always derived from event history. Write and read models separated: writes append events; reads query projections (materialized views). Change Event Streaming (CES) triggers background functions to build read-only projections asynchronously.

**Rationale**: Complete audit trail guaranteed; temporal queries enabled; event replays support debugging and future features; projections scale independently of event volume; data consistency enforced via event contracts.

### IV. Quality-First Development (Test-Driven)

Red-Green-Refactor cycle is **non-negotiable**: tests written first, approved by user, then fail, then implementation follows. Unit tests validate pure logic (target 85%+ coverage). Integration tests verify each vertical slice end-to-end. Contract tests ensure event schemas remain backwards compatible. Security tests validate OAuth isolation and data access. **Agent must suggest tests with rationale; user approval required before implementation.**

**Rationale**: Tests act as executable specifications; catches bugs early; refactoring confidence; documents intended behavior; prevents regressions.

### V. User Experience Consistency & Accessibility

All frontend UI built with Fluent UI Blazor (v4.13.2) using design tokens derived from brand palette (FFCDA4, FFB170, FF7400, D96200, A74C00). Centralized DesignTheme component enforces visual consistency. WCAG 2.1 AA compliance mandatory (semantic HTML, color contrast, keyboard navigation, screen reader support). Mobile-first responsive design (breakpoints: mobile ≤600px, tablet 601-1024px, desktop >1024px). OAuth identity integration ensures users access only their own data; public data (leaderboards, shared rides) clearly marked. Simple, intuitive UX; avoid feature creep.

**Rationale**: Brand consistency builds trust; accessibility ensures inclusive product; responsive design reaches all devices; identity isolation ensures privacy compliance; simplicity reduces cognitive load and maintenance burden.

### VI. Performance, Scalability & Observability

API response times must remain **<500ms at p95** under normal load; database indexes optimized for event queries. Static assets served via CDN (cloud) or local cache (local deployment). Background projection updates via Azure Functions (cloud) or in-process handlers (local) build read projections asynchronously; acceptable lag is eventual consistency within 5 seconds. Structured logs (JSON), metrics, and traces must use Aspire built-in OpenTelemetry for all services; any export to Application Insights must use Aspire OpenTelemetry exporters. Local deployments export to console/file sinks; cloud deployments export to Application Insights. Aspire Dashboard UI is required for local and cloud diagnostics; cloud environments must deploy the dashboard UI alongside services. Metrics tracked: API latency, event processing lag, error rates, user engagement. Aspire orchestration enables local debugging and local-only deployment; Azure Container Apps provides optional cloud scalability via Managed Identity and VNet integration.

**Rationale**: Sub-500ms response ensures fluid UX regardless of deployment; scalable projections decouple write and read performance; structured observability enables rapid incident response; local deployment trades cloud elasticity for data ownership; cloud deployment provides autoscaling for demand spikes.

### VII. Data Validation & Integrity

All user input **MUST** be validated in three layers: (1) **Client-side (Blazor)** using Microsoft DataAnnotationsAttributes for immediate feedback and UX responsiveness; (2) **Server-side (Minimal API)** using DataAnnotationsAttributes with attribute-based validation on command/event DTOs; (3) **Database layer** via constraints (NOT NULL, UNIQUE, FOREIGN KEY, CHECK). Validation rules enforced consistently across frontend and backend—if a field is required in Blazor form, the API endpoint MUST also enforce that constraint via data annotations. No data enters the system without validation. Referenced documentation: https://learn.microsoft.com/en-us/aspnet/core/blazor/forms/validation

**Rationale**: Defense-in-depth prevents invalid data from corrupting event store or projections; client-side validation improves UX responsiveness; server-side validation prevents bypass attacks; database constraints provide last-line guarantees. Combined approach ensures data integrity without redundant checks.

## Technology Stack Requirements

### Backend & Orchestration
- **Framework**: .NET 10 Minimal API (latest stable)
- **Orchestration**: Microsoft Aspire (latest stable) for local and cloud development
- **Language (API Layer)**: C# (latest language features: records, pattern matching, async/await, follow .editorconfig for code formatting)
- **Language (Domain Layer)**: F# (latest stable) for domain entities, events, value objects, services, and command handlers. Discriminated unions, active patterns, and Railway Oriented Programming pattern used for domain modeling and error handling.
- **NuGet Discipline**: All packages must be checked monthly for updates; security patches applied immediately; major versions reviewed for breaking changes before upgrade
- **Domain-Infrastructure Interop**: EF Core value converters (FSharpValueConverters) enable transparent mapping of F# discriminated unions to database columns

### Frontend
- **Framework**: Microsoft Blazor WebAssembly (WASM) .NET 10 (latest stable) — client-side compiled to WebAssembly
- **UI Library**: Fluent UI Blazor v4.13.2 (or latest patch within v4.13.x)
- **Hosting Model**: Static site hosting for compiled Blazor WASM; serves frontend as static assets (HTML, CSS, JavaScript/WASM) from CDN or blob storage
- **Authentication**: OAuth (via MSAL.js or Microsoft.Authentication.WebAssembly.Msal)
- **API Communication**: HttpClient with OAuth bearer token to containerized backend API
- **Design System**: Centralized DesignTheme with design tokens; theme colors locked to brand palette
- **Validation**: Microsoft DataAnnotationsAttributes mirrored client-side (DataAnnotations attributes map to Blazor form validation)

### Data & Persistence
- **Primary Database**: 
  - **Local Deployment**: SQLite (single-user) or SQL Server LocalDB/Express (multi-user local)
  - **Cloud Deployment**: Azure SQL Database (serverless elastic pools in production)
  - **Database abstraction**: EF Core provider configured via connection string; application code database-agnostic
- **ORM & Data Access**: Entity Framework Core (latest .NET 10 compatible version) for all database interactions; DbContext per aggregate root; repositories abstract EF Core from domain layer. EF Core value converters integrated for F# type marshaling.
- **Schema Management**: EF Core migrations for code-first schema evolution (same migrations work across SQLite, SQL Server, Azure SQL)
- **Event Store**: Dedicated event table (Events with columns: EventId, AggregateId, EventType, Data JSON, Timestamp, Version); events stored as JSON via EF Core value converters
- **Read Projections**: Separate read-only tables (e.g., RideProjection, SavingsProjection) built by background functions or in-process handlers; queried via dedicated read-only DbContext
- **Change Event Streaming**: 
  - **Local Deployment**: In-process event handlers or polling-based projection updates
  - **Cloud Deployment**: Azure SQL Change Tracking/Change Data Capture triggering Azure Functions

### Infrastructure & DevOps
- **Hosting**: 
  - **Local Deployment**: Single `dotnet run` orchestrates entire stack via Aspire: (1) Blazor WASM frontend container serving compiled static assets, (2) .NET Minimal API container, (3) SQLite/LocalDB database container. All services discoverable via Aspire AppHost; frontend connects to API via `localhost:API_PORT`
  - **Cloud Deployment**: Blazor WASM compiled to static assets, hosted in Azure Static Web Apps or Blob Storage + CDN. Containerized API runs in Azure Container Apps
- **Identity**: 
  - **Local Deployment**: User Secrets for local development; environment variables for configuration
  - **Cloud Deployment**: Azure Managed Identity for service-to-service authentication; no connection strings in code
- **Secrets Management**: 
  - **Local Deployment**: .NET User Secrets (development) or local environment variables (production-local)
  - **Cloud Deployment**: Azure Key Vault for database credentials, API keys, OAuth secrets
- **Logging & Monitoring**: 
  - **Local Deployment**: Aspire OpenTelemetry (logs, metrics, traces) with console/file exporters for backend API; browser console for frontend; Aspire Dashboard UI enabled
  - **Cloud Deployment**: Aspire OpenTelemetry exporters to Application Insights for backend API; frontend telemetry optional (browser-side logging to Application Insights via SDK); centralized logs, metrics, traces in Application Insights; Aspire Dashboard UI deployed for cloud diagnostics
- **CI/CD**: 
  - **Local Deployment**: Manual `dotnet run` (Aspire containers) or local Docker Compose
  - **Cloud Deployment**: GitHub Actions with Aspire and azd (Azure Developer CLI) for orchestrated deployment
- **Deployment Artifacts**: 
  - **Local Deployment**: Aspire AppHost (`Program.cs`) defines all services (frontend, API, database); `dotnet run` builds and runs containers locally. Frontend built as part of Aspire orchestration, served by embedded HTTP container
  - **Cloud Deployment**: Blazor WASM static assets (HTML, CSS, JS, WASM binaries) deployed to Azure Static Web Apps or Blob Storage; API containerized in Azure Container Apps via Azure CLI scripts

### Package Management & Updates
- Check latest NuGet versions monthly; update patches for security; propose major/minor upgrades with test coverage
- Pin versions explicitly in .csproj or Directory.Packages.props
- Use mcp_nuget_get-latest-package-version to verify package status before implementation

## Development Workflow

### Specification & Vertical Slices
Each specification defines a **complete, deployable vertical slice**:
- **Frontend**: Blazor page + reusable components with DesignTheme styling
- **API**: One or more Minimal API endpoints handling commands/queries
- **Database**: Event table, read projection table, SQL migrations via .sqlproj
- **Integration**: Background function or event handler to materialize projections (if applicable)
- **Deployment**: Tested locally via single `dotnet run` (Aspire orchestrates frontend, API, database), deployable to Azure Static Web Apps (frontend) + Azure Container Apps (API)

Example: "User records a bike ride" slice includes:
- Blazor WASM form component (RideRecorder.razor, styled with DesignTheme, with DataAnnotationsAttributes validation) compiled and served by Aspire
- POST /rides API endpoint (command handler with DataAnnotationsAttributes on DTO) in containerized backend
- Events table with RideRecorded event; Projections table (RideProjection)
- Background function listening to CES to update RideProjection
- Aspire AppHost configuration for frontend + API + database orchestration; Azure CLI deployment scripts for Static Web Apps (frontend) and Container Apps (API)

### Definition of Done: Vertical Slice Completeness

A vertical slice is **production-ready** only when all items are verified:

- [ ] Specification written, approved by user, linked to spec directory
- [ ] Test plan approved (unit, integration, E2E, security, performance tests identified)
- [ ] All tests written and failing (red phase complete)
- [ ] Implementation complete; all tests passing (green + refactor phases)
- [ ] Code review: architecture compliance verified, naming conventions followed, validation discipline observed
- [ ] Feature branch deployed locally via `dotnet run` (entire Aspire stack: frontend, API, database)
- [ ] Integration tests pass; manual E2E test via Playwright (if critical user journey)
- [ ] All validation layers implemented: client-side (Blazor WASM DataAnnotations), API (DTO DataAnnotations), database (constraints)
- [ ] Events stored in event table with correct schema; projections materialized and queryable
- [ ] SAMPLE_/DEMO_ data cleaned up; no test data committed to main branch
- [ ] Deployed to Azure staging environment via GitHub Actions + azd
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
2. **Tests Approved**: Agent proposes tests; user approves test plan
3. **Tests Fail (Red)**: Proposed tests run and fail without implementation
4. **Implementation (Green)**: Code written to make tests pass
5. **Refactor (Refactor)**: Code cleaned, tests still pass
6. **Code Review**: Implementation reviewed for architecture compliance, naming, performance, validation discipline
7. **Local Deployment**: Slice deployed locally in containers via Aspire, tested manually with Playwright if E2E slice
8. **Azure Deployment**: Slice deployed to Azure Container Apps via GitHub Actions + azd
9. **User Acceptance**: User validates slice meets specification and data validation rules observed

### Compliance Audit Checklist

#### Per-Specification Audit
- [ ] Spec references all seven core principles in acceptance criteria
- [ ] Event schema defined; backwards compatibility verified if updating existing events
- [ ] Data validation implemented at three layers: client (Blazor), API (Minimal API), database (constraints)
- [ ] Test coverage for domain logic ≥85%; F# discriminated unions and ROP patterns tested
- [ ] All SAMPLE_/DEMO_ data removed from code before merge
- [ ] Secrets NOT committed; `.gitignore` verified; pre-commit hook prevents credential leakage
- [ ] Validation rule consistency: if field required in Blazor, enforced in API DTOs and database constraints
- [ ] OAuth isolation verified: user only accesses their data; public data clearly marked

#### Monthly Technology Audit
- [ ] NuGet packages checked via `mcp_nuget_get-latest-package-version` for security patches
- [ ] Security patches applied immediately; major/minor versions proposed with test coverage
- [ ] Blazor FluentUI version pinned to v4.13.x (or latest approved patch)
- [ ] MSAL.js or Microsoft.Authentication.WebAssembly.Msal updated; OAuth integration verified
- [ ] F# compiler version matches latest stable; discriminated union syntax up-to-date
- [ ] EF Core value converters still compatible with F# domain types
- [ ] Aspire OpenTelemetry exporters updated; Application Insights integration verified
- [ ] Aspire Dashboard UI enabled for local and cloud deployments; telemetry visible in dashboard
- [ ] Azure Container Apps pricing and scaling policies reviewed
- [ ] Key Vault access policies audited; expired certificates identified

#### Quarterly Architecture Review
- [ ] Clean Architecture layers remain isolated (domain → infrastructure decoupling verified)
- [ ] Event sourcing invariants maintained: events append-only, no mutation
- [ ] CQRS separation enforced: write path (commands) and read path (projections) distinct
- [ ] Performance SLOs verified: API <500ms p95, projection lag <5s
- [ ] Observability dashboards in Application Insights show active monitoring

### Guardrails (Non-Negotiable)

Breaking these guarantees causes architectural decay and technical debt accrual:

- **No Entity Framework DbContext in domain layer** — domain must remain infrastructure-agnostic. If domain needs persistence logic, use repository pattern abstracting EF.
- **Secrets management by deployment context** — **Cloud**: all secrets in Azure Key Vault; **Local**: User Secrets or environment variables. No connection strings, API keys, or OAuth secrets in appsettings.json, code, or GitHub. Pre-commit hooks enforce this.
- **Event schema is append-only** — never mutate existing events. If schema changes needed, create new event type and version old events. Immutability is non-negotiable.
- **F# domain types must marshal through EF Core value converters** — no raw EF entities exposed to C# API layer. C# records serve as API DTOs; converters handle F#-to-C# translation.
- **Tests must pass before merge** — no exceptions, no "fix later" debt. CI/CD pipeline blocks merge if test suite fails.
- **Three-layer validation enforced** — if field validated in Blazor, also validated in API DTOs and database constraints. No single-layer validation.
- **OAuth token required on all user endpoints** — anonymous access forbidden for personal data. Public data endpoints explicitly marked; separate authorization logic. (Optional for single-user local deployment; mandatory for cloud/multi-user.)
- **SAMPLE_/DEMO_ data never in production** — automated linting prevents prefixed data from deploying. Merge blocked if test data detected.
- **Database provider abstraction** — application code must work across SQLite (local), SQL Server LocalDB (local), and Azure SQL (cloud) without provider-specific queries. Use EF Core abstractions; avoid raw SQL unless necessary and provider-agnostic.

### Onboarding Checklist for New Contributors

1. **Read constitution** (~20 min): Understand mission, seven core principles, technology stack, development workflow
2. **Review decision history** (~15 min): [DECISIONS.md](./DECISIONS.md) explains why F#, why Event Sourcing, why Aspire, why Blazor WASM
3. **Clone repo and bootstrap** (~5 min): `git clone` → `dotnet tool install --global specify-cli` → `dotnet run` (Aspire orchestrates frontend, API, database)
4. **Explore specification examples** (~30 min): Review `/specs/` directory; read 2–3 completed specifications to understand vertical slice completeness
5. **Review test examples** (~20 min): Browse `/bikeTracking.Tests/Unit/` and `/bikeTracking.Tests/Integration/` to understand test patterns (F# unit tests, integration test fixtures, E2E Playwright)
6. **Pair with contributor on first spec** (~2–4 hours): Shadow an experienced team member through red-green-refactor cycle; understand test approval and code review gates
7. **Deploy locally** (~10 min): `dotnet run` and verify Aspire dashboard shows all containers (API, frontend, database, functions)
8. **Review [README.md](../../README.md)** (~10 min): Quick start, prerequisites, development setup, CI/CD pipeline

## Approved MCP Tools

### Documentation & Learning
- **mcp_microsoftdocs_microsoft_docs_search** – Search Microsoft Learn for .NET, Blazor, Azure documentation
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
- **github_repo** – Search GitHub repositories for code examples and patterns (e.g., Event Sourcing with .NET, Blazor authentication)

## Governance

### Constitution as Governing Document
This constitution supersedes all other project guidance. All architectural decisions, code reviews, deployment approvals, and spec acceptance gates must verify compliance with these seven core principles and technology stack requirements.

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

Always commit before continuing to a new phase.

### Related Documents
- **[DECISIONS.md](./DECISIONS.md)**: Amendment history, version changelog, rationale for major decisions
- **[README.md](../../README.md)**: Quick start, prerequisites, CI/CD pipeline setup
- **.specify/templates/**: Plan, spec, task, and command templates aligned with this constitution
- **.github/prompts/**: Runtime prompts for agent-developer interaction

---

**Version**: 1.7.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-04

