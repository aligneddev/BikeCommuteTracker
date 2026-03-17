# Quickstart: Local User Signup and PIN Identity

## Prerequisites

- .NET SDK 10.x
- Node.js 20+
- npm

## 1. Install frontend dependencies

```powershell
cd src/BikeTracking.Frontend
npm install
```

## 2. Run the full local stack

```powershell
cd ../..
dotnet run --project src/BikeTracking.AppHost
```

Use the Aspire dashboard to open:

- `frontend` for the signup UI
- `api` for API endpoint testing

Use the API base URL shown by Aspire for `api` (default local profile is typically `http://localhost:5436`).

## 3. Verify signup API flow

Example request:

```powershell
$apiBase = "http://localhost:5436"
Invoke-RestMethod -Method Post -Uri "$apiBase/api/users/signup" -ContentType "application/json" -Body '{"name":"Alex","pin":"1234"}'
```

Expected results:

- Returns success with new database-generated `userId`
- Duplicate normalized name returns conflict with `name already exists`
- Invalid name/PIN returns validation response

## 4. Verify identification API flow

Example request:

```powershell
Invoke-RestMethod -Method Post -Uri "$apiBase/api/users/identify" -ContentType "application/json" -Body '{"name":"  aLeX  ","pin":"1234"}'
```

Expected results:

- Name normalization (trim + case-insensitive) resolves to same user
- Incorrect PIN returns unauthorized response
- Repeated incorrect PIN attempts trigger progressive delay (up to 30 seconds)

## 5. Verify event reliability behavior

Expected behavior for signup:

- User persistence succeeds first
- `UserRegistered` event is queued in outbox
- Event publishing retries until success if immediate delivery fails

Validation checks:

- Persisted user remains in database even when initial publish fails
- Outbox record transitions to published after retry

## 6. Frontend validation checks

- Name and PIN are required
- Whitespace-only values are rejected
- Validation messages are shown before request submission
- UI remains keyboard-accessible

## 7. Test execution targets (for task phase)

```powershell
dotnet test
```

```powershell
cd src/BikeTracking.Frontend
npm run test
```

```powershell
npm run test:e2e
```

Note: test project files and scripts are defined in `/speckit.tasks` output and implemented in the feature execution phase.

## 8. Validation Run Notes (2026-03-13)

Runtime smoke-test outcomes captured during implementation:

- `POST /api/users/signup` returned `201` for new user (`Jamie`) with `eventStatus: queued`
- Duplicate signup attempts returned `409` with `name already exists`
- `POST /api/users/identify` returned `200` for normalized-name success (`"  aLeX  "`)
- Wrong PIN attempt returned `401`
- Immediate retry after wrong PIN returned `429` with `Retry-After` header
- API logs showed `Published UserRegistered event` entries from the outbox worker
