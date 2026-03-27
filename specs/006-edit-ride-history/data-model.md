# Data Model: Edit Rides in History

**Branch**: `006-edit-ride-history` | **Date**: 2026-03-27

## Overview

This feature adds a write-side edit flow for existing rider-owned rides while preserving immutable event history. It introduces one edit command payload, one new domain event contract, and read-side projection refresh behavior for history totals.

## Entities

### RideEditRequest

Client-submitted command payload for editing one ride row.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| rideDateTimeLocal | string (date-time) | Yes | valid date-time | Rider-visible local ride timestamp |
| miles | number | Yes | > 0 | Required numeric field |
| rideMinutes | integer | No | null or > 0 | Optional duration |
| temperature | number | No | nullable | Optional weather value |
| expectedVersion | integer | Yes | >= 1 | Optimistic concurrency token |

Rules:
- `miles` must be strictly greater than zero.
- `rideMinutes`, when provided, must be strictly greater than zero.
- Required fields must be present for save.

### RideEditResult

Server response for a successful edit operation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rideId | integer | Yes | Edited ride identifier |
| newVersion | integer | Yes | Version after edit is appended |
| message | string | Yes | Success confirmation text |

### RideEditedEvent

Immutable domain/integration event representing a correction to an existing ride.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventId | string (uuid) | Yes | Unique event identity |
| occurredAtUtc | string (date-time) | Yes | Event timestamp |
| riderId | string | Yes | Owner of edited ride |
| rideId | integer | Yes | Ride aggregate identity |
| previousVersion | integer | Yes | Version before edit |
| newVersion | integer | Yes | Version after edit |
| rideDateTimeLocal | string (date-time) | Yes | Updated ride date/time |
| miles | number | Yes | Updated miles |
| rideMinutes | integer | No | Updated optional duration |
| temperature | number | No | Updated optional temperature |

Rules:
- `newVersion` must be exactly `previousVersion + 1`.
- Event append fails when `expectedVersion` does not match current version.

### RideProjectionRow (Read Model)

Current-state row used by history table and summary aggregations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rideId | integer | Yes | Stable row identity |
| riderId | string | Yes | Ownership scope |
| version | integer | Yes | Latest applied event version |
| rideDateTimeLocal | string (date-time) | Yes | Current displayed ride date/time |
| miles | number | Yes | Current displayed miles |
| rideMinutes | integer | No | Current optional duration |
| temperature | number | No | Current optional temperature |

Rules:
- Projection reflects the latest event version per `rideId`.
- Summary calculations read from this latest-state projection.

## Relationships

- One rider owns many `RideProjectionRow` values.
- One `RideProjectionRow` is produced from an ordered event stream including `RideRecorded` and optional `RideEditedEvent` entries.
- One `RideEditRequest` for a ride may produce exactly one `RideEditedEvent` when version checks pass.

## State Transitions

1. Rider enters edit mode for one history row.
2. Rider submits `RideEditRequest`.
3. API validates payload and rider ownership.
4. API verifies `expectedVersion` against current ride version.
5. On match: append `RideEditedEvent`, update projection, return success.
6. On mismatch: return conflict (`409`) with latest version context.
7. Frontend refreshes row + summaries so totals remain consistent with latest projection state.
