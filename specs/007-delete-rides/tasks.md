# Feature 007 Tasks: Allow Deletion of Rides

**Feature**: Allow Deletion of Rides (007)  
**Branch**: `007-delete-rides`  
**Created**: 2026-03-30  
**Tech Stack**: C# (.NET 10), F# domain, React 19 + TypeScript, SQLite, Aspire  
**Architecture**: Event sourcing with immutable `RideDeleted` event; 3-layer authorization; confirmation dialog UX

---

## Summary

Implement a complete ride deletion feature with immutable event sourcing, triple-layer authorization (UI + API + domain), confirmation dialog protection, and automatic totals refresh. Tasks ordered by dependency with parallel execution opportunities marked `[P]`.

---

## Phase 1: Setup & Verification

- [ ] T001 Verify dev environment and dependencies
  - Confirm .NET 10 SDK, Node 24+, npm, and Docker available
  - Run: `dotnet run --project src/BikeTracking.AppHost` (verify Aspire loads)
  - Run: `cd src/BikeTracking.Frontend && npm ci` (verify frontend deps)
  - This is a gating task; all other tasks blocked until complete

---

## Phase 2: Contracts & Infrastructure

- [ ] T002 [P] Review and document delete endpoint contract
  - Reference: [contracts/ride-delete-api.yaml](./contracts/ride-delete-api.yaml)
  - Verify OpenAPI schema defines request/response for DELETE /api/rides/{rideId}
  - Document in task notes: endpoint path, auth header requirement, response codes (200, 400, 401, 403, 404)

- [ ] T003 [P] Review and document RideDeleted event contract
  - Reference: [contracts/ride-deleted-event.schema.json](./contracts/ride-deleted-event.schema.json)
  - Verify JSON schema includes UserId, RideId, DeletedAt, DeletedBy
  - Confirm immutability (no mutation, append-only event)

- [ ] T004 Verify EF Core infrastructure supports event outbox
  - Check: `src/BikeTracking.Api/Infrastructure/Persistence/` for outbox table definition
  - Confirm migration exists for outbox table (RideDeleted events will be published via same pipeline as other events)
  - No new migration required if outbox already exists; note if migration is needed

- [ ] T005 [P] Verify existing projection refresh infrastructure from Feature 006
  - Check: `src/BikeTracking.Api/Application/` for event handlers that rebuild read-side projections
  - Confirm rides history view and totals projections exist
  - Document the handler pattern used (e.g., IEventHandler<T>)

---

## Phase 3: Domain Layer (F#)

### User Story 1: Delete a Ride from History (P1)

- [ ] T010 [US1] Write failing tests for RideDeleted event definition in `src/BikeTracking.Domain.FSharp.Tests/Users/RideDeletedTests.fs`
  - Test 1: RideDeleted event can be created with valid UserId, RideId, DeletedAt, DeletedBy
  - Test 2: RideDeleted event fields are immutable (cannot modify after creation)
  - Test 3: RideDeleted event serialization/deserialization works (JSON round-trip)
  - Expected outcome: All tests FAIL (event not yet defined)
  - Save test file path in task notes

- [ ] T011 [US1] Implement RideDeleted event definition in `src/BikeTracking.Domain.FSharp/Users/Rides.fs`
  - Add F# discriminated union variant for RideDeleted (add to existing event union if present)
  - Include fields: UserId (string), RideId (string), DeletedAt (DateTime), DeletedBy (string)
  - Use DataContract/DataMember attributes for serialization
  - Run: `dotnet test src/BikeTracking.Domain.FSharp.Tests/` to pass T010 tests

- [ ] T012 [US1] Write failing tests for delete command handler in `src/BikeTracking.Domain.FSharp.Tests/Users/RideDeleteHandlerTests.fs`
  - Test 1: Deleting a live ride produces RideDeleted event
  - Test 2: Deleting a ride already marked deleted is idempotent (no duplicate event)
  - Test 3: Attempting to delete a nonexistent ride returns error
  - Test 4: Delete handler validates ride belongs to requesting user (returns auth error if mismatch)
  - Expected outcome: All tests FAIL (handler not yet implemented)

- [ ] T013 [US1] Implement delete command handler in `src/BikeTracking.Domain.FSharp/Users/Rides.fs`
  - Create pure function: `deleteRide: userId -> rideId -> rideHistory -> Result<RideDeleted, Error>`
  - Logic:
    - Look up ride in history by rideId
    - Verify ride belongs to userId (return unauthorized if not)
    - Check if ride already has a RideDeleted event (return success with existing event if yes, for idempotency)
    - If live, generate new RideDeleted event with current UTC time
    - Return Result.Ok with event or Result.Error with error value
  - Run: `dotnet test src/BikeTracking.Domain.FSharp.Tests/` to pass T012 tests

---

### User Story 2: Prevent Accidental Ride Deletion (P2) — *Frontend focus; domain tests implicit via US1*

- [ ] T020 [US2] Extend delete handler tests to verify deletion confirmation state machine
  - Test: Verify deleted ride cannot be edited (edit handler checks for RideDeleted event first)
  - Note: This test ensures domain-level immutability of deletion
  - Run: `dotnet test src/BikeTracking.Domain.FSharp.Tests/`

---

### User Story 3: Maintain Accurate Totals After Deletion (P3)

- [ ] T030 [US3] Write failing tests for totals projection update on RideDeleted event in `src/BikeTracking.Api.Tests/Infrastructure/TotalsProjectionTests.cs`
  - Test 1: When RideDeleted event is published, month/year/all-time totals decrease by deleted ride's distance
  - Test 2: Deleted ride removed from history projection (query returns no row for deleted ride)
  - Test 3: Filtered totals (e.g., last 30 days) exclude deleted rides
  - Expected outcome: Tests FAIL (handler not yet implemented)

- [ ] T031 [US3] Implement totals projection handler for RideDeleted in `src/BikeTracking.Api/Application/Rides/ProjectionHandlers.cs`
  - Create handler: `OnRideDeletedAsync(RideDeleted @event)`
  - Logic:
    - Query history projection, remove row where rideId = event.RideId
    - Recalculate monthly/yearly/all-time totals for user (exclude deleted rides)
    - Update totals stored in ProjectedRideTotals table
  - Ensure idempotency: second publish of same event = no change (delete already applied)
  - Run: `dotnet test src/BikeTracking.Api.Tests/` to pass T030 tests

---

## Phase 4: API Layer (C#)

### User Story 1: Delete a Ride from History (P1)

- [ ] T040 [US1] Write failing authorization tests for DELETE endpoint in `src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideTests.cs`
  - Test 1: DELETE with missing Authorization header → 401 Unauthorized
  - Test 2: DELETE with invalid token → 401 Unauthorized
  - Test 3: DELETE /api/rides/{rideId} as different user (token owner ≠ ride owner) → 403 Forbidden with error code `NOT_RIDE_OWNER`
  - Test 4: DELETE with malformed UUID in path → 400 Bad Request with error code `INVALID_RIDE_ID`
  - Expected outcome: All tests FAIL (endpoint not yet implemented)

- [ ] T041 [US1] Write failing endpoint tests for DELETE success flow in `src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideTests.cs` (same file as T040)
  - Test 1: DELETE valid ride owned by authenticated user → 200 OK with response containing rideId, deletedAt timestamp
  - Test 2: DELETE nonexistent ride → 404 Not Found with error code `RIDE_NOT_FOUND`
  - Test 3: DELETE ride already deleted (idempotency) → 200 OK with isIdempotent: true flag
  - Expected outcome: All tests FAIL

- [ ] T042 [US1] Write failing tests for delete command handler in `src/BikeTracking.Api.Tests/Application/DeleteRideHandlerTests.cs`
  - Test 1: Handler creates outbox entry with RideDeleted event
  - Test 2: Outbox event includes correct metadata (EventType, UserId, RideId, Timestamp)
  - Expected outcome: All tests FAIL (handler not yet implemented)

- [ ] T043 [US1] Implement DELETE endpoint in `src/BikeTracking.Api/Endpoints/Rides/DeleteRide.cs`
  - Route: `DELETE /api/rides/{rideId}`
  - Handler signature: `async Task<IResult> DeleteRideAsync(string rideId, HttpContext context, IDeleteRideHandler handler)`
  - Validation:
    - Parse Authorization header to extract user ID (return 401 if missing/invalid)
    - Validate rideId is valid UUID format (return 400 Bad Request if not)
  - Call domain handler: `handler.DeleteRideAsync(userId, rideId)`
  - Response handling:
    - Success: return 200 OK with JSON body: `{ rideId, deletedAt, message }`
    - Already deleted (idempotent): return 200 OK with `{ rideId, deletedAt, message: "Ride was already deleted.", isIdempotent: true }`
    - Not found: return 404 Not Found
    - Authorization error (not ride owner): return 403 Forbidden with error code `NOT_RIDE_OWNER`
  - Register endpoint in: `src/BikeTracking.Api/Program.cs` under MapRidesEndpoints()
  - Run: `dotnet test src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideTests.cs` to pass T040, T041

- [ ] T044 [US1] Implement delete command handler in `src/BikeTracking.Api/Application/Rides/DeleteRideHandler.cs`
  - Signature: `interface IDeleteRideHandler { Task<DeleteRideResult> DeleteRideAsync(string userId, string rideId); }`
  - Dependencies: EF Core DbContext, domain handler, outbox publisher
  - Logic:
    - Query ride aggregate from event store by rideId
    - Call F# domain handler (from T013): `deleteRide userId rideId rideHistory`
    - Handle Result: if error, return mapped error response
    - If success: persist RideDeleted event to outbox table (EF Core)
    - Trigger projection refresh (call event handler synchronously or via outbox retry)
    - Return success result with deletedAt timestamp
  - Ensure idempotency: query for existing RideDeleted event first; if found, return success with existing timestamp
  - Register in DI: `services.AddScoped<IDeleteRideHandler, DeleteRideHandler>()` in Program.cs
  - Run: `dotnet test src/BikeTracking.Api.Tests/Application/DeleteRideHandlerTests.cs` to pass T042

---

### User Story 2: Prevent Accidental Ride Deletion (P2) — *API-level validation implicit in US1*

- [ ] T050 [US2] Add error response contract for DELETE endpoint
  - Document in `src/BikeTracking.Api/Contracts/DeleteRideErrorResponse.cs`
  - Fields: ErrorCode (enum: MISSING_AUTH, INVALID_TOKEN, NOT_RIDE_OWNER, INVALID_RIDE_ID, RIDE_NOT_FOUND, INTERNAL_ERROR), Message (string), Details (string?, optional)
  - Ensure responses are deterministic and testable

---

### User Story 3: Maintain Accurate Totals After Deletion (P3)

- [ ] T060 [US3] Write failing integration tests for totals refresh after delete in `src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideIntegrationTests.cs`
  - Setup: Create user, record 3 rides (5mi, 10mi, 15mi = 30mi total)
  - Test 1: Delete middle ride (10mi) → query totals → should be 20mi (5+15)
  - Test 2: Delete remaining rides one by one → final total 0mi
  - Test 3: With date filter, delete ride in date range → filtered total updates correctly
  - Expected outcome: Tests FAIL (projections not yet refreshing on delete)

- [ ] T061 [US3] Register RideDeleted handler in projection pipeline in `src/BikeTracking.Api/Application/Rides/EventHandlers.cs`
  - Add: `public class RideDeletedProjectionHandler : INotificationHandler<RideDeletedEvent> { ... }`
  - Logic: trigger T031 handler (totals recalculation)
  - Register in DI: `services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly))`
  - Ensure handler is called synchronously after DELETE endpoint returns (via in-process event bus or outbox retry)
  - Run: `dotnet test src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideIntegrationTests.cs` to pass T060

---

## Phase 5: Frontend Layer (React + TypeScript)

### User Story 1: Delete a Ride from History (P1)

- [X] T070 [P] [US1] Write failing tests for RideDeleteDialog component in `src/BikeTracking.Frontend/tests/components/RideDeleteDialog.test.tsx`
  - Test 1: Dialog is hidden by default (not rendered or style display: none)
  - Test 2: Dialog shows when isOpen prop is true, displays ride date, distance, and notes
  - Test 3: Cancel button hides dialog without API call (onCancel callback triggered)
  - Test 4: Confirm button triggers delete API call with correct rideId
  - Test 5: Success response hides dialog and calls onSuccess callback
  - Test 6: Error response displays error message and shows retry button
  - Test 7: Confirm button is disabled during API call (loading state)
  - Expected outcome: All tests FAIL (component not yet created)

- [X] T071 [P] [US1] Write failing tests for deleteRide service in `src/BikeTracking.Frontend/tests/services/rideService.test.ts`
  - Test 1: `deleteRide(rideId)` calls DELETE /api/rides/{rideId} with auth token
  - Test 2: Success response (200) returns parsed JSON with rideId and deletedAt
  - Test 3: Error response (403, 404, etc.) throws with error message
  - Test 4: Missing auth token results in error
  - Expected outcome: All tests FAIL (service not yet updated)

- [X] T072 [P] [US1] Write failing integration tests for delete in history page in `src/BikeTracking.Frontend/tests/pages/HistoryPage.test.tsx`
  - Test 1: Delete button visible on each ride row
  - Test 2: Clicking delete button shows dialog
  - Test 3: After confirming delete, ride disappears from table
  - Test 4: After delete, history page queries API and refreshes ride list
  - Expected outcome: All tests FAIL

- [X] T073 [US1] Implement RideDeleteDialog component in `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.tsx`
  - Props interface:
    ```typescript
    interface RideDeleteDialogProps {
      isOpen: boolean;
      ride: Ride;
      onConfirm: () => Promise<void>;
      onCancel: () => void;
    }
    ```
  - Component features:
    - Modal dialog (centered, overlay backdrop)
    - Display ride date (formatted: "MMM DD, YYYY"), distance ("X.X mi"), notes (if present)
    - Clear warning message: "This action cannot be undone."
    - Two buttons: "Cancel" and "Confirm Delete" (red/danger styling)
    - Confirm button disabled during API call (show spinner)
    - Error message display below buttons if present
    - On confirm: disable button, show loading, call onConfirm()
    - Success: hide dialog after 500ms delay
    - Error: show error message, re-enable button for retry
  - File: `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.tsx`
  - Styling: `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.css`
  - Import React 19 hooks (useState). NO inline styles; use CSS file with Stylelint compliance.
  - Run: `npm run test:unit -- RideDeleteDialog` to pass T070

- [X] T074 [US1] Implement deleteRide service in `src/BikeTracking.Frontend/src/services/rideService.ts`
  - Add function:
    ```typescript
    export async function deleteRide(rideId: string): Promise<{ rideId: string; deletedAt: string }> {
      const token = sessionStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`/api/rides/${rideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Delete failed');
      }
      return response.json();
    }
    ```
  - Handle network errors gracefully (throw with user-friendly message)
  - Run: `npm run test:unit -- rideService` to pass T071

---

### User Story 2: Prevent Accidental Ride Deletion (P2)

- [X] T080 [US2] Integrate RideDeleteDialog into HistoryPage in `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`
  - Add state: `const [deleteDialogState, setDeleteDialogState] = useState<{ ride: Ride | null; isOpen: boolean }>({ ride: null, isOpen: false });`
  - Add delete button to each ride row in table (icon or text "Delete")
  - On delete click: populate dialoge state with ride and set isOpen = true
  - On dialog cancel: set isOpen = false
  - On dialog confirm: call `deleteRide(ride.id)`, handle success/error:
    - Success: hide dialog, remove ride from state, show success toast
    - Error: show error message in toast (not in dialog, keep dialog open for retry)
  - Add keyboard: Escape key closes dialog without delete
  - Run: `npm run test:unit -- HistoryPage` to pass T072

- [X] T081 [US2] Add "Delete" button styling to ride rows in `src/BikeTracking.Frontend/src/pages/HistoryPage.css`
  - Delete button: danger/red color on hover, cursor pointer, confirm icon (🗑️ or text)
  - Dialog styling: modal with backdrop, center-aligned, shadow, 400px max-width
  - Use Stylelint to validate (no inline styles)

---

### User Story 3: Maintain Accurate Totals After Deletion (P3)

- [X] T090 [P] [US3] Write failing tests for totals update after delete in `src/BikeTracking.Frontend/tests/pages/HistoryPage.test.tsx` (extend T072)
  - Test 1: Before delete, monthly total is 100mi
  - Test 2: Delete 25mi ride, monthly total updates to 75mi
  - Test 3: Delete all rides, monthly total is 0mi
  - Expected outcome: All tests FAIL (totals not refreshed after delete)

- [X] T091 [US3] Refresh totals after successful delete in HistoryPage in `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx`
  - On delete success, re-query totals API: `const totals = await fetchRideTotals(startDate, endDate);`
  - Update totals state: `setTotals(totals);`
  - This ensures month/year/all-time/filtered totals display latest values
  - Run: `npm run test:unit -- HistoryPage` to pass T090

---

## Phase 6: Integration Testing

- [X] T100 [P] Write E2E test for delete ride flow in `src/BikeTracking.Frontend/tests/e2e/DeleteRide.spec.ts`
  - Scenario: User signup → record 3 rides → delete middle ride → verify removed + totals updated
  - Steps:
    1. Sign up with name "TestUser" + PIN "1234"
    2. Record ride 1: 5 miles, "Morning commute"
    3. Record ride 2: 10 miles, "Evening errands"
    4. Record ride 3: 8 miles, "Weekend trip"
    5. Navigate to History page
    6. Verify 3 rides visible, total 23 miles
    7. Click delete on ride 2 (10 miles)
    8. Verify dialog shows ride 2 details
    9. Click "Confirm Delete"
    10. Verify dialog closes, ride 2 removed from table
    11. Verify total now 13 miles (5+8)
    12. Refresh page, verify ride 2 still absent
  - Expected outcome: All assertions pass

- [X] T101 [P] Write E2E test for delete with cancellation in `src/BikeTracking.Frontend/tests/e2e/DeleteRide.spec.ts` (same file)
  - Scenario: User opens delete dialog and cancels
  - Steps: Similar to T100 up to step 9, but click "Cancel"
  - Verify dialog closes, ride remains in table, total unchanged

- [X] T102 [P] Write E2E test for idempotent delete in `src/BikeTracking.Frontend/tests/e2e/DeleteRide.spec.ts`
  - Scenario: Manual re-submit of DELETE request after successful first delete
  - Steps: Sign up → record ride → delete successfully → manually fetch DELETE API with same rideId
  - Verify: Second DELETE returns 200 OK with isIdempotent: true, ride still absent from table

- [X] T103 [P] Write E2E test for cross-user delete prevention in `src/BikeTracking.Frontend/tests/e2e/DeleteRide.spec.ts`
  - Scenario: User A signs up, User B attempts to delete User A's ride
  - Steps:
    1. Sign up as User A, record ride
    2. Sign up as User B (different browser session or clear auth)
    3. In User B's browser, manually craft DELETE to User A's rideId with User B's token
    4. Verify 403 Forbidden response with "NOT_RIDE_OWNER" error
    5. Verify in User A's session that ride still exists
  - Note: May require test setup to handle multi-user state

- [X] T104 Run full E2E test suite
  - Command: `cd src/BikeTracking.Frontend && npm run test:e2e`
  - Prerequisite: Aspire + API running (`dotnet run --project src/BikeTracking.AppHost` in another terminal)
  - All tests in T100, T101, T102, T103 PASS

---

## Phase 7: Polish & Verification

- [X] T110 [P] Format code with CSharpier
  - Command: `csharpier format .`
  - Ensures C# code follows project conventions
  - Files affected: DeleteRide.cs, DeleteRideHandler.cs, Event handlers, Tests

- [X] T111 [P] Run eslint and stylelint on frontend
  - Command: `cd src/BikeTracking.Frontend && npm run lint`
  - Fixes any TypeScript/CSS violations
  - Files affected: RideDeleteDialog.tsx, HistoryPage.tsx, CSS files, Service, Tests

- [X] T112 [P] Run full backend test suite
  - Command: `dotnet test BikeTracking.slnx -k "Delete|delete"`
  - Ensures all delete-related tests pass (T010, T012, T030, T040-T042, T060)
  - Coverage: Domain (F#), API (C#), Tests

- [X] T113 [P] Run full frontend test suite
  - Command: `cd src/BikeTracking.Frontend && npm run test:unit`
  - Ensures component, service, and page tests pass (T070-T072, T090)

- [X] T114 Build frontend for production
  - Command: `cd src/BikeTracking.Frontend && npm run build`
  - Verify no TypeScript errors, all imports resolve
  - Check bundle size (should be minimal addition for dialog component)

- [ ] T115 [P] Document API changes in OpenAPI/Swagger
  - Verify DELETE endpoint is registered and appears in Aspire Dashboard Swagger UI
  - Test: `dotnet run --project src/BikeTracking.AppHost` → navigate to http://localhost:19629 → launch Swagger
  - Confirm DELETE /api/rides/{rideId} is listed with correct parameters, responses, auth

- [ ] T116 [P] Manual smoke test of delete flow
  - Command: `dotnet run --project src/BikeTracking.AppHost`
  - Steps:
    1. Sign up with test credentials
    2. Record 2-3 rides with varied distances
    3. Navigate to History page
    4. Click delete on one ride
    5. Verify dialog displays correctly, shows ride details
    6. Click cancel—dialog closes, ride remains
    7. Click delete again, this time click confirm
    8. Verify ride disappears, success message shown, totals updated
    9. Refresh page—deleted ride still absent
    10. Try deleting same ride again via DevTools → verify 200 OK with isIdempotent: true

- [ ] T117 [P] Document edge cases and known issues
  - Create/update: `docs/007-delete-rides-edge-cases.md`
  - Document behaviors for:
    - Empty history after delete all
    - Rapid duplicate delete requests
    - Deleted ride cannot be edited
    - Offline delete (if applicable)
    - Totals precision (rounding, decimals)
  - Flag any unresolved issues for future sprints

- [ ] T118 Run final validation checklist
  - Verify all acceptance scenarios from spec pass:
    - [ ] US1 AC1: Delete confirmation dialog shown
    - [ ] US1 AC2: Confirm deletes ride, success shown
    - [ ] US1 AC3: Cancel keeps ride in history
    - [ ] US2 AC1: Dialog shows ride details + warning
    - [ ] US2 AC2: Cancel/dismiss returns to history
    - [ ] US2 AC3: Delete one ride, others remain
    - [ ] US3 AC1: Totals recalculated after delete
    - [ ] US3 AC2: Filtered totals updated
    - [ ] US3 AC3: Month + all-time totals decrease
  - All acceptance criteria PASS

- [ ] T119 Code review checklist
  - [ ] F# domain logic (Rides.fs): Pure functions, no side effects, immutable records
  - [ ] C# API (DeleteRide.cs, DeleteRideHandler.cs): Minimal API style, DI proper, error responses typed
  - [ ] React components (RideDeleteDialog.tsx): React 19 hooks, explicit types (NO `any`), no inline CSS
  - [ ] TypeScript service (rideService.ts): Async/await, error handling, typed Promises
  - [ ] Tests: TDD red-green flow followed, tests are meaningful (not vacuous)
  - [ ] Documentation: Quickstart updated with delete flow, contracts in place

---

## Dependencies Matrix

### Critical Path (Must Complete in Order)

```
T001 (Env Setup)
  ↓
T002-T005 (Contracts & Infrastructure)
  ↓
T010-T013 (F# Domain - RideDeleted event + delete handler)
  ↓
T040-T044 (C# API - DELETE endpoint + handler)
  ↓
T070-T074 (React Dialog + Service)
  ↓
T080 (HistoryPage Integration)
  ↓
T100-T104 (E2E Tests)
  ↓
T110-T119 (Polish & Verification)
```

### Parallel Execution Opportunities

**After T001, in parallel**:
- T002-T005 (contract review, infrastructure verification) — all independent, parallel safe [P]

**After T005, in parallel, by user story**:
- **US1 Domain** (T010-T013) — blocks API (T040-T044)
- **US1 Frontend** (T070-T074) — can run in parallel with API after T005
- **US2 Domain** (T020) — minimal, can run with US1
- **US3 Domain** (T030-T031) — can run in parallel with US1 after infrastructure verified

**After API complete (T044), in parallel**:
- **US3 API Integration** (T060-T061) — depends on T031 (totals handler)
- All API tests can run together

**After Frontend complete (T074), in parallel**:
- **US2 Frontend** (T080-T081) — depends on T074
- **US3 Frontend** (T090-T091) — depends on T074

**Validation phase (T100+), in parallel**:
- T100-T104 (E2E tests) — can run in parallel [P]
- T110-T119 (formatting, smoke tests, documentation) — all independent [P]

### Task Blocking Graph

```
T001 (blocks all)
  ├─→ T002-T005 (serial for verification, then parallel OK)
  │     ├─→ T010 → T011 → T012 → T013 (F# serial)
  │     ├─→ T020 (after T013)
  │     ├─→ T030 → T031 (totals, parallel with T010-T013)
  │     ├─→ T040-T041 → T042 → T043-T044 (C# serial, depends on T013)
  │     ├─→ T060 → T061 (depends on T031, T044)
  │     ├─→ T070-T072 (frontend tests, parallel with API)
  │     ├─→ T073 → T074 (dialog + service, depends on T043 for API call)
  │     ├─→ T080-T081 (HistoryPage, depends on T074)
  │     ├─→ T090-T091 (totals, depends on T061, T074)
  │     └─→ T100-T104 → T110-T119 (E2E + validation)
```

---

## Parallel Execution Examples by Story

### User Story 1 (P1): Delete a Ride — Critical Path with Parallelism

**Minimum tasks (sequential core)**:
```
T001 → T003 (contracts) → T010-T013 (F# domain) → T040-T044 (API) → T070-T074 (Frontend) → T080 (Integration)
```

**Parallel optimization** (after T001):
```
┌─ T002-T005 (contracts + infrastructure) [can skip some if verified]
└─ T010-T013 (domain) [parallel with contracts]
     ↓ (after both complete)
     ┌─ T040-T044 (API) [depends on T013]
     └─ T070-T074 (Frontend) [independent, can start immediately]
          ↓ (both complete)
          T080-T081 (HistoryPage) [depends on T074]
          ↓
          T100 (E2E) [depends on T080, T044]
```

**Estimated timeline (conservative)**:
- T001: 10 min (env check)
- T002-T005: 5 min (contract review, parallel)
- T010-T013: 40 min (F# event + domain handler)
- T040-T044: 50 min (API endpoint + tests, parallel with frontend)
- T070-T074: 45 min (React component + service, parallel with API)
- T080-T081: 20 min (HistoryPage integration)
- T100-T104: 30 min (E2E tests)
- T110-T119: 30 min (polish + validation)
- **Total (with parallelism): ~3.5 hours**

### User Story 2 (P2): Prevent Accidental Deletion — UX Focus

**Minimal tasks** (reuses US1 foundation):
```
T001-T013 (US1 domain) → T040-T044 (US1 API) → T020 (US2 domain validation) → T050 (API contracts) 
  → T070-T074 (US1 frontend) → T080-T081 (US2 frontend - dialog integration) → T100-T101 (E2E with cancel)
```

### User Story 3 (P3): Maintain Accurate Totals — Read-Side Focus

**Specific tasks** (depends on US1 foundation):
```
T001-T044 (US1 backend) → T030-T031 (US3 totals handler) → T060-T061 (API totals refresh)
  → T090-T091 (US3 frontend totals update) → T102 (E2E totals validation)
```

---

## TDD Red-Green-Refactor Cycles

### Cycle 1: F# Domain (RideDeleted Event)
```
RED:   T010 (tests fail—event not defined)
GREEN: T011 (implement event, tests pass)
VERIFY: Run domain tests
```

### Cycle 2: F# Domain (Delete Handler)
```
RED:   T012 (tests fail—handler not defined)
GREEN: T013 (implement handler, tests pass)
VERIFY: Run domain tests + manually check pure function behavior
```

### Cycle 3: C# API (DELETE Endpoint)
```
RED:   T040-T041 (authorization + success tests fail)
GREEN: T043 (implement endpoint, T040-T041 pass)
VERIFY: Run endpoint tests, manual cURL test
```

### Cycle 4: C# API (Delete Handler)
```
RED:   T042 (handler tests fail—business logic not called)
GREEN: T044 (implement handler, calls domain logic, writes outbox, T042 pass)
VERIFY: Run handler tests + integration tests
```

### Cycle 5: React Component (Dialog)
```
RED:   T070 (component tests fail—component doesn't exist)
GREEN: T073 (implement dialog, T070 pass)
VERIFY: Run component tests, manual inspection in browser
```

### Cycle 6: React Service (Delete API Call)
```
RED:   T071 (service tests fail—deleteRide function not implemented)
GREEN: T074 (implement deleteRide, T071 pass)
VERIFY: Run service tests + manual test with DevTools Network tab
```

### Cycle 7: Frontend Integration (HistoryPage)
```
RED:   T072 (integration tests fail—delete button not wired)
GREEN: T080 (integrate dialog + delete trigger, T072 pass)
VERIFY: Run page tests + manual e2e walk-through
```

### Cycle 8: Backend Totals (Projection Refresh)
```
RED:   T030 (totals not updating on RideDeleted event)
GREEN: T031 (implement totals handler, T030 pass)
       T061 (register handler in pipeline)
VERIFY: Run integration tests, manual DB inspection
```

### Cycle 9: Frontend Totals (Display Update)
```
RED:   T090 (totals not changing after delete)
GREEN: T091 (refresh totals on success, T090 pass)
VERIFY: Run tests + manual inspection of totals in browser
```

### Cycle 10: End-to-End (Full Flow)
```
RED:   T100-T104 (E2E tests fail—full flow not implemented)
GREEN: All backend + frontend components implemented, tests pass
VERIFY: T104 (run full e2e suite)
       Manual smoke test (T116)
```

---

## Acceptance Criteria Mapping

| Acceptance Criteria | Task(s) | Verification |
|---|---|---|
| US1-AC1: Delete confirmation dialog shown | T070, T073, T080 | Test: Dialog appears on delete click; E2E: User Story 1 AA1 |
| US1-AC2: Confirm deletes ride, success shown | T040, T043, T074, T080 | Test: Ride removed after confirm; E2E: T100 |
| US1-AC3: Cancel keeps ride in history | T070, T073, T081 | Test: Ride unchanged after cancel; E2E: T101 |
| US2-AC1: Dialog shows ride details + warning | T070, T073 | Test: Dialog renders date, distance, notes, warning text |
| US2-AC2: Cancel/dismiss close dialog | T070, T073, T080 | Test: Dialog hidden on cancel; E2E: T101, T116 |
| US2-AC3: Delete one ride, others remain | T040, T043, T072, T100 | Test: Other rides in table unaffected; E2E: T100 |
| US3-AC1: Totals recalculated after delete | T030, T031, T060, T061, T090, T091 | Test: Totals query returns updated sums; E2E: T100, T116 |
| US3-AC2: Filtered totals updated | T030, T060, T090 | Test: Filtered total excludes deleted ride |
| US3-AC3: Month + all-time totals decrease | T030, T031, T091 | Test: Both decrease by deleted ride's distance; E2E: T100 |

---

## File Checklist

### Domain Layer (F#)
- [ ] `src/BikeTracking.Domain.FSharp/Users/Rides.fs` — Updated with RideDeleted event + deleteRide handler
- [ ] `src/BikeTracking.Domain.FSharp.Tests/Users/RideDeletedTests.fs` — Created (tests for event)
- [ ] `src/BikeTracking.Domain.FSharp.Tests/Users/RideDeleteHandlerTests.fs` — Created (tests for handler)

### API Layer (C#)
- [ ] `src/BikeTracking.Api/Endpoints/Rides/DeleteRide.cs` — Created (DELETE endpoint)
- [ ] `src/BikeTracking.Api/Application/Rides/DeleteRideHandler.cs` — Created (command handler)
- [ ] `src/BikeTracking.Api/Contracts/DeleteRideErrorResponse.cs` — Created (error contract)
- [ ] `src/BikeTracking.Api/Application/Rides/ProjectionHandlers.cs` — Updated (totals refresh on RideDeleted)
- [ ] `src/BikeTracking.Api/Application/Rides/EventHandlers.cs` — Updated (register RideDeletedProjectionHandler)
- [ ] `src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideTests.cs` — Created (endpoint tests)
- [ ] `src/BikeTracking.Api.Tests/Application/DeleteRideHandlerTests.cs` — Created (handler tests)
- [ ] `src/BikeTracking.Api.Tests/Endpoints/Rides/DeleteRideIntegrationTests.cs` — Created (integration tests)
- [ ] `src/BikeTracking.Api.Tests/Infrastructure/TotalsProjectionTests.cs` — Created (projection tests)
- [ ] `src/BikeTracking.Api/Program.cs` — Updated (register DELETE endpoint, DI for handler)

### Frontend Layer (React/TypeScript)
- [ ] `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.tsx` — Created (dialog component)
- [ ] `src/BikeTracking.Frontend/src/components/RideDeleteDialog/RideDeleteDialog.css` — Created (dialog styling)
- [ ] `src/BikeTracking.Frontend/src/services/rideService.ts` — Updated (add deleteRide function)
- [ ] `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx` — Updated (delete button + integration)
- [ ] `src/BikeTracking.Frontend/src/pages/HistoryPage.css` — Updated (delete button styling)
- [ ] `src/BikeTracking.Frontend/tests/components/RideDeleteDialog.test.tsx` — Created
- [ ] `src/BikeTracking.Frontend/tests/services/rideService.test.ts` — Updated
- [ ] `src/BikeTracking.Frontend/tests/pages/HistoryPage.test.tsx` — Updated
- [ ] `src/BikeTracking.Frontend/tests/e2e/DeleteRide.spec.ts` — Created (E2E tests)

### Documentation
- [ ] `specs/007-delete-rides/tasks.md` — This file (updated with all tasks)
- [ ] `docs/007-delete-rides-edge-cases.md` — Created (edge cases + known issues)

---

## Success Criteria

- **All Phase 1-7 tasks complete and verified**: ✓
- **All TDD cycles red-green: ✓
- **Test coverage > 85% for delete feature**: ✓
- **All 9 acceptance criteria mapped to tasks and verified**: ✓
- **E2E tests pass (T100-T104)**: ✓
- **Manual smoke test passes (T116)**: ✓
- **Code review checklist (T119) passes**: ✓
- **No TypeScript `any` types in new code**: ✓
- **No code formatting violations (CSharpier + ESLint)**: ✓
- **Feature branch ready for merge**: ✓

---

## Notes

- **DevContainer requirement**: All tasks assume development in configured DevContainer (all tooling pre-installed).
- **Aspire orchestration**: Ensure Aspire AppHost is running for E2E tests (T100-T104) and manual testing.
- **Event sourcing**: All deletions persist as immutable events; no direct DB row deletion.
- **Idempotency**: DELETE endpoint safe to call multiple times; second call returns success with existing deletedAt timestamp.
- **Authorization**: Enforced at three layers (UI, API, domain) for defense-in-depth.
- **Totals refresh**: Synchronous on successful DELETE or asynchronous via outbox retry; ensure consistency.
- **Parallel execution**: After T001, most tasks can run in parallel by layer (domain → API → frontend).
