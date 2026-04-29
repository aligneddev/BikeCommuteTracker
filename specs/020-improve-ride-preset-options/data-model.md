# Data Model: Improve Ride Preset Options

**Feature**: 020-improve-ride-preset-options  
**Date**: 2026-04-29  
**Status**: Phase 1 design complete

---

## Overview

This feature introduces explicit rider-managed presets and removes history-derived quick-entry behavior.

Primary model changes:
1. Add persisted rider-owned `RidePreset` entity.
2. Add optional preset usage linkage on ride save request (`selectedPresetId`) to maintain MRU ordering.
3. Remove legacy quick-option projection/use from ride-entry UI and endpoint surface.

---

## New Entity: RidePreset

Planned file area: `src/BikeTracking.Api/Infrastructure/Persistence/Entities/`

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `RidePresetId` | `long` | Yes | PK | Identity key |
| `RiderId` | `long` | Yes | `> 0` | Owner scope; FK-like relationship to rider |
| `Name` | `string` | Yes | 1..80 chars, unique per rider | Display label in settings + ride entry |
| `PrimaryDirection` | `string` | Yes | compass enum used by existing rides contracts | Default direction to apply |
| `PeriodTag` | `string` | Yes | `Morning` or `Afternoon` | Drives default direction suggestion only |
| `ExactStartTimeLocal` | `TimeOnly` | Yes | valid local time | Exact time persisted in preset |
| `DurationMinutes` | `int` | Yes | `> 0` and within existing ride-minute constraints | Default duration |
| `LastUsedAtUtc` | `DateTime?` | No | UTC | MRU sort key; updated only on successful ride save using preset |
| `CreatedAtUtc` | `DateTime` | Yes | UTC | Audit |
| `UpdatedAtUtc` | `DateTime` | Yes | UTC | Audit |
| `Version` | `int` | Yes | optimistic concurrency | For update/delete conflict handling |

### Constraints

- Unique index: `(RiderId, Name)`.
- Index for ride-entry ordering: `(RiderId, LastUsedAtUtc DESC, UpdatedAtUtc DESC)`.
- `PeriodTag` limited to known values (`Morning`, `Afternoon`).

---

## API Contract Models

### RidePresetDto

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `presetId` | number | Yes | server identifier |
| `name` | string | Yes | unique per rider |
| `primaryDirection` | CompassDirection | Yes | reusable from existing ride direction type |
| `periodTag` | `morning` \| `afternoon` | Yes | lowercase in JSON |
| `exactStartTimeLocal` | string (`HH:mm`) | Yes | exact preset time |
| `durationMinutes` | number | Yes | integer minutes |
| `lastUsedAtUtc` | string \| null | No | MRU sort metadata |
| `updatedAtUtc` | string | Yes | secondary sort/tie-breaker metadata |

### UpsertRidePresetRequest

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | 1..80, unique per rider |
| `primaryDirection` | CompassDirection | Yes | must be valid enum |
| `periodTag` | `morning` \| `afternoon` | Yes | required |
| `exactStartTimeLocal` | string (`HH:mm`) | Yes | parseable exact time |
| `durationMinutes` | number | Yes | positive integer |

### RecordRideRequest (extension)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `selectedPresetId` | number | No | if present and rider-owned, backend updates `LastUsedAtUtc` after successful ride save |

---

## Relationships

- One rider has many `RidePreset` records.
- One ride save may reference zero or one preset via `selectedPresetId`.
- Presets are never shared across riders (strict rider scope).

---

## State Transitions

### Preset CRUD

1. Rider opens settings and fetches presets.
2. Rider creates or updates preset.
3. Backend validates unique name per rider and stores exact time/duration/direction.
4. Rider may delete preset; deletion removes it from future ride-entry choices only.

### Preset Use in Ride Entry (MRU)

1. Ride entry loads presets ordered by `LastUsedAtUtc DESC`, then `UpdatedAtUtc DESC`.
2. Rider selects preset; client populates direction, exact start time (time component), duration.
3. Rider can edit values manually before submit.
4. On successful `POST /api/rides` with `selectedPresetId`, backend updates that preset `LastUsedAtUtc = now`.

---

## Validation Rules

- Preset name must be unique per rider.
- `durationMinutes` must remain within existing ride validation limits.
- `exactStartTimeLocal` is mandatory and must be exact (`HH:mm`) not free-text.
- Default direction suggestions:
  - morning -> SW
  - afternoon -> NE
- Suggestions are non-binding; persisted direction is always rider-selected value.

---

## Legacy Quick-Entry Decommission

The following behavior is removed for all riders:
- Backend `GetQuickRideOptionsService` endpoint usage path.
- Frontend "Quick Ride Options" section and associated fetch/action flow.

Historical rides remain unchanged and continue to support analytics/reporting.
