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

## PR Gate
- E2E tests are required for every PR.
