# Research: Record Ride Page MVP

**Branch**: `004-create-the-record-ride-mvp` | **Date**: 2026-03-20

## 1. Default Value Source for Record Ride Form

Decision: Use the most recently persisted ride for the authenticated rider as the source of default values for miles, optional ride minutes, and optional temperature. Date/time always defaults to current local time.

Rationale: This directly matches the requirements and avoids stale client-only defaults when a user records rides from multiple sessions. Server-sourced defaults keep behavior deterministic and testable.

Alternatives considered:
- Client-only memory or session storage defaults: rejected because defaults can drift from persisted truth.
- Use averages instead of last value: rejected because the requirement explicitly says default to last inserted.

## 2. API Shape for Recording and Prefill

Decision: Introduce two ride-focused endpoints under `/api/rides`: `POST /api/rides` to record a ride event and `GET /api/rides/defaults` to retrieve last inserted values for prefill.

Rationale: Separates command and query concerns, aligns with CQRS direction, and keeps frontend logic simple and explicit.

Alternatives considered:
- Single POST endpoint returning next defaults only after save: rejected because initial page load still needs defaults.
- Embed defaults in login response: rejected because defaults can change independently after login.

## 3. Event Persistence Strategy

Decision: Persist each successful ride submission as a new immutable `RideRecorded` payload in the existing outbox events table and publish using the current outbox worker pipeline.

Rationale: Reuses the established reliability pattern (currently used by user registration events) and satisfies the requirement that rides are persisted as events.

Alternatives considered:
- Add a dedicated event-store table immediately: rejected for MVP because current outbox structure already stores immutable event payloads and avoids unnecessary schema expansion.
- Persist only a mutable rides table without event payload: rejected because the feature requires event persistence.

## 4. Validation and Date/Time Semantics

Decision: Enforce `miles > 0` and optional `rideMinutes > 0` when provided across validation layers. Preserve exact submitted `rideDateTimeLocal` values.

Rationale: Positive numeric validation is explicitly required; preserving exact submitted values is required by FR-012 and avoids silent mutation.

Alternatives considered:
- Reject all future dates: rejected because the spec lists this as an edge case but does not require blocking future timestamps.
- Coerce invalid numeric values to zero: rejected because it alters user intent and hides data quality issues.

## 5. Frontend Route Placement and Access Control

Decision: Add a protected route `/rides/record` reachable only for authenticated users.

Rationale: Keeps identity isolation consistent with the existing protected routing approach and ensures ride events are linked to authenticated riders.

Alternatives considered:
- Place form directly on a summary shell page: rejected to avoid coupling dashboard and form concerns.
- Public route with soft guard: rejected because this feature is rider-specific and requires authenticated identity.

## 6. Retry-Oriented UX Behavior

Decision: Keep entered values when save fails, show a clear submission error message, and allow immediate retry without form reset.

Rationale: This directly satisfies FR-014 and reduces user friction when transient API/network issues occur.

Alternatives considered:
- Clear form on any failed submission: rejected because it loses user-entered data and conflicts with FR-014.
- Auto-retry in background: rejected for MVP due to complexity and limited value over explicit user retry.
