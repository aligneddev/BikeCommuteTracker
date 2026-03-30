# Quickstart: Ride Deletion (Feature 007)

**Feature**: Allow Deletion of Rides  
**Branch**: `007-delete-rides`  
**Date**: 2026-03-30

## Quick Reference

### 1. Contracts & Schemas

- **Delete Endpoint**: [ride-delete-api.yaml](./contracts/ride-delete-api.yaml) (OpenAPI 3.0)
- **Event Schema**: [ride-deleted-event.schema.json](./contracts/ride-deleted-event.schema.json) (JSON Schema)

### 2. Key Files to Implement

**Backend (C# + F#)**:
- `src/BikeTracking.Domain.FSharp/Users/Rides.fs` — Add `RideDeleted` event definition
- `src/BikeTracking.Api/Endpoints/Rides/DeleteRide.cs` — DELETE endpoint handler
- `src/BikeTracking.Api/Application/Rides/DeleteRideHandler.cs` — Domain command execution
- `src/BikeTracking.Api.Tests/Endpoints/DeleteRideTests.cs` — Endpoint tests
- `src/BikeTracking.Api.Tests/Application/DeleteRideHandlerTests.cs` — Domain handler tests

**Frontend (React + TypeScript)**:
- `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.tsx` — Confirmation modal
- `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.css` — Dialog styling
- `src/BikeTracking.Frontend/src/services/rideService.ts` — DELETE API client method
- `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx` — Delete trigger integration
- `src/BikeTracking.Frontend/tests/components/RideDeleteDialog.test.tsx` — Dialog tests

### 3. Validation Commands

Run these commands to validate the implementation:

#### Backend

```bash
# Full test suite (unit + integration)
cd /workspaces/neCodeBikeTracking
dotnet test BikeTracking.slnx

# Run only delete-related tests
dotnet test BikeTracking.slnx -k "Delete|delete"

# Format code
csharpier format .

# Check compilation
dotnet build BikeTracking.slnx
```

#### Frontend

```bash
cd /workspaces/neCodeBikeTracking/src/BikeTracking.Frontend

# Linting
npm run lint

# Build
npm run build

# Unit tests
npm run test:unit

# E2E tests (requires API running via Aspire)
npm run test:e2e
```

#### Full Stack

```bash
cd /workspaces/neCodeBikeTracking

# Start Aspire + API + Frontend
dotnet run --project src/BikeTracking.AppHost

# In another terminal: E2E tests
cd src/BikeTracking.Frontend
npm run test:e2e

# Check DB state
# Open browser to http://localhost:19629 (Aspire Dashboard)
# Launch frontend from dashboard and manually test delete flow
```

### 4. Manual Testing Workflow

#### Setup
1. Start the app: `dotnet run --project src/BikeTracking.AppHost`
2. Open browser to http://localhost:5173 (frontend, launched from Aspire Dashboard)
3. Sign up with name + PIN
4. Record 2-3 test rides
5. Navigate to History page

#### Test Scenarios

**TC-001: Delete a Valid Ride**
1. Click delete icon on a ride row
2. Confirmation dialog appears with ride details (date, distance, notes)
3. Click "Cancel" → dialog closes, ride remains
4. Click delete again → dialog appears again
5. Click "Confirm" → ride removed from table, success message shown
6. Refresh page → ride still gone (persisted)
7. Check totals (month, year, all-time) → decreased by deleted ride's distance

**TC-002: Delete with Empty History**
1. Delete all rides from history table
2. Table shows "No rides yet" empty state
3. Totals show 0 / "No data"

**TC-003: Unauthorized Delete (Cross-User)**
1. Open browser DevTools → Application → sessionStorage
2. Copy auth token
3. Open incognito window, sign up as different user, get their auth token
4. In first window, craft manual fetch: 
   ```javascript
   fetch('/api/rides/{otherUserRideId}', {
     method: 'DELETE',
     headers: { 'Authorization': 'Bearer {token}' }
   })
   ```
5. Response should be 403 Forbidden with error code `NOT_RIDE_OWNER`

**TC-004: Delete Already-Deleted Ride (Idempotency)**
1. Delete a ride successfully (ride removed from table)
2. In DevTools, manually call DELETE again with same rideId
3. Response should be 200 OK with `isIdempotent: true`
4. Table should not change (no accidental re-addition)

**TC-005: Filtered Delete**
1. Set date filter on history page (e.g., "Last 30 days")
2. Delete a ride within the filter range
3. Ride disappears from filtered view
4. Filtered total updates correctly
5. Un-filter → ride doesn't reappear

---

## Key Test Scenarios (Automated)

### Backend Tests

**Unit Tests (Domain Handler)**:
- ✓ Deleting a live ride appends `RideDeleted` event
- ✓ Deleting an already-deleted ride is idempotent (no duplicate event)
- ✓ Cross-user delete attempt returns authorization error
- ✓ Delete nonexistent ride returns not-found error
- ✓ Deletion event is written to outbox for publish

**Integration Tests (API Endpoint)**:
- ✓ DELETE /api/rides/{rideId} with valid token + owner → 200 OK
- ✓ DELETE with invalid token → 401 Unauthorized
- ✓ DELETE as different user → 403 Forbidden
- ✓ DELETE with malformed UUID → 400 Bad Request
- ✓ DELETE nonexistent ride → 404 Not Found
- ✓ Idempotent DELETE returns 200 OK

### Frontend Tests

**Unit Tests (Dialog Component)**:
- ✓ Dialog hidden by default
- ✓ Clicking delete button shows dialog with ride details
- ✓ Cancel button hides dialog without API call
- ✓ Confirm button disables button and shows loading
- ✓ Success response hides dialog and refreshes history
- ✓ Error response shows error message with retry option

**E2E Tests (Full Flow)**:
- ✓ Sign up → record ride → delete → verify removed from table + totals updated
- ✓ Sign up → record 3 rides → delete middle ride → verify correct totals
- ✓ Sign up → delete → refresh page → deleted ride still gone
- ✓ Sign up → set filter → delete ride in filter → verify filtered total updates

---

## Data Validation Rules

### Input Validation

- **rideId**: Must be valid UUID format (v4); reject malformed UUIDs with 400 Bad Request
- **Authentication**: JWT token required in Authorization header; reject missing token with 401 Unauthorized
- **Ownership**: User ID in token must match ride owner; return 403 if mismatch

### State Validation

- **Ride exists**: Check event store before processing; return 404 if not found
- **Deletion event**: Check if `RideDeleted` event exists; idempotent response if yes
- **Totals consistency**: After delete, all totals must exclude deleted ride (verified via query results)

---

## Event Flow Diagram

```
Frontend (Delete Click)
        ↓
    Dialog Confirmation
        ↓
    DELETE /api/rides/{rideId}
        ↓
    API Handler Layer
        ↓
    Domain Handler (F#)
        ├─ Check ownership
        ├─ Append RideDeleted event
        └─ Write to outbox
        ↓
    Return 200 OK to Frontend
        ↓
    Frontend updates UI
        ↓
    Outbox Service (background)
        ├─ Publishes RideDeleted event
        └─ Updates projections
        ↓
    Projection Handler
        ├─ Remove ride from history view
        ├─ Recalculate totals
        └─ Persist new projections
        ↓
    [Ride now deleted in read model]
```

---

## Acceptance Criteria

**AC-001**: Riders can delete their own rides via a confirmation dialog that displays ride details.  
**AC-002**: Deleted rides are immediately removed from the history table display.  
**AC-003**: All affected totals (month, year, all-time, filtered) update immediately after deletion.  
**AC-004**: Non-owners cannot delete other users' rides (403 Forbidden).  
**AC-005**: Re-deleting an already-deleted ride returns 200 OK without side effects (idempotent).  
**AC-006**: Deleted rides persist as immutable events in the event store.  
**AC-007**: Page refresh does not restore deleted rides (persistent deletion).  
**AC-008**: API responses include explicit error codes for all failure paths (400, 401, 403, 404, 500).

---

## Debugging Checklist

If a test fails, inspect:

1. **Event Store**: Did `RideDeleted` event persist?
   ```sql
   SELECT * FROM Events WHERE RideId = ? AND EventType = 'RideDeleted' ORDER BY CreatedAt DESC LIMIT 1
   ```

2. **Outbox**: Is deletion event in outbox queue?
   ```sql
   SELECT * FROM Outbox WHERE EventType = 'RideDeleted' AND ProcessedAt IS NULL
   ```

3. **Projections**: Has history view been updated?
   ```sql
   SELECT * FROM Rides WHERE Id = ? -- Should have DeletedAt set or row absent
   ```

4. **Totals**: Do aggregations exclude deleted ride?
   ```sql
   SELECT SUM(Distance) FROM Rides WHERE UserId = ? AND DeletedAt IS NULL
   ```

5. **Frontend State**: Check React Developer Tools for dialog state (`showDialog`, `selectedRideId`, `isDeleting`, `deleteError`)

6. **Network**: Check browser DevTools Network tab for DELETE request status and response body

7. **Authorization Token**: Verify token in sessionStorage; check `user_id` claim matches ride owner

---

## Related Features

- **Feature 005**: History page (delete button anchor)
- **Feature 006**: Edit rides (projection refresh pattern reused)
- **Feature 002-003**: Authentication & login (auth token source)

---

## Success Metrics

After rollout, measure:
- **Adoption**: % of riders who use delete feature (at least 5% expected)
- **Error Rate**: < 1% of delete requests result in 5xx errors
- **Support**: Support tickets related to "accidental rides" / "wrong entries" decrease by 30%+
- **Performance**: Delete API response time < 500ms at p95; total time including UI update < 2 seconds
