# Domain And Error Handling

## Scope
Rules for domain modeling and expected-flow error handling.

## Required
- Model core business logic as pure functions when feasible.
- Keep impure effects (time, I/O, external calls) at application boundaries.
- Use immutable domain state and explicit transformation steps.
- Prefer F# discriminated unions and active patterns for domain modeling.
- Represent expected business, validation, and conflict outcomes with explicit Result-style return values.
- Reserve exceptions for unexpected failures only.

## Design Checks
- Can this behavior be tested without infrastructure?
- Are expected failures represented as data, not thrown exceptions?
- Are side effects isolated to adapters or handlers?
