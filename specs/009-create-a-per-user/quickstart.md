# Quickstart: Per-User Settings Page

**Feature**: Per-User Settings Page  
**Branch**: `009-create-a-per-user`  
**Date**: 2026-03-30

## Quick Reference

- API contract: [user-settings-api.yaml](./contracts/user-settings-api.yaml)
- Existing dependent contracts:
  - signup/identify baseline: `specs/002-user-signup-pin/contracts/signup-identify-api.yaml`
  - login usage of identify endpoint: `specs/003-user-login/contracts/login-api.yaml`
- API playground requests: `src/BikeTracking.Api/BikeTracking.Api.http` (settings GET/PUT scenarios)
- Frontend route target: `/settings` (placeholder route wired in `src/BikeTracking.Frontend/src/App.tsx`)

## Implementation Steps

### 1. Add Backend Settings Read/Upsert Endpoints

1. Map authenticated endpoint `GET /api/users/me/settings`.
2. Map authenticated endpoint `PUT /api/users/me/settings`.
3. Add application service logic to:
- resolve current rider ID from auth context
- load settings profile for rider
- create profile on first save
- update profile on later saves
- validate numeric and coordinate constraints before persistence
4. Return response DTO aligned with contract.

### 2. Add Frontend Settings Page

1. Add route/page for authenticated settings management.
2. Load profile values on page mount via `GET /api/users/me/settings`.
3. Render fields for average car mpg, yearly goal, oil change price, mileage rate (cents), and location picker.
4. Offer an optional browser-location action that fills latitude and longitude for riders who allow geolocation access.
5. On save, validate client-side and submit `PUT /api/users/me/settings`.
6. Render field-level validation feedback and save status messages.

### 3. Handle Partial Profile and Update Flow

1. Support empty/unset optional fields on first load.
2. Support single-field updates without requiring full re-entry.
3. Ensure a user can clear optional values intentionally (set back to unset).
4. Keep user isolation strict: no cross-user data visibility or updates.

### 4. TDD Workflow (Mandatory)

1. Write failing tests first for endpoint auth boundaries, validation, create/update semantics, and frontend field behavior.
2. Run tests and capture failing outputs.
3. Obtain user confirmation that failures are meaningful.
4. Implement minimum code to make approved tests pass.
5. Re-run tests after each meaningful change.

## Suggested Test Coverage

### Backend

- unauthenticated requests to settings endpoints return unauthorized
- first-time save creates rider settings profile
- subsequent save updates only authenticated rider profile
- positive numeric validation enforced for provided fields
- coordinate range and coordinate-pair validation enforced

### Frontend

- existing settings load and populate fields
- first-time empty settings state is editable
- save sends expected payload including optional null/unset values
- field-level validation prevents invalid submit
- save success and error states are shown accessibly

### E2E

- authenticated rider can save settings and see values on reload
- rider can update one field without losing other settings
- one rider cannot see or mutate another rider's settings

## Verification Commands (Mandatory)

```bash
# backend checks
cd /workspaces/neCodeBikeTracking
dotnet test BikeTracking.slnx

# frontend checks
cd /workspaces/neCodeBikeTracking/src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit

# cross-layer/authenticated journey checks
npm run test:e2e
```

## Manual Verification Flow

1. Start stack: `dotnet run --project src/BikeTracking.AppHost`
2. Authenticate as rider A and open settings page.
3. Save values for all requested fields, including a valid location.
4. Use the browser-location action and confirm latitude/longitude are populated when permission is granted.
5. Refresh page and confirm values persist.
6. Update only one field and save; confirm untouched fields remain unchanged.
7. Clear one optional field (for example, average car mpg) and save; confirm it returns as unset on reload.
8. Authenticate as rider B and verify rider A settings are not visible.
9. Enter invalid numeric/coordinate values and confirm validation blocks save.

## Acceptance Notes

- Settings are strictly rider-scoped and require authentication.
- Numeric settings are positive when provided and may remain unset if unknown.
- Location persists as latitude/longitude (and optional label) from picker input.
- Riders can optionally use browser geolocation to prefill latitude and longitude before saving.
- Save is explicit; no background auto-save is required in this feature.
- First-time create and later update use the same endpoint contract.
- Settings updates are partial: only changed fields are sent from the UI, while omitted fields are preserved.
- Explicit null values clear optional settings fields when the rider intentionally removes a value.