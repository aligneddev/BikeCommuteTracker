# Data Model: Ride Deletion

**Feature**: Allow Deletion of Rides (007)  
**Branch**: `007-delete-rides`  
**Date**: 2026-03-30  
**Phase**: Phase 1 - Design & Contracts

## Overview

Ride deletion is modeled as an immutable append-only event. No schema changes to ride aggregates; deletion events persist alongside ride creation/edit events in the event store, and projections filter out deleted rides.

## Event Model

### RideDeleted Event

**Purpose**: Record that a ride belonging to a user was deleted at a specific timestamp.

**Event Type**: `RideDeleted`  
**Event Sourcing Pattern**: Append-only; never mutated; part of ride aggregate history

**Event Schema (F# Domain Layer)**

```fsharp
[<DataContract>]
type RideDeleted = {
    [<DataMember>]
    UserId: string
    [<DataMember>]
    RideId: string
    [<DataMember>]
    DeletedAt: System.DateTime
    [<DataMember>]
    DeletedBy: string  // user_id who initiated deletion (for audit)
}
```

**Event Attributes**:
- `RideId`: UUID of the deleted ride (immutable identifier)
- `UserId`: Ride owner (ensures deletion is attributed to correct user)
- `DeletedAt`: UTC timestamp when deletion was persisted
- `DeletedBy`: User ID of the person who requested deletion (same as `UserId` in initial design; allows for future admin override scenarios)

**Example Event**:
```json
{
  "EventType": "RideDeleted",
  "RideId": "550e8400-e29b-41d4-a716-446655440000",
  "UserId": "user-42",
  "DeletedAt": "2026-03-30T14:22:15Z",
  "DeletedBy": "user-42"
}
```

**Invariants**:
- `RideId` and `UserId` must match an existing live ride (or already-deleted ride)
- `DeletedAt` must be set to current UTC time (server-enforced)
- `DeletedBy` must match the authenticated user making the request (API enforces)
- One deletion event per ride per deletion action (no re-deletion after initial deletion event)

---

## Domain Aggregates

### Ride Aggregate (Unchanged Schema, New Event Type)

The `Ride` aggregate has no schema changes. Instead, deletion is represented by the presence of a `RideDeleted` event in the ride's event stream.

**Ride State** (as projected from events):

```fsharp
type Ride = {
    Id: string
    UserId: string
    StartTime: System.DateTime
    Distance: decimal
    Duration: System.TimeSpan
    Notes: string option
    CreatedAt: System.DateTime
    Last modified: System.DateTime
    DeletedAt: System.DateTime option  // None = live, Some = deleted
}
```

**Live Ride Characteristics**:
- `DeletedAt` is `None`
- Appears in history table queries
- Can be edited (generates `RideEdited` event)
- Can be deleted (generates `RideDeleted` event)

**Deleted Ride Characteristics**:
- `DeletedAt` is `Some <utc-time>`
- Filtered out from history table queries
- Cannot be edited (edit handler checks deletion status first)
- Cannot be deleted again (duplicate delete is idempotent, returns success)
- Remains in event store for audit and replay

---

## Read-Side Projections

### History Table Projection

**Purpose**: Materialized view of all non-deleted rides for a user.

**Projection Query**:
```sql
SELECT r.Id, r.StartTime, r.Distance, r.Duration, r.Notes, r.CreatedAt
FROM Rides r
WHERE r.UserId = :userId
  AND r.DeletedAt IS NULL
ORDER BY r.StartTime DESC
```

**Update Trigger**: 
- On `RideCreated` event → insert row
- On `RideEdited` event → update values (distance, duration, notes, start_time)
- On `RideDeleted` event → delete row (or set soft-delete flag, depending on implementation)

**Idempotency**: Deletion events are idempotent:
- First `RideDeleted` event → removes ride from projection
- Duplicate `RideDeleted` event (same ride_id, same user_id) → no-op (row already absent, or update is idempotent state change)

---

### Totals Projections

**Purpose**: Computed aggregations of non-deleted rides for a user.

**Projections** (recalculated on `RideDeleted` event):
1. **Monthly Total**: `SUM(distance) GROUP BY YEAR, MONTH WHERE deleted_at IS NULL`
2. **Annual Total**: `SUM(distance) GROUP BY YEAR WHERE deleted_at IS NULL`
3. **All-Time Total**: `SUM(distance) WHERE deleted_at IS NULL`
4. **Count (non-deleted rides)**: `COUNT(*) WHERE deleted_at IS NULL`

**Update Logic**:
- On `RideDeleted` event, totals projection handler:
  1. Queries existing totals for user (month, year, all-time)
  2. Subtracts deleted ride's distance from each applicable total
  3. Writes updated totals back to projection table
  4. Triggers frontend to refresh displayed totals

**Example Recalculation**:
```
Before deletion:
  - Monthly (Mar 2026): 45.5 miles, 12 rides
  - All-time: 342.0 miles, 87 rides

Deleted ride:
  - Date: 2026-03-28
  - Distance: 5.2 miles

After deletion:
  - Monthly (Mar 2026): 40.3 miles, 11 rides
  - All-time: 336.8 miles, 86 rides
```

---

## API Contract (Request/Response)

### DELETE /api/rides/{rideId}

**Authentication**: Bearer token (JWT) in Authorization header

**Request Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**: Empty (idempotent DELETE semantic)

**Path Parameters**:
- `rideId`: UUID of ride to delete (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

**Success Response (200 OK)**:
```json
{
  "rideId": "550e8400-e29b-41d4-a716-446655440000",
  "deletedAt": "2026-03-30T14:22:15Z",
  "message": "Ride deleted successfully."
}
```

**Idempotent Response (200 OK, if ride already deleted)**:
```json
{
  "rideId": "550e8400-e29b-41d4-a716-446655440000",
  "deletedAt": "2026-03-30T13:15:00Z",
  "message": "Ride was already deleted.",
  "isIdempotent": true
}
```

**Error Responses**:

| Status | Error Code | Scenario |
|--------|-----------|----------|
| `400 Bad Request` | `INVALID_RIDE_ID` | Malformed UUID in path |
| `401 Unauthorized` | `MISSING_AUTH` | No Authorization header |
| `401 Unauthorized` | `INVALID_TOKEN` | Token expired or malformed |
| `403 Forbidden` | `NOT_RIDE_OWNER` | Authenticated user does not own this ride |
| `404 Not Found` | `RIDE_NOT_FOUND` | Ride ID doesn't exist in any user's history |
| `500 Internal Server Error` | `OUTBOX_ERROR` | Event persistence failed (after retries) |

**Error Response Body Example**:
```json
{
  "error": "NOT_RIDE_OWNER",
  "message": "You do not have permission to delete this ride.",
  "rideId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-30T14:22:15Z"
}
```

---

## State Transitions

### Valid Delete Flow

```
[Live Ride] 
  → DELETE /api/rides/{rideId} + Auth 
  → Domain handler executes (checks ownership)
  → RideDeleted event appended to event store
  → Event written to outbox
  → Outbox handler publishes event
  → Projection handler marks ride as deleted
  → Totals recalculated
  → [Deleted Ride (filtered out)]
```

### Edge Cases

**Case 1: Duplicate Delete (Idempotent)**
```
[Deleted Ride (DeletedAt = T1)] 
  → DELETE /api/rides/{rideId} + Auth 
  → Domain handler checks: already RideDeleted event exists
  → Return 200 OK (idempotent success)
  → No new event appended
```

**Case 2: Cross-User Attack**
```
[Live Ride (UserId = user-1)]
  → DELETE /api/rides/{rideId} + Auth(user-2)
  → Domain handler checks: ride.UserId != user-2
  → Return 403 Forbidden
  → No event appended
```

**Case 3: Non-Existent Ride**
```
[No Ride with rideId]
  → DELETE /api/rides/{rideId} + Auth
  → Domain handler checks: ride not found
  → Return 404 Not Found
```

---

## Data Persistence

### Event Store Table (No Changes)

Existing `Events` table structure. New rows added for `RideDeleted` events:

```sql
INSERT INTO Events (EventId, EventType, RideId, UserId, EventData, CreatedAt, ProcessedAt)
VALUES (
  'evt-uuid',
  'RideDeleted',
  'ride-uuid',
  'user-42',
  '{"DeletedAt":"2026-03-30T14:22:15Z","DeletedBy":"user-42"}',
  GETUTCDATE(),
  NULL
);
```

### Outbox Table (No Changes)

`RideDeleted` events flow through existing outbox:

```sql
INSERT INTO Outbox (Id, EventType, Payload, CreatedAt, ProcessedAt, RetryCount)
VALUES (
  'outbox-uuid',
  'RideDeleted',
  '{"RideId":"ride-uuid","UserId":"user-42","DeletedAt":"2026-03-30T14:22:15Z"}',
  GETUTCDATE(),
  NULL,
  0
);
```

---

## Validation Rules

### Before Processing Delete Command

1. **Ride ID format**: Must be valid UUID (v4)
2. **Authentication**: Auth header present and valid JWT token
3. **Ride existence**: Ride ID must exist in event store (live or already deleted)
4. **Ownership**: `ride.UserId` must equal authenticated user's ID

### Domain-Level Constraints

1. **No double-deletion-event**: If `RideDeleted` event already exists for ride, return idempotent success
2. **Timestamp**: `DeletedAt` set to server UTC time (no client override)
3. **Immutability**: Once appended, deletion event never modified

### Read-Side Constraints

1. **Projection filtering**: All rides queries exclude where `DeletedAt IS NOT NULL`
2. **Totals recalculation**: Totals exclude deleted rides automatically
3. **Audit retention**: Deleted rides remain in event store indefinitely
