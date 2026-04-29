# Research: Improve Ride Preset Options

**Feature**: 020-improve-ride-preset-options  
**Date**: 2026-04-29  
**Status**: Complete - all planning clarifications resolved

---

## Decision 1: Preset Time Representation

**Decision**: Store preset time as an exact local clock time (`TimeOnly`) named `ExactStartTimeLocal`, not as a relative window or inferred time.

**Rationale**:
- The specification requires exact start time to be stored and re-applied.
- Storing a pure time value avoids accidental date coupling and keeps presets reusable across days.
- Existing ride entry already captures a full local datetime; applying a preset can safely overwrite only the time component.

**Alternatives considered**:
- Store full `DateTime`: rejected because presets should be reusable and date-independent.
- Store broad morning/afternoon buckets only: rejected because requirement explicitly calls for exact time.

---

## Decision 2: Most-Recently-Used Ordering Semantics

**Decision**: Preset list on ride entry is ordered by `LastUsedAtUtc DESC`, where "used" means a ride is successfully saved with that preset.

**Rationale**:
- Produces deterministic and user-visible recency behavior.
- Avoids noisy ordering changes when a rider merely clicks/tries presets but does not save.
- Aligns with existing event-sourced flow where final write success is the source of truth.

**Alternatives considered**:
- Update recency on preset selection click: rejected because canceled/abandoned forms would reorder list unexpectedly.
- Keep static/manual order: rejected because FR-009 requires MRU ordering.

---

## Decision 3: Legacy Quick-Entry Removal Strategy

**Decision**: Remove legacy quick-entry endpoint, contracts, service wiring, and ride-entry UI for all authenticated riders. No feature flag and no user-segment fallback.

**Rationale**:
- FR-011 requires deleting legacy previous-ride quick-entry UI for all users.
- Eliminates conflicting mental models (history-based quick options vs explicit presets).
- Reduces code-path complexity and test surface.

**Alternatives considered**:
- Keep legacy quick options behind fallback toggle: rejected because it violates replacement requirement.
- Soft-hide frontend UI but keep backend endpoint: rejected because dead paths drift and risk accidental reuse.

---

## Decision 4: API Boundary for Preset CRUD

**Decision**: Add dedicated rider-scoped preset endpoints in rides/settings API surface:
- `GET /api/rides/presets`
- `POST /api/rides/presets`
- `PUT /api/rides/presets/{presetId}`
- `DELETE /api/rides/presets/{presetId}`

And extend `POST /api/rides` request with optional `selectedPresetId` to update MRU on successful save.

**Rationale**:
- Keeps preset lifecycle explicit and testable.
- Avoids overloading generic user settings payload with collection mutation concerns.
- Fits existing Minimal API style and rider-scoped authorization pattern.

**Alternatives considered**:
- Embed full preset CRUD inside `PUT /api/users/settings`: rejected because list mutation semantics become opaque and conflict-prone.
- Update MRU on client only: rejected because ordering must be authoritative and secure server-side.

---

## Decision 5: Direction Defaults by Period

**Decision**: In preset create/update flow, auto-suggest default primary direction based on period:
- `Morning -> SW`
- `Afternoon -> NE`

Suggestion is non-binding and fully user-overridable before save.

**Rationale**:
- Meets FR-006/FR-007/FR-008 exactly.
- Supports commute defaults without constraining custom routes.

**Alternatives considered**:
- Hard-lock direction by period: rejected because override is required.
- No defaults: rejected because default behavior is explicitly required.

---

## Decision 6: Migration Shape

**Decision**: Add a new `RidePresets` table plus additive optional `SelectedPresetId` on ride write contract only (no destructive migration). Keep existing ride history and analytics schema intact.

**Rationale**:
- Preserves historical data and analytics behavior per FR-014.
- Supports rider-scoped unique names and MRU sorting with indexed columns.
- Minimizes regression risk while replacing UI behavior.

**Alternatives considered**:
- Reuse existing rides table to infer presets dynamically: rejected because explicit user-managed names and exact time cannot be represented reliably.
- Delete historical quick-entry artifacts from persisted data: rejected because historical data must remain intact.
