# Testing And Quality Gates

## Scope
Mandatory test and validation requirements before implementation and merge.

## TDD Workflow
1. Write tests that define expected behavior before implementation.
2. Execute tests and prove they fail for behavioral reasons.
3. Obtain explicit confirmation of failing-test evidence before coding.
4. Implement the minimum change to satisfy failing tests.
5. Re-run tests after meaningful changes.
6. Refactor only while tests remain green.

## Red-Proof Policy
- Failing-test proof is mandatory before implementation.
- A committed red checkpoint is optional.

## Required Verification Matrix
- Frontend-only changes:
  - `cd src/BikeTracking.Frontend`
  - `npm run lint`
  - `npm run build`
  - `npm run test:unit`
- Backend or domain changes:
  - `dotnet test`
- Cross-layer or authentication changes:
  - Run all impacted commands above
  - `cd src/BikeTracking.Frontend && npm run test:e2e`

## Backend Test Conventions
- No mocking framework (Moq/NSubstitute) is used in `BikeTracking.Api.Tests`. Use real objects,
  the EF Core in-memory provider (`TestFactories.CreateDbContext`), and in-process
  `WebApplication`/`TestServer` hosts instead. This avoids mock-tautology and over-specified
  mock-interaction anti-patterns and keeps tests coupled to behavior, not implementation.
- Inject `TimeProvider` (registered as `TimeProvider.System` in `Program.cs`) into any service
  that needs "now"/"today" instead of calling `DateTime.Now`/`DateTime.UtcNow` directly. Tests
  pass `TestSupport.FakeTimeProvider` with a fixed instant so calendar-boundary logic (e.g.
  "this week"/"this month") never depends on wall-clock time.

## PR Gate
- E2E tests are required for every PR.
