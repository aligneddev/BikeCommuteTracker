# Data Events And Projections

## Scope
Event sourcing, CQRS, persistence, and migration-test coupling rules.

## Required
- Persist domain actions as immutable append-only events.
- Separate write behavior (commands/events) from read behavior (projections).
- Keep event and API contracts explicit and versioned.
- Maintain projection builders independently from command handlers.
- For each migration, add or update automated tests that cover the change.
- Prevent schema and contract drift through compatibility checks.

## Design Checks
- Is the event contract backward compatible?
- Is projection behavior validated by tests?
- Is migration impact covered by automated tests?
