# Research: Edit Rides in History

**Branch**: `006-edit-ride-history` | **Date**: 2026-03-27

## Decisions

### 1. Edit API command shape and endpoint

**Decision**: Use a dedicated authenticated command endpoint `PUT /api/rides/{rideId}` to submit full row-edit values for one ride at a time.

**Rationale**: A single-row full-update command matches table edit UX (save/cancel per row), keeps request validation straightforward, and avoids partial-update ambiguity for optional field clearing.

**Alternatives considered**:
- `PATCH /api/rides/{rideId}` with sparse payload: flexible but adds merge complexity and unclear semantics when fields are intentionally cleared.
- Reuse existing record endpoint with mode flags: reduces endpoint count but conflates create and edit concerns.

---

### 2. Concurrency/conflict control strategy

**Decision**: Require an optimistic concurrency token (`expectedVersion`) in edit requests and return `409 Conflict` when the submitted version is stale.

**Rationale**: This prevents silent overwrites when two edits race on the same ride and directly satisfies the spec requirement for graceful conflict handling.

**Alternatives considered**:
- Last-write-wins: simplest implementation but violates conflict visibility requirement.
- Pessimistic locks: stronger consistency but unnecessary overhead for this local-first single-row UX.

---

### 3. Event-sourcing representation for edits

**Decision**: Persist successful edits as new immutable `RideEdited` domain events that reference the target ride identity and prior version.

**Rationale**: This preserves auditability and complies with constitutionally required append-only event history while still allowing read models to reflect corrected values.

**Alternatives considered**:
- In-place mutation of existing ride record only: easier query path but breaks audit trail and event-sourcing principle.
- Delete+recreate event pair: explicit but noisier and less semantically clear than a dedicated edit event.

---

### 4. Summary recalculation behavior after save

**Decision**: After successful edit save, refresh history query state from API (row + summaries) rather than performing client-only optimistic summary math.

**Rationale**: Server-authoritative recalculation avoids drift across month/year/all-time/filtered aggregates and respects active filters consistently.

**Alternatives considered**:
- Client optimistic delta updates: responsive but error-prone when filters, timezone boundaries, or optional fields interact.
- Deferred refresh only on full page reload: simpler, but violates immediate consistency expectations in the spec.

---

### 5. Validation layering for edit fields

**Decision**: Enforce numeric and required rules in three layers: frontend row editor validation, API DTO/data annotation validation, and persistence guards in domain/application logic.

**Rationale**: Defense-in-depth aligns with constitution and ensures invalid ride edits are rejected even if frontend checks are bypassed.

**Alternatives considered**:
- API-only validation: secure but weaker UX feedback.
- Frontend-only validation: good UX but unsafe and bypassable.
