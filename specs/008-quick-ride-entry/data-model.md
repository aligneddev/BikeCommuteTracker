# Data Model: Quick Ride Entry from Past Rides

**Feature**: Quick Ride Entry from Past Rides (001)  
**Branch**: `008-quick-ride-entry`  
**Date**: 2026-03-30  
**Phase**: Phase 1 - Design & Contracts

## Overview

This feature introduces a read-side model for reusable quick options derived from historical ride records. No new write-side event type is required; quick options are computed from existing rider ride data and consumed by the record-ride UI.

## Entities

### QuickRideOption

Represents one distinct reusable pair of values shown to the rider for fast prefill.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| miles | number | Yes | > 0 and <= 200 | Copied into ride form miles field |
| rideMinutes | integer | Yes | > 0 | Copied into ride form duration field |
| lastUsedAtLocal | string (date-time) | Yes | valid date-time | Most recent occurrence timestamp used for ordering |

### QuickRideOptionsResponse

API response for quick option retrieval.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| options | array of QuickRideOption | Yes | Up to 5 rider-scoped distinct options |
| generatedAtUtc | string (date-time) | Yes | Server timestamp for response generation |

### RideEntryFormState (Frontend)

Client form state that receives copied values.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| miles | number or empty | Yes | User-editable required field |
| rideMinutes | integer or empty | Yes | User-editable required field for this feature's quick-copy behavior |
| isDirty | boolean | Yes | Indicates local edits after prefill/manual changes |
| selectedQuickOption | QuickRideOption or null | No | Tracks current source option for UX feedback |

## Relationships

- One rider can have many Ride Entries.
- Many historical Ride Entries map to one QuickRideOption when `(miles, rideMinutes)` values are identical.
- QuickRideOptionsResponse is derived from the rider's ride history and is not persisted as a standalone table requirement for this phase.

## Derivation Rules

1. Filter ride records to current authenticated rider.
2. Exclude records missing miles or rideMinutes.
3. Group by `(miles, rideMinutes)`.
4. For each group, keep most recent `rideDateTimeLocal` as `lastUsedAtLocal`.
5. Sort groups by `lastUsedAtLocal` descending.
6. Return top 5.

## State Transitions

1. Rider opens record-ride page.
2. Frontend requests `GET /api/rides/quick-options`.
3. Backend returns up to five distinct options.
4. Rider selects one option.
5. Frontend copies option values into `miles` and `rideMinutes` fields.
6. Rider may edit values.
7. Rider submits existing save flow; normal validation applies.
8. On save success, frontend refreshes quick options for future entries.

## Validation Rules

### API Query Layer

- Require authenticated rider context.
- Ensure response contains at most 5 options.
- Ensure each option is unique by exact `(miles, rideMinutes)` pair.
- Ensure each returned option contains valid positive values.

### Frontend Layer

- Option selection must not trigger API write/save.
- Copied values remain editable.
- Existing validation messages and submission guards remain unchanged.

### Security/Isolation

- Query must return only options derived from the authenticated rider's rides.
- Cross-user data leakage is prohibited.

## Failure and Empty-State Behavior

- If options query returns empty array, quick-entry section renders empty/hidden state and manual entry remains available.
- If query fails, show non-blocking error and keep manual ride entry usable.
- If rider has fewer than 5 valid distinct patterns, return only available options.