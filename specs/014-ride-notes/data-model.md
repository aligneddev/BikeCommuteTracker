# Data Model: Ride Notes

**Feature**: 014-ride-notes
**Date**: 2026-04-14
**Status**: Complete

## Overview

This feature adds note support across manual ride record/edit, ride history projection, and CSV import validation.

## Entity: Ride

Existing persistent ride aggregate row (`RideEntity`) gains an optional note field.

| Field | Type | Rules / Notes |
|------|------|----------------|
| `Id` | `int` | Existing primary key |
| `RiderId` | `long` | Existing ownership scope |
| `RideDateTimeLocal` | `DateTime` | Existing required field |
| `Miles` | `decimal` | Existing range validation `(0.01..200]` |
| `Notes` | `string?` | New optional plain-text note, max 500 characters |

### Validation invariants

- `Notes == null` or empty is valid.
- Non-empty `Notes` must have `Length <= 500`.
- Notes are treated as plain text and must be escaped/encoded when rendered.

## Entity: RideHistoryRow (API contract projection)

Ride history response row includes note presence/content for UI rendering.

| Field | Type | Rules / Notes |
|------|------|----------------|
| `RideId` | `long` | Existing |
| `RideDateTimeLocal` | `DateTime` | Existing |
| `Miles` | `decimal` | Existing |
| `Note` | `string?` | New optional field used by compact indicator and overlay reveal |

## Entity: ImportRow

Import row already includes `Notes`; this feature refines validation behavior.

| Field | Type | Rules / Notes |
|------|------|----------------|
| `RowNumber` | `int` | Existing |
| `Notes` | `string?` | Existing parsed CSV Notes value |
| `ValidationStatus` | `string enum` | Existing: `valid` / `invalid` |
| `ValidationErrorsJson` | `string?` | Existing error payload store |

### Validation invariants

- If `Notes` length is greater than 500, row is `invalid` with a specific note-length error.
- Oversized-note rows do not block processing of other valid rows in same import job.

## State transitions

### Manual create/edit

- `NoNote -> NoteSaved` when valid note text is submitted.
- `NoteSaved -> NoteUpdated` when valid edit replaces note.
- `NoteSaved -> NoNote` when note is cleared and saved.

### Import

- `pending -> valid -> processed` for rows where note is null/empty/<=500.
- `pending -> invalid -> failed` for rows where note length > 500.

## Relationship map

- One rider has many rides.
- One ride may have zero or one note value.
- One import job has many import rows; each row can carry one optional note value.
