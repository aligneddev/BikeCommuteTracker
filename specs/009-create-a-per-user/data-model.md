# Data Model: Per-User Settings Page

**Feature**: Per-User Settings Page (009)  
**Branch**: `009-create-a-per-user`  
**Date**: 2026-03-30  
**Phase**: Phase 1 - Design & Contracts

## Overview

This feature introduces a rider-owned settings profile used to persist personal commuting assumptions and optional location coordinates. The model supports first-time save, full/partial updates, and retrieval for pre-populating the settings page.

## Entities

### UserSettingsProfile

Canonical persisted settings collection for one authenticated rider.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| riderId | integer (int64) | Yes | > 0 | Owner identity; unique profile per rider |
| averageCarMpg | number or null | No | if set, > 0 | User-provided car efficiency assumption |
| yearlyGoalMiles | number or null | No | if set, > 0 | Annual ride-distance goal in app distance unit |
| oilChangePrice | number or null | No | if set, > 0 | Cost assumption for oil change |
| mileageRateCents | number or null | No | if set, > 0 | Reimbursement/valuation rate in cents per mile |
| locationLabel | string or null | No | max length 200 | User-facing selected location text |
| latitude | number or null | No | if set, -90 <= value <= 90 | Coordinate from location picker |
| longitude | number or null | No | if set, -180 <= value <= 180 | Coordinate from location picker |
| updatedAtUtc | string (date-time) | Yes | valid date-time | Last saved timestamp |

### UserSettingsResponse

Read contract payload for settings page initialization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| hasSettings | boolean | Yes | Whether rider has previously saved profile state |
| settings | UserSettingsProfileView | Yes | Current persisted values (nullable per field) |

### UserSettingsUpsertRequest

Write contract payload submitted from settings page.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| averageCarMpg | number or null | No | if set, > 0 | |
| yearlyGoalMiles | number or null | No | if set, > 0 | |
| oilChangePrice | number or null | No | if set, > 0 | |
| mileageRateCents | number or null | No | if set, > 0 | Supports cents with decimals if provided |
| locationLabel | string or null | No | max length 200 | |
| latitude | number or null | No | if set, -90 <= value <= 90 | Must pair with longitude when set |
| longitude | number or null | No | if set, -180 <= value <= 180 | Must pair with latitude when set |

### SettingsFormState (Frontend)

Typed client model used by the page.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| values | object | Yes | Current editable fields mirroring API request shape |
| errors | map<string, string> | Yes | Field-level validation messages |
| status | enum | Yes | `idle`, `loading`, `saving`, `saved`, `error` |
| hasLoadedProfile | boolean | Yes | Prevents editing before initial load completes |

## Relationships

- One rider has zero or one `UserSettingsProfile`.
- `UserSettingsProfile` belongs exclusively to one authenticated rider (`riderId`).
- `SettingsFormState` mirrors the server model and is reconciled with `UserSettingsResponse` after load/save.

## State Transitions

1. Rider opens settings page.
2. Frontend calls `GET /api/users/me/settings`.
3. API returns existing profile values (or empty/null settings state for first-time user).
4. Rider edits one or more fields.
5. Frontend validates input and submits `PUT /api/users/me/settings`.
6. API validates payload and upserts the rider-owned profile.
7. API returns updated profile snapshot; frontend updates `SettingsFormState` to `saved`.

## Validation Rules

### API Layer

- Authenticated rider context is required.
- Numeric settings, when present, must be strictly positive.
- Coordinates, when present, must be in valid ranges and provided as a pair.
- Payload must not allow writing another rider's settings.

### Frontend Layer

- Numeric field parsing failures block save and show field-level errors.
- Latitude/longitude pair consistency is enforced before submit.
- Save action is explicit; changes are not persisted on field blur or route change.

### Database Layer

- Unique constraint on rider ownership (`riderId`).
- Coordinate bounds and numeric positivity enforced by constraints where supported.
- Non-null `updatedAtUtc` maintained on each save.

## Failure and Empty-State Behavior

- If profile read returns no saved values, the page loads with unset fields and remains editable.
- If save fails validation, affected fields are highlighted and prior saved values remain intact.
- If save fails unexpectedly, current form values remain on-screen for correction/retry.
- Unauthenticated requests return unauthorized responses and do not expose profile data.