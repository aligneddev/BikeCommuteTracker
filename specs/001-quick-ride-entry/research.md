# Research: Quick Ride Entry from Past Rides

**Feature**: Quick Ride Entry from Past Rides (001)  
**Branch**: `001-quick-ride-entry`  
**Date**: 2026-03-30  
**Phase**: Phase 0 - Research & Decisions

## Research Objectives

1. Determine where quick options should be derived (frontend from history payload vs dedicated backend query)
2. Define distinctness and ordering logic for the up-to-5 option list
3. Confirm prefill semantics so selection never bypasses validation or auto-saves
4. Define behavior when rider has little/no reusable history
5. Define refresh behavior so newly saved rides can influence future quick options

## Key Findings

### 1. Option Source Strategy (DECIDED)

**Decision**: Add a dedicated rider-scoped query endpoint to return quick ride options (`GET /api/rides/quick-options`) instead of deriving from paged history responses in the frontend.

**Rationale**:
- Avoids coupling quick-entry behavior to pagination/filter state from history views
- Keeps quick-option logic centralized and consistent across clients
- Reduces frontend data-processing complexity and payload size
- Preserves contract-first modularity with an explicit additive interface

**Alternatives considered**:
- Reuse `/api/rides/history` and derive client-side: rejected due to pagination/filter mismatch and extra client processing
- Local cache/session-only options: rejected because they can drift from persisted rider history

---

### 2. Distinctness and Ordering Rules (DECIDED)

**Decision**: Define a quick option as a unique `(miles, rideMinutes)` pair and order options by most recently recorded occurrence, returning at most 5.

**Rationale**:
- Matches the requirement for distinct options
- Most-recent ordering best aligns with "many rides are the same most days"
- Bounded response keeps UI fast and scan-friendly

**Alternatives considered**:
- Use frequency ranking (most common): rejected for MVP due to extra aggregation complexity and weaker recency relevance
- Include temperature in distinctness key: rejected because requirement only asks to copy miles and duration

---

### 3. Prefill Safety Semantics (DECIDED)

**Decision**: Option selection updates only in-memory form values for miles and rideMinutes; no write occurs until explicit submit.

**Rationale**:
- Prevents accidental saves
- Preserves existing command-side validation and user control
- Supports user edits after prefill without special exceptions

**Alternatives considered**:
- Auto-submit on option click: rejected due to high accidental-write risk and explicit requirement conflict
- Lock copied fields from editing: rejected because riders need small adjustments on similar days

---

### 4. Missing or Invalid History Handling (DECIDED)

**Decision**: Exclude rides lacking either miles or rideMinutes from quick-option derivation and return an empty option array when no valid distinct pairs exist.

**Rationale**:
- Ensures every option can fully populate both required quick-copy fields for this feature
- Keeps behavior deterministic and avoids partially filled prefills
- Empty response cleanly supports manual entry fallback

**Alternatives considered**:
- Include partial records and fill only one field: rejected because feature requires copying both miles and duration
- Return placeholder/fake defaults: rejected because they are not rider-derived and could mislead users

---

### 5. Option Refresh Timing (DECIDED)

**Decision**: Refresh quick options after each successful ride save and also load options when opening the record-ride page.

**Rationale**:
- Satisfies requirement that new rides influence future quick entry
- Keeps option list current within the active session
- Minimal complexity: same query can be reused for initial load and post-save refresh

**Alternatives considered**:
- Refresh only on full page reload: rejected because newly repeated rides would not appear immediately
- Polling-based refresh: rejected for unnecessary complexity and network cost

## Technical Decisions Summary

| Decision Area | Chosen Approach | Why |
|---------------|-----------------|-----|
| Data source | Dedicated `GET /api/rides/quick-options` endpoint | Contract clarity and consistent derivation |
| Distinctness | Unique `(miles, rideMinutes)` pair | Exactly matches copy requirement |
| Ordering/limit | Most recent first, max 5 | Fast, relevant shortlist |
| Prefill behavior | Client-side copy only; explicit submit required | Prevent accidental persistence |
| Missing data handling | Exclude incomplete historical records | Avoid partial/ambiguous prefills |
| Refresh behavior | Load on page open + refresh after successful save | Keeps options current |

## Dependencies & Assumptions

- Existing ride recording endpoint and authenticated ride-entry page remain in place.
- Existing rides persistence already stores values needed to derive miles + duration pairs.
- Auth context is available in API to scope query results to current rider.
- No new event type is required for quick options in this feature.

## Open Questions

None. All planning clarifications for feature scope are resolved.