# Coding Standards

Enforceable rules for **new or changed code in a diff**. Cite rules by ID (e.g. `B3`). Formatting and lint rules enforced by tooling (csharpier, ESLint with typescript-eslint and react-hooks, Stylelint with stylelint-config-standard, TypeScript `strict`) are not re-reviewed by hand.
Existing code that breaks a rule is known debt (see the last section): do not copy it into new code, and do not flag lines the diff does not touch.

## General / Architecture

- **A1** Backend calls flow downward only: Endpoints → Application → Infrastructure (docs/backend-stratified-call-graph.md).
- **A2** Endpoint handlers must not query `BikeTrackingDbContext` or `IReceiptStorage` directly; go through an Application service (docs/backend-stratified-call-graph.md).
- **A3** Translate third-party/SDK types at the boundary; they never appear in domain or application models (docs/agent/architecture-principles.md).
- **A4** Put pure rules in L2 (`*Rules` classes or F#); logic duplicated across services moves down into one shared `*Rules` class (docs/backend-stratified-call-graph.md).
- **A5** Keep domain logic pure; time, I/O and external calls happen at the boundaries (docs/agent/domain-and-error-handling.md).

## Backend (C# / F#)

- **B1** Expose endpoints as Minimal APIs in static `*Endpoints` classes with a `Map*Endpoints` extension method; no controllers (.github/copilot-instructions.md).
- **B2** Request DTOs are `sealed record`s in `Contracts/` with data-annotation validation (.github/copilot-instructions.md).
- **B3** Return expected business, validation and conflict outcomes as Result-style values; throw only for unexpected failures (docs/agent/domain-and-error-handling.md, .specify/memory/constitution.md).
- **B4** Inject `TimeProvider` wherever "now" is needed; never call `DateTime.Now` or `DateTime.UtcNow` (docs/agent/testing-and-quality-gates.md).
- **B5** Declare services as `sealed class` with a primary constructor (observed).
- **B6** F# domain code uses discriminated unions, `Result<'T,'E>` and immutable records (.github/copilot-instructions.md).

## Frontend (React / TypeScript)

- **F1** No `any`; explicitly type props, hooks, refs, events and service return types; use `unknown` plus type guards for untyped data (.github/copilot-instructions.md).
- **F2** Function components only, declared as named `export function X` (.github/copilot-instructions.md).
- **F3** No inline CSS (`style={...}`); each component imports its own `.css` file (.github/copilot-instructions.md).
- **F4** One component per file, with a colocated `X.test.tsx` (.github/copilot-instructions.md).
- **F5** Match the file naming convention of sibling files in the same folder (the repo mixes kebab-case and PascalCase); component identifiers are PascalCase (observed).
- **F6** API calls live in `src/services/*-api.ts`, not in components (observed).
- **F7** Client-side validation mirrors the server-side rules for the same field (docs/agent/frontend-and-ux.md).
- **F8** Meet WCAG 2.1 AA and design mobile-first (docs/agent/frontend-and-ux.md).
- **F9** Use design tokens defined in `:root` of `src/index.css`; add new tokens there rather than hard-coding values (docs/agent/frontend-and-ux.md).
- **F10** Store auth tokens in `sessionStorage` only (.github/copilot-instructions.md).

## Tests

- **T1** Write the failing test first and show proof of the failure before implementing (docs/agent/testing-and-quality-gates.md).
- **T2** No mocking framework in `BikeTracking.Api.Tests`; use real objects, `TestFactories.CreateDbContext` (EF InMemory) and TestServer (docs/agent/testing-and-quality-gates.md).
- **T3** Control time in backend tests with `FakeTimeProvider` from `TestSupport/TestFactories.cs` (docs/agent/testing-and-quality-gates.md).
- **T4** Frontend unit tests may use `vi.mock` only at module boundaries (e.g. `src/services/*-api.ts`) (observed).
- **T5** Backend tests use xUnit `[Fact]`/`[Theory]` with `Assert.*`, in `public sealed class XTests`, named `Method_Condition_Expected` (observed).
- **T6** Every PR includes Playwright E2E tests in `src/BikeTracking.Frontend/tests/e2e/*.spec.ts` (AGENTS.md).

## Data & migrations

- **D1** Writes are transactional relational writes with audit logs; do not introduce event sourcing (docs/agent/data-events-and-projections.md, .specify/memory/constitution.md).
- **D2** Every migration adds or updates tests and an entry in the ledger in `Infrastructure/MigrationTestCoveragePolicyTests.cs` (enforced by that test) (docs/agent/data-events-and-projections.md).
- **D3** Projections are independent of each other and each has tests (docs/agent/data-events-and-projections.md).

## Git & PRs

- **G1** Commit messages use Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`, `perf`, `ci`; mark breaking changes with `!` or a `BREAKING CHANGE` footer (CONTRIBUTING.md).
- **G2** Changes land via PR only, never a direct push to `main`, and the PR links an issue (docs/agent/delivery-and-git-workflow.md).
- **G3** Never commit version bumps; release-please owns them (docs/agent/delivery-and-git-workflow.md).

## Known debt (do not copy)

Do not flag these unless the diff touches the offending lines; do not use them as precedent.

- `DateTime.UtcNow` (breaks B4): `Application/Rides/RidePresetService.cs`, `Application/ExpenseImports/CsvExpenseImportService.cs`, `Endpoints/ExpensesEndpoints.cs`, `Infrastructure/Persistence/EfImportJobRepository.cs`.
- Throwing for validation (breaks B3): `Application/Rides/RecordRideService.cs`, `Application/Imports/ImportJobLifecycle.cs`, `Application/Imports/MonthlySummaryImportService.cs`.
- Result types are not unified (`EditRideResult`, `DeleteRideResult`, `OperationResult<T>`, `RidePresetResult`); do not invent a shared result type in a diff unless asked.
- Endpoints querying `DbContext` directly (breaks A2): `ExpensesEndpoints`, `RidesEndpoints`.
- Inline styles (breaks F3): `src/components/ui/chart.tsx`, `ApiStartupGuard.tsx`, `RecordRidePage.tsx`, `HistoryPage.tsx`.
- API call from a component (breaks F6): `ApiStartupGuard.tsx`.
- Dead code: `DeleteRideHandler` is only called from its own test.

## Verification commands

- Backend: `dotnet test BikeTracking.slnx`, then `csharpier format .`
- Frontend (in `src/BikeTracking.Frontend`): `npm run lint && npm run build && npm run test:unit && npm run test:e2e` (E2E needs the app running via Aspire).
