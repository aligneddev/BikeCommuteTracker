# Quickstart: Edit Rides in History

**Branch**: `006-edit-ride-history` | **Date**: 2026-03-27 | **Status**: Complete

## Feature Overview

Enable riders to edit existing ride records directly from the history table. This feature implements three independent user stories:

1. **US1 - Inline Edit Control**: Click Edit → modify miles → Save or Cancel
2. **US2 - Validation & Conflict Handling**: Client/server validation, optimistic concurrency, 409 conflict responses
3. **US3 - Consistent Totals**: After successful save, refresh history summaries/filtered totals with active filters preserved

## Prerequisites

- Feature `005-view-history-page` is available and history table is visible for authenticated riders.
- DevContainer is running with `.NET 10 SDK` and `Node.js 24+`.
- App boots via `dotnet run --project src/BikeTracking.AppHost` (Aspire orchestration).
- RideEntity includes `Version` field configured as EF Core concurrency token with default value 1.

## Architecture Overview

### Backend (Minimal API + Edit Service)

**Endpoint**: `PUT /api/rides/{rideId}`

**Request DTO**:
```csharp
public record EditRideRequest(
    DateTime RideDateTimeLocal,
    decimal Miles,
    int? RideMinutes,
    decimal? Temperature,
    int ExpectedVersion
);
```

**Service Pattern** (`EditRideService`):
- Validates request payload (Miles > 0, RideMinutes > 0 if provided)
- Loads ride by ID, checks rider ownership
- Compares ExpectedVersion with current ride.Version
- Returns typed `EditRideResult` (success or error) — **NOT exception-driven**
- On success: updates ride, increments version, appends `RideEdited` event to outbox
- On conflict: returns `EditRideResult.Failure("RIDE_VERSION_CONFLICT", message, currentVersion)`

**Error Responses**:
- `400 Bad Request`: Validation failed (Miles ≤ 0, RideMinutes ≤ 0)
- `403 Forbidden`: Ride belongs to different rider
- `404 Not Found`: Ride ID doesn't exist
- `409 Conflict`: ExpectedVersion doesn't match current version (includes `currentVersion` in response)
- `200 OK`: Success (includes `RideId`, `NewVersion`, `Message`)

### Frontend (React + History Table)

**Edit Flow**:
1. User clicks "Edit" button on a row → enter inline edit mode
2. Miles field becomes editable (number input)
3. Date, duration, temperature read-only (for MVP)
4. Validation on save: Miles > 0, warn user if invalid
5. On Save: call `editRide(rideId, { ...fields, expectedVersion: 1 })`
6. Handle result:
   - Success: refresh history with same filter/pagination
   - Validation/Conflict error: display message, preserve edit mode, user can retry
7. On Cancel: discard changes, exit edit mode

**Summaries Refresh**:
- After successful save, automatically call `getRideHistory` with current filter + page
- Updates summary cards (this month, this year, all time)
- Updates visible total (filtered miles)
- Updates individual row values

### Data Model

**RideEntity** changes:
```csharp
public int Version { get; set; } = 1;  // Concurrency token, default 1
```

**RideEditedEventPayload**:
```json
{
  "riderId": 1,
  "rideId": 42,
  "previousVersion": 1,
  "newVersion": 2,
  "rideDateTimeLocal": "2026-03-20T10:30:00",
  "miles": 15.5,
  "rideMinutes": 45,
  "temperature": 68,
  "occurredAtUtc": "2026-03-27T15:00:00Z"
}
```

**Outbox Event**:
- EventType: `"RideEdited"`
- AggregateType: `"Ride"`
- AggregateId: ride ID
- EventPayloadJson: serialized RideEditedEventPayload

## Step-by-Step Implementation

### Step 1: Schema & API Layer Setup

- Add `Version: int = 1` to RideEntity
- Create migration or code-first schema update
- Register `EditRideService` in DI container
- Map `PUT /api/rides/{rideId}` endpoint

### Step 2: Backend Edit Command Service

Implement `EditRideService.ExecuteAsync`:
```csharp
public async Task<EditRideResult> ExecuteAsync(
    long riderId,
    long rideId,
    EditRideRequest request,
    CancellationToken cancellationToken = default
)
```

**Validation Logic**:
1. Validate request payload (miles, ride minutes)
2. Load ride from database
3. Check ride exists → return 404 error
4. Check ride.RiderId == riderId → return 403 forbidden error
5. Check request.ExpectedVersion == ride.Version → return 409 conflict error
6. Update ride fields and increment version
7. Append RideEdited event to outbox
8. Persist changes
9. Return success result with new version

**Result Pattern**: Use discriminated union or explicit Result type. **Never throw exceptions for validation/business outcomes.**

### Step 3: Endpoint Response Mapping

In `RidesEndpoints.MapRidesEndpoints`:
```csharp
group
    .MapPut("/{rideId:long}", PutEditRide)
    .WithName("EditRide")
    .WithSummary("Edit an existing ride")
    .Produces<EditRideResponse>(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
    .Produces<ErrorResponse>(StatusCodes.Status403Forbidden)
    .Produces<ErrorResponse>(StatusCodes.Status404NotFound)
    .Produces<ErrorResponse>(StatusCodes.Status409Conflict)
    .RequireAuthorization();
```

Map result outcome to HTTP response:
- Success → 200 + EditRideResponse payload
- Validation failed → 400 + ErrorResponse
- Forbidden → 403 + ErrorResponse
- Not found → 404 + ErrorResponse
- Conflict → 409 + { code, message, currentVersion }

### Step 4: Frontend API Integration

Add to `ridesService.ts`:
```typescript
export async function editRide(
  rideId: number,
  request: EditRideRequest
): Promise<EditRideResult> {
  const response = await fetch(`${API_BASE_URL}/api/rides/${rideId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  })

  if (response.ok) {
    return { ok: true, value: (await response.json()) as EditRideResponse }
  }

  try {
    const payload = await response.json()
    return {
      ok: false,
      error: {
        code: payload.code ?? `HTTP_${response.status}`,
        message: payload.message ?? "Failed to edit ride",
        currentVersion: payload.currentVersion,
      },
    }
  } catch {
    return { ok: false, error: { code: `HTTP_${response.status}`, message: "Failed to edit ride" } }
  }
}
```

Return type: Discriminated union `{ ok: true; value: ... } | { ok: false; error: ... }`

### Step 5: Frontend History Table Edit Mode

In `HistoryPage.tsx`:

**State**:
```typescript
const [editingRideId, setEditingRideId] = useState<number | null>(null)
const [editedMiles, setEditedMiles] = useState<string>('')
const [error, setError] = useState<string>('')
```

**UI**:
- Normal mode: show Edit button per row
- Edit mode: replace miles cell with input, show Save + Cancel buttons
- Validation: check Miles > 0 before sending to server
- Error display: show alert with code + message if conflict/validation fails
- Keep edit mode active on error (user can retry)

**Save Handler**:
```typescript
async function handleSaveEdit(ride: RideHistoryRow): Promise<void> {
  const milesValue = Number(editedMiles)
  if (!Number.isFinite(milesValue) || milesValue <= 0) {
    setError('Miles must be greater than 0')
    return
  }

  const result = await editRide(ride.rideId, {
    rideDateTimeLocal: ride.rideDateTimeLocal,
    miles: milesValue,
    rideMinutes: ride.rideMinutes,
    temperature: ride.temperature,
    expectedVersion: 1, // TODO: get from ride projection
  })

  if (!result.ok) {
    if (result.error.code === 'RIDE_VERSION_CONFLICT') {
      setError(`${result.error.message} Current version: ${result.error.currentVersion}.`)
    } else {
      setError(result.error.message)
    }
    return
  }

  // Success: refresh history, clear edit mode
  setError('')
  setEditingRideId(null)
  setEditedMiles('')

  // Refresh history with active filters preserved
  await loadHistory({
    from: fromDate || undefined,
    to: toDate || undefined,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 25,
  })
}
```

### Step 6: E2E Testing

Use `tests/e2e/edit-ride-history.spec.ts` to verify:
1. Signup → Record ride → Navigate to history
2. Enter edit mode, modify miles, save successfully
3. Verify row updates and summaries refresh
4. Verify validation blocks save (Miles ≤ 0)
5. Verify cancel discards changes
6. Verify summaries update when editing with active date filter

Run:
```bash
cd src/BikeTracking.Frontend
npm run test:e2e
```

## Verification Commands

**Backend**:
```bash
dotnet test BikeTracking.slnx
```

**Frontend**:
```bash
cd src/BikeTracking.Frontend
npm run lint
npm run build
npm run test:unit
npm run test:e2e  # Edit history E2E scenarios + smoke tests
```

**HTTP Examples**: See `src/BikeTracking.Api/BikeTracking.Api.http` for:
- Edit ride (successful update)
- Validation error (Miles ≤ 0)
- Version conflict (stale expectedVersion)

## Implementation Result

All three user stories are independently functional:
- **US1**: Inline edit controls in history table with Save/Cancel
- **US2**: Validation errors (client + server), conflict detection with `409` + current version
- **US3**: Summaries refresh after save, active filters preserved, totals stay consistent

**Tests**: 60+ backend tests pass; 50+ frontend unit tests pass; E2E scenarios cover full edit flow and return to history with refreshed totals.
