# API Contracts: Ride Notes

**Feature**: 014-ride-notes
**Date**: 2026-04-14

## Scope

This contract describes additive API shape changes required to support notes in:
- Manual ride record/edit (`/api/rides`)
- Ride history projection (`/api/rides/history`)
- CSV import validation/results (`/api/imports/*`)

## 1. Record Ride Request (Additive)

Endpoint: `POST /api/rides`

### Request shape change

Add optional `note` field:

```json
{
  "rideDateTimeLocal": "2026-04-14T08:15:00",
  "miles": 8.4,
  "rideMinutes": 33,
  "note": "Headwind on the bridge, took side street return route."
}
```

### Validation

- `note` optional.
- When provided, `note.length <= 500`.
- On violation, return `400` validation response with explicit field-level message.

## 2. Edit Ride Request (Additive)

Endpoint: `PUT /api/rides/{rideId}`

### Request shape change

Add optional `note` field with same validation rules:

```json
{
  "rideDateTimeLocal": "2026-04-14T08:15:00",
  "miles": 8.4,
  "expectedVersion": 2,
  "note": "Updated: rain started halfway through ride."
}
```

### Validation

- `note` optional.
- Max length 500.
- Existing optimistic concurrency behavior remains unchanged.

## 3. Ride History Row Response (Additive)

Endpoint: `GET /api/rides/history`

### Response shape change

Add optional `note` field on each `rides[]` row:

```json
{
  "rideId": 120,
  "rideDateTimeLocal": "2026-04-14T08:15:00",
  "miles": 8.4,
  "note": "Headwind on the bridge, took side street return route."
}
```

### Semantics

- `note` null or omitted means no note indicator should render.
- `note` non-empty means history UI renders compact indicator with reveal interaction.

## 4. CSV Import Preview/Processing (Behavioral Contract)

Endpoints:
- `POST /api/imports/preview`
- `POST /api/imports/start`
- `GET /api/imports/{importJobId}/status`

### Existing field

`ImportPreviewRow.notes` remains optional and continues to carry parsed note text from CSV.

### Validation behavior refinement

- If parsed note length > 500, row is invalid with note-specific error.
- Oversized-note row remains in preview errors and is excluded from valid import processing.
- Other valid rows are still importable in same job.

### Example row-level error

```json
{
  "rowNumber": 12,
  "field": "Notes",
  "code": "NOTE_TOO_LONG",
  "message": "Note must be 500 characters or fewer."
}
```

## Backward Compatibility

- Changes are additive and non-breaking for existing clients that do not send/use `note`.
- Existing import payloads remain valid; only oversized notes produce row-level errors.
