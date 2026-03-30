# Research: Per-User Settings Page

**Feature**: Per-User Settings Page (009)  
**Branch**: `009-create-a-per-user`  
**Date**: 2026-03-30  
**Phase**: Phase 0 - Research & Decisions

## Research Objectives

1. Define contract shape for loading and saving rider-specific settings.
2. Determine persistence strategy for first-time create and subsequent updates.
3. Determine validation boundaries for numeric and coordinate fields.
4. Define partial-save behavior for unknown user values.
5. Define location picker representation and transport format.

## Key Findings

### 1. Settings API Shape (DECIDED)

**Decision**: Provide an additive rider-scoped settings contract with two endpoints: `GET /api/users/me/settings` and `PUT /api/users/me/settings`.

**Rationale**:
- Keeps settings access explicit and contract-first.
- Supports idempotent full or partial field updates through a single write endpoint.
- Avoids coupling with signup/login contracts while preserving authenticated user context.

**Alternatives considered**:
- Add fields to existing identify/login response: rejected because settings lifecycle is independent of login.
- Use multiple per-field endpoints: rejected due to higher API complexity and chatty client behavior.

---

### 2. Persistence Model Strategy (DECIDED)

**Decision**: Use one rider-owned settings profile record (create on first save, update on later saves), keyed by rider identity and stored in existing SQLite/EF Core infrastructure.

**Rationale**:
- Matches per-user isolation requirements.
- Minimizes schema complexity while supporting atomic update of related settings.
- Fits current architecture and avoids adding a new storage engine.

**Alternatives considered**:
- Separate table/entity per settings field: rejected as over-normalized for MVP scope.
- Store settings only in client session storage: rejected due to persistence and cross-device/browser inconsistency.

---

### 3. Validation Rules (DECIDED)

**Decision**: Enforce positive numeric validation for provided numeric fields and standard geographic bounds for coordinates (`latitude` in [-90, 90], `longitude` in [-180, 180]), with nullable values for optional/unset settings.

**Rationale**:
- Aligns with specification requirements for positive numeric inputs.
- Prevents invalid geospatial values from entering the system.
- Supports progressive profile completion when riders do not know all values yet.

**Alternatives considered**:
- Require all fields at first save: rejected because spec explicitly allows partial settings.
- Allow unconstrained coordinates and sanitize later: rejected because invalid values can propagate to downstream features.

---

### 4. Partial Update Semantics (DECIDED)

**Decision**: `PUT` treats omitted or null optional fields as intentional "unset"/"leave unset" values and persists only submitted valid state for the authenticated rider.

**Rationale**:
- Supports first-time and incremental updates with one contract.
- Prevents accidental overwrites of unrelated users or profiles.
- Keeps frontend behavior straightforward for form save operations.

**Alternatives considered**:
- Introduce separate PATCH semantics for partial updates: rejected for unnecessary contract branching at this stage.
- Force full payload on each save: rejected due to friction and mismatch with partial profile requirement.

---

### 5. Location Picker Transport Format (DECIDED)

**Decision**: Represent saved location as a structure containing optional display label plus numeric `latitude` and `longitude` values.

**Rationale**:
- Preserves map/search UX context via label while keeping calculations based on coordinates.
- Avoids vendor lock-in to a specific map provider payload.
- Keeps backend contract focused on normalized values.

**Alternatives considered**:
- Persist only label text: rejected because coordinates are required by the spec.
- Persist provider-specific place blob: rejected due to unnecessary coupling and migration risk.

## Technical Decisions Summary

| Decision Area | Chosen Approach | Why |
|---------------|-----------------|-----|
| API contract | `GET` + `PUT` on `/api/users/me/settings` | Simple, rider-scoped, additive |
| Persistence | One rider-owned settings profile record | Minimal schema with clear ownership |
| Validation | Positive numerics + bounded coordinates + nullable optional fields | Data integrity with partial completion |
| Update semantics | Idempotent save of submitted profile state | Supports first-save and edits |
| Location format | Label + latitude/longitude | UX context without provider lock-in |

## Dependencies & Assumptions

- Authenticated user identity is available in API request context.
- Existing EF Core migration workflow will add or evolve settings persistence schema.
- Frontend has existing authenticated route pattern where settings page can be integrated.
- No breaking change to prior feature contracts is required.

## Open Questions

None. All planning clarifications for this feature are resolved.