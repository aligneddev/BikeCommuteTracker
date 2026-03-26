# Quickstart: Record Ride Page MVP

**Branch**: `004-create-the-record-ride-mvp` | **Date**: 2026-03-20

## Prerequisites

- Signup/login flow available locally.
- Local stack runnable via Aspire:

```bash
dotnet run --project src/BikeTracking.AppHost
```

- Frontend dependencies installed:

```bash
cd src/BikeTracking.Frontend
npm ci
```

## Step 1: Add Ride Contracts and Endpoints

1. Add ride request/response DTOs in API contracts.
2. Add ride endpoint mapping with:
- `POST /api/rides`
- `GET /api/rides/defaults`
3. Register endpoint group in API startup.

## Step 2: Implement Ride Application Services

1. Implement record ride command handling:
- validate payload
- map to persistence entity
- create `RideRecorded` outbox payload
- save transaction
2. Implement defaults query service:
- find latest ride for authenticated rider
- return defaults for miles, optional ride minutes, optional temperature
- always return current local date/time as `defaultRideDateTimeLocal`

## Step 3: Persist Ride Data and Event

1. Extend DbContext with ride persistence entity.
2. Add EF migration for rides table and check constraints.
3. Reuse existing outbox persistence pattern currently used for user registration event publishing.

## Step 4: Build Frontend Record Ride Page

1. Add protected route `/rides/record`.
2. Build form fields:
- day/time (required, default now)
- miles (required, default last inserted)
- ride minutes (optional, default last inserted)
- temperature (optional, default last inserted)
3. On load, fetch `GET /api/rides/defaults` and prefill.
4. Submit to `POST /api/rides`; show success and retry-friendly error states.
5. Preserve user-entered values when save fails.

## Step 5: TDD-First Implementation Sequence (Mandatory)

1. Define tests that should fail first (frontend unit tests, API endpoint tests, service-level tests).
2. Implement failing tests only.
3. Run failing tests and present output for user confirmation.
4. Implement minimum code to turn tests green.
5. Re-run tests after each meaningful change.

## Step 6: Verification Matrix (Mandatory)

Run impacted checks after code changes:

```bash
# frontend checks
cd src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit

# backend and integration checks
cd /workspaces/neCodeBikeTracking
dotnet test
```

For auth/cross-layer changes, also run:

```bash
cd src/BikeTracking.Frontend
npm run test:e2e
```

## Manual Verification Flow

1. Login with an existing user.
2. Navigate to `/rides/record`.
3. Confirm date/time defaults to now.
4. Submit a first ride with required fields only.
5. Reopen page and verify miles defaults to the last inserted value.
6. Submit a second ride with optional values.
7. Reopen page and verify optional defaults now populate.
8. Trigger invalid miles and ride minutes and confirm validation blocks submit.
9. Simulate API failure and verify entered values remain for retry.
