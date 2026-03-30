# Data Model: Record Ride Page MVP

**Branch**: `004-create-the-record-ride-mvp` | **Date**: 2026-03-20

## Overview

This feature introduces a ride recording command/query flow and a `RideRecorded` event payload persisted via the existing outbox event mechanism. It also introduces a per-rider defaults query model for pre-filling the form.

## Entities

### RecordRideCommand

Represents user-submitted form data sent to the API.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| riderId | integer | Yes | >= 1 | Derived from authenticated session context |
| rideDateTimeLocal | string (date-time) | Yes | Valid date-time | Exact user-entered value |
| miles | number | Yes | > 0 and <= 200 | Decimal precision up to 2 places |
| rideMinutes | integer | No | > 0 when provided | Optional duration |
| temperature | number | No | none | Optional ambient temperature in existing app unit |

### RideRecordedEventPayload

Immutable event contract stored in outbox payload JSON and used for downstream publishing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventId | string (guid) | Yes | Unique event identifier |
| eventType | string | Yes | Constant `RideRecorded` |
| occurredAtUtc | string (date-time) | Yes | Server timestamp for event creation |
| riderId | integer | Yes | Rider identity |
| rideDateTimeLocal | string (date-time) | Yes | User-entered ride date/time |
| miles | number | Yes | Recorded miles |
| rideMinutes | integer | No | Optional duration in minutes |
| temperature | number | No | Optional temperature |
| source | string | Yes | Constant `BikeTracking.Api` |

### RiderRideDefaults

Read model used by `GET /api/rides/defaults`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| hasPreviousRide | boolean | Yes | Indicates if defaults can be populated from prior ride |
| defaultMiles | number | No | Last saved miles value |
| defaultRideMinutes | integer | No | Last saved optional minutes |
| defaultTemperature | number | No | Last saved optional temperature |
| defaultRideDateTimeLocal | string (date-time) | Yes | Always current local date/time at response generation |

## Relationships

- One rider can produce many `RideRecorded` events.
- `RiderRideDefaults` is derived from the latest `RideRecorded` event for that rider.
- `RecordRideCommand` transforms into exactly one `RideRecordedEventPayload` when validation passes.

## State Transitions

1. Authenticated rider opens `/rides/record`.
2. Frontend requests `GET /api/rides/defaults`.
3. User submits `RecordRideCommand` via `POST /api/rides`.
4. API validates request.
5. API writes ride row and outbox `RideRecorded` payload in one transaction.
6. API returns success response.
7. Outbox publisher asynchronously publishes the payload.

## Validation Rules

### Frontend

- `rideDateTimeLocal` is required.
- `miles` is required and must be > 0.
- `rideMinutes` is optional; when provided, must be > 0.
- Failed submissions preserve user-entered values and show clear error feedback.

### API

- Repeat frontend numeric/date validation using request DTO validation and endpoint guards.
- Reject malformed date-time or non-positive numeric values with `400`.
- Ensure rider identity comes from authenticated context, not request body.

### Database

- Non-null constraints on required ride fields.
- Check constraints for `miles > 0` and `rideMinutes > 0` when not null.
- Required outbox metadata (`EventType`, payload JSON, occurrence timestamp).
