# Data Events And Projections

## Scope
Data events, projections, persistence, and migration-test coupling rules. Event sourcing no longer mandated; default write model = transactional relational with audit logs.

## Required
- Default: persist domain writes transactionally in relational tables; maintain explicit audit logs for traceability.
- Read-side projections allowed for performance or UX; keep projections independent and tested.
- If event-driven model used, ensure immutable event contracts and versioning.
- For each migration, add or update automated tests that cover the change.
- Prevent schema and contract drift through compatibility checks.

## Design Checks
- Is the event contract backward compatible?
- Is projection behavior validated by tests?
- Is migration impact covered by automated tests?
