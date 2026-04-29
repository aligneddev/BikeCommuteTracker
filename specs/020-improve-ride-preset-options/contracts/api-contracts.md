# API Contracts: Ride Preset Options

**Feature**: 020-improve-ride-preset-options  
**Date**: 2026-04-29

## Contract Summary

This feature introduces rider-scoped ride preset CRUD and removes legacy quick-options API usage.

- Added: preset CRUD endpoints
- Added: `selectedPresetId` in ride create request
- Removed: legacy quick-options endpoint from ride-entry behavior

## 1) GET /api/rides/presets

Returns rider-owned presets in MRU order.

Ordering:
1. `lastUsedAtUtc` descending (`null` values last)
2. `updatedAtUtc` descending

Response `200`:

```json
{
  "presets": [
    {
      "presetId": 42,
      "name": "Morning Commute",
      "primaryDirection": "SW",
      "periodTag": "morning",
      "exactStartTimeLocal": "07:45",
      "durationMinutes": 34,
      "lastUsedAtUtc": "2026-04-29T13:02:31Z",
      "updatedAtUtc": "2026-04-29T12:50:00Z"
    }
  ],
  "generatedAtUtc": "2026-04-29T13:05:00Z"
}
```

## 2) POST /api/rides/presets

Creates a new rider-owned preset.

Request:

```json
{
  "name": "Afternoon Return",
  "primaryDirection": "NE",
  "periodTag": "afternoon",
  "exactStartTimeLocal": "17:35",
  "durationMinutes": 32
}
```

Response `201`:

```json
{
  "presetId": 43,
  "name": "Afternoon Return",
  "primaryDirection": "NE",
  "periodTag": "afternoon",
  "exactStartTimeLocal": "17:35",
  "durationMinutes": 32,
  "lastUsedAtUtc": null,
  "updatedAtUtc": "2026-04-29T13:10:00Z"
}
```

Validation errors `400` include:
- duplicate preset name for rider
- invalid `exactStartTimeLocal`
- invalid `durationMinutes`

## 3) PUT /api/rides/presets/{presetId}

Updates an existing rider-owned preset.

Request body shape matches POST.

Response `200`: updated preset DTO.

Error `404`: preset not found for rider.

## 4) DELETE /api/rides/presets/{presetId}

Deletes rider-owned preset.

Response `200`:

```json
{
  "presetId": 43,
  "deletedAtUtc": "2026-04-29T13:20:00Z",
  "message": "Preset deleted"
}
```

## 5) POST /api/rides (extended)

Existing record-ride request is extended with optional `selectedPresetId`.

Request addition:

```json
{
  "selectedPresetId": 42
}
```

Behavior:
- If `selectedPresetId` is present and belongs to rider, backend updates that preset's `lastUsedAtUtc` after successful ride save.
- If omitted, ride save behavior remains unchanged.

## 6) Removed Legacy Contract

Legacy behavior to remove:
- `GET /api/rides/quick-options`
- frontend quick-option fetch/apply flow from ride-entry page

This removal applies to all riders without a feature-flag fallback.

## Security and Isolation

- All preset endpoints require authentication.
- Presets are rider-scoped only.
- Cross-rider access attempts return `404` or `403` depending on endpoint policy.

## Frontend Type Notes

Planned TypeScript additions in ride service layer:
- `RidePreset`
- `RidePresetsResponse`
- `UpsertRidePresetRequest`

Planned request extension:
- `RecordRideRequest.selectedPresetId?: number`
