# Research: Ride Deletion Implementation

**Feature**: Allow Deletion of Rides (007)  
**Branch**: `007-delete-rides`  
**Date**: 2026-03-30  
**Phase**: Phase 0 - Research & Decisions

## Research Objectives

Validate implementation approach for immutable event-sourced ride deletion:
1. How to safely model deletion as an immutable event (not data mutation)
2. Optimal idempotency strategy for duplicate delete requests
3. Confirmation UX patterns that prevent accidental deletion
4. Projection refresh behavior after deletion events
5. Authorization enforcement across layers

## Key Findings

### 1. Event Sourcing for Deletion (DECIDED)

**Decision**: Model deletion as immutable `RideDeleted` event appended to event store; never mutate or soft-delete rides directly.

**Rationale**:
- Preserves complete audit trail (user can see what was deleted and when)
- Deleted rides remain in event history for temporal queries and compliance
- Future replay scenarios still have deletion event context
- Aligns with existing Feature 006 (edit) pattern using `RideEdited` events

**Implementation**:
- Append `RideDeleted` event to event store (ride_id, deleter_user_id, deleted_at timestamp)
- Update read-side projections to exclude deleted rides
- Deletion events flow through outbox for eventual consistency (same as edits)
- No data destruction; only projection state changes

**Alternatives Rejected**:
- Hard delete from database: Loses audit trail, breaks temporal queries, violates event sourcing principle
- Soft-delete flag on rides table: Creates two models (event + flag), complicates queries, doesn't align with architecture

---

### 2. Idempotency Strategy (DECIDED)

**Decision**: Return success immediately if ride already deleted; check deletion event history before processing new delete.

**Rationale**:
- Outbox retry mechanism may re-execute delete handlers
- API could receive duplicate delete requests from network timeouts
- Idempotent design prevents accidental failures causing test flakes
- Aligns with eventual consistency model

**Implementation**:
- Query event store for existing `RideDeleted` event for target ride
- If found: log as idempotent re-attempt, return 200 OK with success message
- If not found: proceed with normal delete flow
- Frontend hides delete button immediately after first confirmation to prevent accidental double-clicks

**Edge Case Handled**:
- Race condition: Two concurrent delete requests for same ride → First appends event, second finds event and returns idempotent success

---

### 3. Confirmation Dialog UX (DECIDED)

**Decision**: Modal confirmation dialog showing ride details (date, distance, notes) with Cancel and Confirm buttons; no inline "delete" under each row.

**Rationale**:
- Protects users from accidental deletion
- Displays ride context to user before permanent action
- Clear visual separation reduces cognitive load
- Explicit "Confirm" button (not auto-dismiss) fits constitutional UX principles
- Accessible (WCAG 2.1 AA) with semantic HTML and keyboard navigation

**Implementation**:
- Delete row trigger → sets React state to show dialog
- Dialog displays full ride details + warning message
- Cancel: dismisses dialog, no state change, focus returns to history table
- Confirm: triggers API call, shows loading state, then dismisses dialog and refreshes history
- Error state: displays error message, allows user to retry or cancel

**Pattern Reuse**:
- Inspired by existing Feature 006 (edit) validation feedback
- Uses similar loading/error state patterns as signup flow

---

### 4. Projection Refresh After Deletion (DECIDED)

**Decision**: Reuse existing Feature 006 infrastructure: outbox publishes deletion event → background service rebuilds affected projections (month, year, all-time totals).

**Rationale**:
- DRY principle: projections for edits already handle total recalculation
- Deletion events follow same event sourcing flow as edits
- No new services or background jobs needed
- Eventually consistent within 5 seconds (constitutional target)

**Implementation**:
- `RideDeleted` event written to outbox (same as `RideEdited`)
- Outbox retry handler: publishes to event bus
- Projection service subscribes to `RideDeleted`
- Projection queries all non-deleted rides and recalculates totals
- Frontend: After delete success, either polls totals or refetches full history (existing pattern)

**Alternatives Rejected**:
- Synchronous total update: Blocks delete API response, violates eventual consistency model
- Separate delete-specific projection: Adds complexity; reuses feature 006 infrastructure sufficient

---

### 5. Authorization: User Ownership Check (DECIDED)

**Decision**: Enforce authorization at 3 layers: frontend hides delete button for non-owned rides, API endpoint checks auth header, domain handler validates ride ownership against current user.

**Rationale**:
- Defense-in-depth: no single point of failure
- Frontend check improves UX (no invalid UI)
- API check prevents bypass attacks
- Domain check ensures business logic + auth are inseparable
- Aligns with constitutional principle of 3-layer validation

**Implementation**:
- Frontend: Query rides endpoint returns `userId`, comparison against `sessionUserId`; show/hide delete button
- API: Extract user from auth token (`HttpContext.User.FindFirst("user_id")`), pass to delete handler
- Domain: Ride handler checks `ride.UserId == currentUserId` before appending event
- Error responses: 401 Unauthorized (not authenticated), 403 Forbidden (authenticated but not ride owner)

**Cookie/Token Strategy**:
- Frontend uses `sessionStorage` for auth token (from Feature 002 login)
- Token includes `user_id` claim (standard JWT pattern)
- API middleware validates token signature and expiry on every request

---

### 6. Frontend State Management (DECIDED)

**Decision**: Use React `useState` for confirmation dialog state; track loading/error during delete operation.

**Rationale**:
- Simple, unidirectional data flow fits React patterns
- No external state manager (redux, zustand) needed for single dialog
- Supports cancellation (clear confirmation state), loading feedback, and error recovery
- Accessible error messages for screen readers

**Implementation**:
- State: `{ showDialog: bool, selectedRideId: string | null, isDeleting: bool, deleteError: string | null }`
- On delete trigger: set `showDialog=true, selectedRideId=rideId`
- On confirm: set `isDeleting=true`, API call, then either `showDialog=false` on success or `deleteError=reason` on failure
- On cancel: set `showDialog=false, selectedRideId=null, deleteError=null`

---

### 7. API Error Responses (DECIDED)

**Decision**: Return explicit error objects with error code and user-friendly message; no generic 500.

**Rationale**:
- Frontend can render specific guidance based on error
- Helps with debugging and support
- Aligns with Feature 006 (edit) error response pattern

**Implementation**:
- `400 Bad Request`: Invalid ride ID format
- `401 Unauthorized`: Missing/invalid auth token
- `403 Forbidden`: User not ride owner
- `404 Not Found`: Ride ID doesn't exist
- `409 Conflict`: Ride was already deleted by another user (idempotent success, not error)
- `500 Internal Server Error`: Database/outbox failure (after retries exhausted)

Response body (JSON):
```json
{
  "error": "FORBIDDEN_NOT_RIDE_OWNER",
  "message": "You can only delete your own rides.",
  "rideId": "ride-123"
}
```

---

## Technical Decisions Summary

| Decision | Approach | Justification |
|----------|----------|---------------|
| Deletion Model | Immutable event (`RideDeleted`) | Event sourcing + audit trail + no data loss |
| Idempotency | Check event history, return success if duplicate | Handles network retries + outbox re-execution |
| Confirmation UX | Modal dialog showing ride details | Prevents accidents + accessible + user-friendly |
| Projection Refresh | Reuse Feature 006 infra (outbox → rebuild totals) | DRY + eventually consistent (no blocking) |
| Authorization | 3-layer check (frontend + API + domain) | Defense-in-depth + consistent with constitution |
| Frontend State | React `useState` + local error tracking | Simple, unidirectional flow, no extra packages |
| API Errors | Explicit error codes + user messages | Better UX + easier debugging |

## Dependencies & Assumptions

**Existing Infrastructure**:
- Feature 005 (History page) exists; delete button added to existing table
- Feature 006 (Edit) infrastructure in place; reuse outbox and projection logic
- Auth/session management (Feature 002-003) already established
- Aspire orchestration and SQLite via EF Core configured

**No New Services**:
- No special background job service needed (reuse Feature 006 projection handler)
- No external auth system changes required (JWT token already in place)
- No new database tables; only new event type in event store

**Backwards Compatibility**:
- Existing `Ride` entity schema unchanged (deletion modeled as event, not schema change)
- Existing API contracts unchanged (new DELETE endpoint only)
- Event store allows new event types by design

## Open Questions (None - Feature 007 Scope Settled)

All clarification questions from specification phase have been resolved via research. Feature 007 scope is clear: immutable delete events + idempotent handling + modal confirmation dialog + projection refresh.
