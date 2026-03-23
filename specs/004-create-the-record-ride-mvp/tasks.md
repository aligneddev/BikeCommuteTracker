# Tasks: Record Ride Page MVP

**Feature Branch**: `004-create-the-record-ride-mvp`  
**Status**: Ready for Implementation  
**Test Approach**: TDD - All failing tests must run before implementation begins  
**Last Updated**: 2026-03-23

---

## Overview

This tasks.md organizes the "Record Ride MVP" feature into five sequential phases with TDD discipline. Tasks marked **[P]** can run in parallel (different files); unmarked tasks must run sequentially on the same file.

**Key Principle**: Respect file-based dependencies. Tasks affecting the same file must run sequentially.

---

## PHASE 1: Setup - Project Structure & Contracts

Create foundational files, contracts, and folder structure. Verify no compilation errors.

### 1-1: Create Rides API Contracts File

**File**: [src/BikeTracking.Api/Contracts/RidesContracts.cs](src/BikeTracking.Api/Contracts/RidesContracts.cs) (new)

**Description**: Define all DTOs for ride record and defaults endpoints:
- `RecordRideRequest` (required: rideDateTimeLocal, miles; optional: rideMinutes, temperature)
- `RecordRideSuccessResponse` (rideId, riderId, savedAtUtc, eventStatus)
- `RideDefaultsResponse` (hasPreviousRide, defaultMiles, defaultRideMinutes, defaultTemperature, defaultRideDateTimeLocal)
- `ErrorResponse` (message, errors collection)

**Validation Rules** (embed in DTO):
- `miles` must be > 0 (use `[Range(0.01, double.MaxValue)]` or custom validator)
- `rideMinutes` nullable integer, > 0 when provided
- `temperature` nullable number
- `rideDateTimeLocal` required, valid date-time format

**Acceptance**: File compiles; DTOs match `record-ride-api.yaml` contract.

---

### 1-2: Create Rides Endpoints Skeleton File

**File**: [src/BikeTracking.Api/Endpoints/RidesEndpoints.cs](src/BikeTracking.Api/Endpoints/RidesEndpoints.cs) (new)

**Description**: Create empty endpoint registration methods:
- `MapRecordRideEndpoints(WebApplication app, IProvider provider)`
- `PostRecordRide(RecordRideRequest request)` - placeholder
- `GetRideDefaults()` - placeholder

**Acceptance**: File compiles; methods exist but contain no logic.

---

### **[P] 1-3: Create Application Services Folder Structure**

**Folder**: [src/BikeTracking.Api/Application/Rides/](src/BikeTracking.Api/Application/Rides/) (new)

**Description**: Create application services folder for rides business logic.

**Sub-tasks**:
- Create `RecordRideService.cs` (placeholder class)
- Create `GetRideDefaultsService.cs` (placeholder class)

**Acceptance**: Folder structure exists; classes compile.

---

### **[P] 1-4: Create Domain Event Payload Classes**

**File**: [src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs](src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs) (new)

**Description**: Define immutable event payload class matching `ride-recorded-event.schema.json`:
- `eventId` (string, guid)
- `eventType` (constant "RideRecorded")
- `occurredAtUtc` (date-time)
- `riderId` (integer)
- `rideDateTimeLocal` (date-time)
- `miles` (decimal/double)
- `rideMinutes` (nullable integer)
- `temperature` (nullable number)
- `source` (constant "BikeTracking.Api")

**Acceptance**: Class matches JSON schema; all required fields present.

---

### **[P] 1-5: Create Persistence Entity Classes**

**File**: [src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs](src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs) (new)

**Description**: Define EF Core entity for persisted rides:
- `Id` (int, primary key)
- `RiderId` (int, foreign key to user)
- `RideDateTimeLocal` (DateTime)
- `Miles` (decimal)
- `RideMinutes` (nullable int)
- `Temperature` (nullable decimal)
- `CreatedAtUtc` (DateTime)

**Acceptance**: Entity compiles; property types align with data model.

---

### 1-6: Verify Compilation

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet build src/BikeTracking.Api
```

**Expected Output**: No compilation errors.

**Acceptance**: Build succeeds.

---

## PHASE 2: Tests - Define Failing Tests (Red Phase)

Define all tests for the feature. Tests must fail before implementation. Confirm failure before moving to Phase 3.

### 2-1: Create Rides Endpoints Test File

**File**: [src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs](src/BikeTracking.Api.Tests/Endpoints/RidesEndpointsTests.cs) (new)

**Description**: Integration tests for ride endpoints (using test HttpClient):

**Test Cases** (each must fail initially):

1. **PostRecordRide_WithValidRequest_Returns201AndRideId**
   - POST `/api/rides` with valid RecordRideRequest
   - Assert response is 201 Created
   - Assert response contains rideId and savedAtUtc
   - Assert riderId matches authenticated user

2. **PostRecordRide_WithRequiredFieldsOnly_Returns201**
   - POST `/api/rides` with only rideDateTimeLocal and miles
   - Assert optional fields (rideMinutes, temperature) are null in persisted data
   - Assert response is 201

3. **PostRecordRide_WithInvalidMiles_Returns400**
   - POST `/api/rides` with miles <= 0
   - Assert response is 400
   - Assert error message reflects validation failure

4. **PostRecordRide_WithInvalidRideMinutes_Returns400**
   - POST `/api/rides` with rideMinutes <= 0
   - Assert response is 400

5. **PostRecordRide_WithoutAuth_Returns401**
   - POST `/api/rides` without authentication
   - Assert response is 401

6. **GetRideDefaults_WithoutPriorRides_ReturnsCurrentDateTime**
   - GET `/api/rides/defaults` for new rider with no prior rides
   - Assert hasPreviousRide is false
   - Assert defaultRideDateTimeLocal is approximately current time
   - Assert defaultMiles is null

7. **GetRideDefaults_WithPriorRides_ReturnsLastDefaults**
   - Record first ride (miles: 10.5, rideMinutes: 45, temperature: 72)
   - GET `/api/rides/defaults`
   - Assert hasPreviousRide is true
   - Assert defaultMiles is 10.5
   - Assert defaultRideMinutes is 45
   - Assert defaultTemperature is 72

8. **GetRideDefaults_WithoutAuth_Returns401**
   - GET `/api/rides/defaults` without authentication
   - Assert response is 401

**Acceptance**: All 8 tests exist, compile, and fail when run.

---

### 2-2: Create Application Services Test File

**File**: [src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs](src/BikeTracking.Api.Tests/Application/RidesApplicationServiceTests.cs) (new)

**Description**: Unit tests for record ride and defaults services (using mocked dependencies):

**Test Cases** (each must fail initially):

1. **RecordRideService_WithValidRequest_PersistsRideAndEvent**
   - Call RecordRideService.Execute(command)
   - Assert ride entity is created with correct fields
   - Assert RideRecordedEventPayload is created and queued in outbox
   - Assert transaction completes successfully

2. **RecordRideService_ValidatesMillesGreaterThanZero**
   - Call RecordRideService.Execute with miles = 0
   - Assert ValidationException or business exception is thrown

3. **RecordRideService_ValidatesRideMinutesGreaterThanZeroWhenProvided**
   - Call RecordRideService.Execute with rideMinutes = -1
   - Assert ValidationException is thrown

4. **GetRideDefaultsService_ReturnsDefaultsForNewRider**
   - Call GetRideDefaultsService.Execute(riderId) for rider with no prior rides
   - Assert hasPreviousRide is false
   - Assert defaultMiles is null
   - Assert defaultRideDateTimeLocal is current time (within 1 second)

5. **GetRideDefaultsService_ReturnsLastRideDefaults**
   - Seed database with prior ride record
   - Call GetRideDefaultsService.Execute(riderId)
   - Assert hasPreviousRide is true
   - Assert defaultMiles matches last ride miles
   - Assert defaultRideMinutes matches last ride minutes
   - Assert defaultTemperature matches last ride temperature

**Acceptance**: All 5 tests exist, compile, and fail when run.

---

### **[P] 2-3: Create Persistence Test File**

**File**: [src/BikeTracking.Api.Tests/Infrastructure/RidesPersistenceTests.cs](src/BikeTracking.Api.Tests/Infrastructure/RidesPersistenceTests.cs) (new)

**Description**: EF Core integration tests for ride persistence:

**Test Cases** (each must fail initially):

1. **DbContext_CanSaveRideEntity_WithAllFields**
   - Create RideEntity with all required and optional fields
   - Save to DbContext
   - Query back
   - Assert all fields match

2. **DbContext_EnforcesCheckConstraint_MilesGreaterThanZero**
   - Attempt to save RideEntity with miles = 0
   - Assert DbUpdateException or similar constraint violation

3. **DbContext_AllowsNullOptionalFields**
   - Save RideEntity with null rideMinutes and temperature
   - Query back
   - Assert optional fields are null

4. **DbContext_PersistsRideRecordedEventPayload_ToOutbox**
   - Create RideRecordedEventPayload
   - Save to outbox table via existing outbox persistence pattern
   - Query outbox
   - Assert payload is persisted as JSON

**Acceptance**: All 4 tests exist, compile, and fail when run.

---

### **[P] 2-4: Create Frontend Page Component Test File**

**File**: [src/BikeTracking.Frontend/tests/pages/RecordRidePage.test.tsx](src/BikeTracking.Frontend/tests/pages/RecordRidePage.test.tsx) (new)

**Description**: Unit tests for RecordRidePage component (using Vitest, React Testing Library):

**Test Cases** (each must fail initially):

1. **RecordRidePage_RenderFormFields_AllRequired**
   - Render RecordRidePage component
   - Assert date/time input is present
   - Assert miles input is present
   - Assert submit button is present

2. **RecordRidePage_DefaultsDateTimeToNow**
   - Render page
   - Assert date/time input value is approximately current time
   - Assert difference < 5 seconds

3. **RecordRidePage_FetchesAndDisplaysDefaults**
   - Mock getRideDefaults API call to return previous ride data
   - Render page
   - Assert miles input defaults to mocked value
   - Assert rideMinutes input defaults to mocked value
   - Assert temperature input defaults to mocked value

4. **RecordRidePage_ShowsValidationError_OnNegativeMiles**
   - Render page
   - Enter miles = -1
   - Click submit
   - Assert error message is displayed

5. **RecordRidePage_ShowsSuccessMessage_OnSuccessfulSubmit**
   - Render page with valid data
   - Mock POST /api/rides to return success
   - Fill form with valid values
   - Click submit
   - Assert success message is displayed

6. **RecordRidePage_PreservesFormValues_OnSubmitError**
   - Render page
   - Enter form data
   - Mock POST /api/rides to return error
   - Click submit
   - Assert form values are still populated (not cleared)
   - Assert error message is shown

**Acceptance**: All 6 tests exist, compile (TypeScript), and fail when run.

---

### **[P] 2-5: Create Frontend Rides API Service Test File**

**File**: [src/BikeTracking.Frontend/tests/services/ridesService.test.ts](src/BikeTracking.Frontend/tests/services/ridesService.test.ts) (new)

**Description**: Unit tests for ridesService (fetch/POST/GET logic):

**Test Cases** (each must fail initially):

1. **RidesService_PostRecordRide_SendsCorrectPayload**
   - Call recordRide(request) with valid RecordRideRequest
   - Assert POST /api/rides is called
   - Assert request body matches payload

2. **RidesService_PostRecordRide_Returns201Response**
   - Mock fetch to respond with 201
   - Call recordRide()
   - Assert response contains rideId and savedAtUtc

3. **RidesService_PostRecordRide_Throws_On400**
   - Mock fetch to respond with 400
   - Call recordRide()
   - Assert fetch error is thrown or rejection

4. **RidesService_GetRideDefaults_ReturnsDefaults**
   - Mock fetch GET /api/rides/defaults
   - Call getRideDefaults()
   - Assert response matches RideDefaultsResponse shape

**Acceptance**: All 4 tests exist, compile, and fail when run.

---

### 2-6: Run All Tests and Confirm Failure

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet test --verbosity=normal 2>&1 | grep -E "(FAILED|PASSED|Test Run)"
cd src/BikeTracking.Frontend
npm run test:unit 2>&1 | grep -E "(FAIL|PASS|Test Files)"
```

**Expected Output**: All new tests FAILED (not skipped).

**Acceptance**: User confirms: "All Phase 2 tests fail as expected. Ready for Phase 3 implementation."

---

## PHASE 3: Core - Backend Implementation

Implement backend services, persistence, and endpoints to turn failing tests green.

### 3-1: Implement Rides Contracts with Validation

**File**: [src/BikeTracking.Api/Contracts/RidesContracts.cs](src/BikeTracking.Api/Contracts/RidesContracts.cs)

**Description**: Implement all DTOs with validation attributes:

- `RecordRideRequest`
  - Add `[Required]` to rideDateTimeLocal
  - Add `[Required]` to miles
  - Add `[Range(0.01, double.MaxValue)]` to miles
  - Add optional rideMinutes with `[Range(1, int.MaxValue)]` when provided
  - Add optional temperature with no validation (any number allowed)

- `RecordRideSuccessResponse`
  - Properties: rideId, riderId, savedAtUtc, eventStatus

- `RideDefaultsResponse`
  - Properties: hasPreviousRide, defaultMiles (nullable), defaultRideMinutes (nullable), defaultTemperature (nullable), defaultRideDateTimeLocal

- `ErrorResponse`
  - Properties: message, errors (string[] or Dictionary<string, string[]>)

**Acceptance**: DTOs compile; validation attributes correct; matches contract spec.

---

### **[P] 3-2: Implement Persistence: DbContext Extension and Ride Entity Mapping**

**Files**:
- [src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs](src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs)
- [src/BikeTracking.Api/Infrastructure/Persistence/ApplicationDbContext.cs](src/BikeTracking.Api/Infrastructure/Persistence/ApplicationDbContext.cs) (modify)

**Description**:

1. Define RideEntity (already started in 1-5):
   - Id (int, PK)
   - RiderId (int, FK)
   - RideDateTimeLocal (DateTime)
   - Miles (decimal)
   - RideMinutes (nullable int)
   - Temperature (nullable decimal)
   - CreatedAtUtc (DateTime)

2. Extend ApplicationDbContext:
   - Add `DbSet<RideEntity> Rides { get; set; }`
   - Configure entity mapping in OnModelCreating:
     - Mark Id as primary key
     - Add check constraint: `Miles > 0`
     - Add check constraint: `RideMinutes > 0 OR RideMinutes IS NULL`
     - Add foreign key to Users
     - Create index on (RiderId, CreatedAtUtc) descending for efficient defaults query

**Acceptance**: DbContext compiles; EF migrations can be generated; entity mapping correct.

---

### **[P] 3-3: Create EF Core Migration for Rides Table**

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet ef migrations add AddRidesTable --project src/BikeTracking.Api
```

**Expected Output**: Migration file generated in `src/BikeTracking.Api/Infrastructure/Persistence/Migrations/`

**File**: A new migration file (e.g., `20260323_AddRidesTable.cs`)

**Description**: Migration must:
- Create `Rides` table with columns matching RideEntity
- Add check constraints for positive miles and rideMinutes
- Add foreign key constraint to Users table
- Add index on (RiderId, CreatedAtUtc)

**Acceptance**: Migration file generated; no SQL syntax errors; `dotnet ef database update` executes successfully.

---

### 3-4: Implement RecordRideService (Application Service)

**File**: [src/BikeTracking.Api/Application/Rides/RecordRideService.cs](src/BikeTracking.Api/Application/Rides/RecordRideService.cs)

**Description**: Implement command handler:

```csharp
public class RecordRideService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RecordRideService> _logger;

    public RecordRideService(ApplicationDbContext dbContext, ILogger<RecordRideService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<(int rideId, RideRecordedEventPayload eventPayload)> ExecuteAsync(
        int riderId,
        RecordRideRequest request,
        CancellationToken cancellationToken = default)
    {
        // Validation
        if (request.Miles <= 0)
            throw new ArgumentException("Miles must be greater than 0");
        if (request.RideMinutes.HasValue && request.RideMinutes <= 0)
            throw new ArgumentException("Ride minutes must be greater than 0");

        // Create ride entity
        var rideEntity = new RideEntity
        {
            RiderId = riderId,
            RideDateTimeLocal = request.RideDateTimeLocal,
            Miles = request.Miles,
            RideMinutes = request.RideMinutes,
            Temperature = request.Temperature,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Rides.Add(rideEntity);

        // Create event payload
        var eventPayload = new RideRecordedEventPayload
        {
            EventId = Guid.NewGuid().ToString(),
            EventType = "RideRecorded",
            OccurredAtUtc = DateTime.UtcNow,
            RiderId = riderId,
            RideDateTimeLocal = request.RideDateTimeLocal,
            Miles = request.Miles,
            RideMinutes = request.RideMinutes,
            Temperature = request.Temperature,
            Source = "BikeTracking.Api"
        };

        // Persist event to outbox (reuse existing pattern)
        // TODO: Use existing outbox persistence pattern from UserRegistrationEvent

        await _dbContext.SaveChangesAsync(cancellationToken);

        return (rideEntity.Id, eventPayload);
    }
}
```

**Key Points**:
- Validate miles and rideMinutes at service layer
- Create RideEntity and save to Rides table
- Create RideRecordedEventPayload and persist to outbox using existing pattern
- Use transaction to guarantee atomicity

**Acceptance**: Service compiles; creates ride and event payload; tests 3-2 tests pass.

---

### 3-5: Implement GetRideDefaultsService (Query Service)

**File**: [src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs](src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs)

**Description**: Implement query handler:

```csharp
public class GetRideDefaultsService
{
    private readonly ApplicationDbContext _dbContext;

    public GetRideDefaultsService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<RideDefaultsResponse> ExecuteAsync(
        int riderId,
        CancellationToken cancellationToken = default)
    {
        // Query latest ride for this rider
        var lastRide = await _dbContext.Rides
            .Where(r => r.RiderId == riderId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastRide == null)
        {
            // No prior rides
            return new RideDefaultsResponse
            {
                HasPreviousRide = false,
                DefaultRideDateTimeLocal = DateTime.Now
            };
        }

        // Has prior rides
        return new RideDefaultsResponse
        {
            HasPreviousRide = true,
            DefaultMiles = lastRide.Miles,
            DefaultRideMinutes = lastRide.RideMinutes,
            DefaultTemperature = lastRide.Temperature,
            DefaultRideDateTimeLocal = DateTime.Now
        };
    }
}
```

**Key Points**:
- Query latest ride by RiderId and CreatedAtUtc descending
- Return hasPreviousRide = false if no rides found
- Always return current local time for defaultRideDateTimeLocal
- Use index created in 3-2 for efficient query

**Acceptance**: Service compiles; returns correct defaults; tests in 2-2 pass.

---

### 3-6: Implement Rides Endpoints

**File**: [src/BikeTracking.Api/Endpoints/RidesEndpoints.cs](src/BikeTracking.Api/Endpoints/RidesEndpoints.cs)

**Description**: Implement endpoint handlers:

```csharp
public static class RidesEndpoints
{
    public static void MapRidesEndpoints(this WebApplication app, IServiceProvider serviceProvider)
    {
        var group = app.MapGroup("/api/rides")
            .WithName("Rides")
            .WithOpenApi()
            .RequireAuthorization(); // All endpoints require auth

        group.MapPost("/", RecordRide)
            .WithName("RecordRide")
            .Produces<RecordRideSuccessResponse>(StatusCodes.Status201Created)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .WithSummary("Record a new ride event");

        group.MapGet("/defaults", GetRideDefaults)
            .WithName("GetRideDefaults")
            .Produces<RideDefaultsResponse>(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized)
            .WithSummary("Get record-ride form defaults");
    }

    private static async Task<IResult> RecordRide(
        RecordRideRequest request,
        HttpContext context,
        RecordRideService recordRideService,
        CancellationToken cancellationToken)
    {
        try
        {
            // Get authenticated user ID from context (adjust based on auth implementation)
            var riderId = int.Parse(context.User.FindFirst("sub")?.Value ?? "0");
            if (riderId <= 0)
                return Results.Unauthorized();

            var (rideId, eventPayload) = await recordRideService.ExecuteAsync(
                riderId, request, cancellationToken);

            var response = new RecordRideSuccessResponse
            {
                RideId = rideId,
                RiderId = riderId,
                SavedAtUtc = DateTime.UtcNow,
                EventStatus = "Queued"
            };

            return Results.Created($"/api/rides/{rideId}", response);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new ErrorResponse { Message = ex.Message });
        }
    }

    private static async Task<IResult> GetRideDefaults(
        HttpContext context,
        GetRideDefaultsService getDefaultsService,
        CancellationToken cancellationToken)
    {
        try
        {
            var riderId = int.Parse(context.User.FindFirst("sub")?.Value ?? "0");
            if (riderId <= 0)
                return Results.Unauthorized();

            var defaults = await getDefaultsService.ExecuteAsync(riderId, cancellationToken);
            return Results.Ok(defaults);
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new ErrorResponse { Message = ex.Message });
        }
    }
}
```

**Key Points**:
- Require authentication on all endpoints
- Extract riderId from authenticated context
- POST endpoint returns 201 Created with location header
- GET endpoint returns 200 OK
- Handle validation errors with 400
- Use service layer for business logic

**Acceptance**: Endpoints compile; route mappings correct; tests in 2-1 pass.

---

### 3-7: Register Endpoints in Program.cs

**File**: [src/BikeTracking.Api/Program.cs](src/BikeTracking.Api/Program.cs) (modify)

**Description**: Add endpoint registration and service registrations:

```csharp
// In service registration section (before var app = builder.Build())
builder.Services.AddScoped<RecordRideService>();
builder.Services.AddScoped<GetRideDefaultsService>();

// After app = builder.Build(), in endpoint mapping section
app.MapRidesEndpoints(app.Services);
```

**Acceptance**: Program.cs compiles; services are registered; endpoints are mapped; application starts without errors.

---

### 3-8: Run Backend Tests and Verify Phase 3 Completion

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet test src/BikeTracking.Api.Tests --verbosity=normal --filter "RidesEndpointsTests or RidesApplicationServiceTests or RidesPersistenceTests" 2>&1 | tail -20
```

**Expected Output**: All Phase 2 tests PASSED (previously failing).

**Acceptance**: User confirms: "All backend tests pass. Phase 3 complete."

---

## PHASE 4: Integration - Frontend Implementation & Cross-Layer Verification

Implement frontend components and verify end-to-end integration.

### 4-1: Implement Frontend Rides API Service

**File**: [src/BikeTracking.Frontend/src/services/ridesService.ts](src/BikeTracking.Frontend/src/services/ridesService.ts) (new)

**Description**: Create service for API calls:

```typescript
export interface RecordRideRequest {
  rideDateTimeLocal: string; // ISO 8601 datetime
  miles: number;
  rideMinutes?: number;
  temperature?: number;
}

export interface RecordRideSuccessResponse {
  rideId: number;
  riderId: number;
  savedAtUtc: string;
  eventStatus: string;
}

export interface RideDefaultsResponse {
  hasPreviousRide: boolean;
  defaultMiles?: number;
  defaultRideMinutes?: number;
  defaultTemperature?: number;
  defaultRideDateTimeLocal: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export async function recordRide(request: RecordRideRequest): Promise<RecordRideSuccessResponse> {
  const response = await fetch(`${API_BASE}/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    credentials: "include" // Include auth cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to record ride");
  }

  return response.json();
}

export async function getRideDefaults(): Promise<RideDefaultsResponse> {
  const response = await fetch(`${API_BASE}/rides/defaults`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch ride defaults");
  }

  return response.json();
}
```

**Acceptance**: Service compiles; exports match interface contracts; tests in 2-5 pass.

---

### **[P] 4-2: Create RecordRidePage Component**

**File**: [src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx](src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx) (new)

**Description**: Implement React component for record ride form:

```typescript
import { useEffect, useState } from "react";
import { RecordRideRequest, RideDefaultsResponse, recordRide, getRideDefaults } from "../services/ridesService";

export function RecordRidePage() {
  const [rideDateTimeLocal, setRideDateTimeLocal] = useState<string>("");
  const [miles, setMiles] = useState<string>("");
  const [rideMinutes, setRideMinutes] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");
  
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const initializeDefaults = async () => {
      try {
        const defaults = await getRideDefaults();
        
        // Set date/time to current local time
        const now = new Date();
        const localIso = now.toISOString().slice(0, 16); // Remove seconds and timezone
        setRideDateTimeLocal(localIso);

        // Set optional defaults
        if (defaults.hasPreviousRide) {
          if (defaults.defaultMiles) setMiles(defaults.defaultMiles.toString());
          if (defaults.defaultRideMinutes) setRideMinutes(defaults.defaultRideMinutes.toString());
          if (defaults.defaultTemperature) setTemperature(defaults.defaultTemperature.toString());
        }
      } catch (error) {
        console.error("Failed to load defaults:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeDefaults();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Client-side validation
    const milesNum = parseFloat(miles);
    if (!miles || milesNum <= 0) {
      setErrorMessage("Miles must be greater than 0");
      return;
    }

    if (rideMinutes && parseInt(rideMinutes) <= 0) {
      setErrorMessage("Ride minutes must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const request: RecordRideRequest = {
        rideDateTimeLocal,
        miles: milesNum,
        rideMinutes: rideMinutes ? parseInt(rideMinutes) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined
      };

      const response = await recordRide(request);
      setSuccessMessage(`Ride recorded successfully (ID: ${response.rideId})`);
      
      // Keep form values for potential retry, but show success
      // Optional: reset form after delay
      setTimeout(() => {
        setRideDateTimeLocal("");
        setMiles("");
        setRideMinutes("");
        setTemperature("");
        setSuccessMessage("");
      }, 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to record ride");
      // Form values are preserved for retry
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading defaults...</div>;

  return (
    <div className="record-ride-page">
      <h1>Record a Ride</h1>
      
      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="rideDateTimeLocal">Date & Time</label>
          <input
            id="rideDateTimeLocal"
            type="datetime-local"
            value={rideDateTimeLocal}
            onChange={(e) => setRideDateTimeLocal(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="miles">Miles (required)</label>
          <input
            id="miles"
            type="number"
            step="0.01"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="rideMinutes">Duration (minutes, optional)</label>
          <input
            id="rideMinutes"
            type="number"
            value={rideMinutes}
            onChange={(e) => setRideMinutes(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="temperature">Temperature (optional)</label>
          <input
            id="temperature"
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Record Ride"}
        </button>
      </form>
    </div>
  );
}
```

**Key Points**:
- Load defaults on component mount
- Default date/time to current local time
- Prefill miles, rideMinutes, temperature from previous ride
- Client-side validation before submit
- Preserve form values on error
- Show success message after submit
- Handle loading state

**Acceptance**: Component compiles; renders form; tests in 2-4 pass.

---

### **[P] 4-3: Add Frontend Route for Record Ride Page**

**File**: [src/BikeTracking.Frontend/src/routes/index.tsx](src/BikeTracking.Frontend/src/routes/index.tsx) or [src/BikeTracking.Frontend/src/App.tsx](src/BikeTracking.Frontend/src/App.tsx) (modify)

**Description**: Add protected route for `/rides/record`:

```typescript
import { RecordRidePage } from "../pages/RecordRidePage";
import { ProtectedRoute } from "../components/ProtectedRoute"; // Use existing auth protection

// In route definitions:
{
  path: "/rides/record",
  element: <ProtectedRoute component={RecordRidePage} />
}
```

**Acceptance**: Route is defined; accessible only to authenticated users; page loads at `/rides/record`.

---

### 4-4: Run Frontend Tests and Verify Tests Pass

**Command**:
```bash
cd src/BikeTracking.Frontend
npm run test:unit 2>&1 | tail -30
```

**Expected Output**: All Phase 2 tests (2-4, 2-5) now PASSED.

**Acceptance**: User confirms: "All frontend tests pass."

---

### 4-5: Verify Frontend Build

**Command**:
```bash
cd src/BikeTracking.Frontend
npm run build
```

**Expected Output**: No TypeScript or build errors.

**Acceptance**: Build succeeds; no warnings about unused imports.

---

### 4-6: Verify Frontend Linting

**Command**:
```bash
cd src/BikeTracking.Frontend
npm run lint
```

**Expected Output**: No linting errors in new files.

**Acceptance**: Lint passes; code style consistent.

---

## PHASE 5: Polish - Verification & Refinement

Complete end-to-end verification and ensure feature meets all acceptance criteria.

### 5-1: Run Complete Backend Test Suite

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet test src/BikeTracking.Api.Tests --verbosity=normal 2>&1 | tail -30
```

**Expected Output**: All tests PASSED including new rides tests.

**Acceptance**: User confirms: "All backend tests pass."

---

### 5-2: Run Complete Frontend Test Suite

**Command**:
```bash
cd src/BikeTracking.Frontend
npm run test:unit 2>&1 | tail -30
```

**Expected Output**: All tests PASSED including new rides tests.

**Acceptance**: User confirms: "All frontend tests pass."

---

### 5-3: Run Application Locally and Perform Manual Verification

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet run --project src/BikeTracking.AppHost &
```

**Wait for startup**, then verify each step:

1. **Navigate to `/rides/record`** → Page loads with form
2. **Verify date/time defaults to now** → Current datetime is in date/time field
3. **Enter first ride**: date/time (any valid), miles (e.g., 10.5), leave optional fields empty
4. **Submit** → Success message appears; form data is preserved or cleared (per UX choice)
5. **Reload page** → date/time is current time; miles field is prefilled with 10.5
6. **Enter optional fields**: rideMinutes (e.g., 45), temperature (e.g., 72)
7. **Submit** → Success message
8. **Reload page** → All fields including optional ones are prefilled
9. **Test validation**: Enter miles = -1 → Submit → Error message appears; form is not cleared
10. **Test retry**: Keep entered values; correct miles field; submit again → Success

**Acceptance**: All manual steps succeed as described.

---

### 5-4: Verify Database Persistence

**Command** (from SQLite client in container):
```bash
sqlite3 /workspaces/neCodeBikeTracking/BikeTracking.db
```

**SQL Query**:
```sql
SELECT id, rider_id, ride_date_time_local, miles, ride_minutes, temperature, created_at_utc
FROM rides
ORDER BY created_at_utc DESC
LIMIT 3;
```

**Expected Output**: Rows corresponding to manual test rides, with correct values.

**Acceptance**: Database contains all submitted rides with exact values.

---

### 5-5: Verify Event Outbox Integration

**Command** (from SQLite):
```sql
SELECT id, aggregate_id, event_type, payload, published_at_utc
FROM outbox_events
WHERE event_type = 'RideRecorded'
ORDER BY created_at_utc DESC
LIMIT 3;
```

**Expected Output**: Rows with `event_type = 'RideRecorded'`, payload containing ride data as JSON.

**Acceptance**: Each recorded ride generates a corresponding outbox event with correct payload.

---

### 5-6: Verify API Contract Against Spec

**Check** each endpoint against [record-ride-api.yaml](record-ride-api.yaml):

- **POST /api/rides**:
  - Request: RecordRideRequest with required/optional fields ✓
  - Response 201: RecordRideSuccessResponse with rideId, riderId, savedAtUtc ✓
  - Response 400: ErrorResponse on validation failure ✓
  - Response 401: ErrorResponse when unauthorized ✓

- **GET /api/rides/defaults**:
  - Response 200: RideDefaultsResponse with all fields ✓
  - Response 401: ErrorResponse when unauthorized ✓

**Acceptance**: All endpoints match contract specification.

---

### 5-7: Verify Event Payload Schema

**Check** each persisted event in outbox against [ride-recorded-event.schema.json](ride-recorded-event.schema.json):

- `eventId` (string, guid) ✓
- `eventType` = "RideRecorded" (constant) ✓
- `occurredAtUtc` (date-time) ✓
- `riderId` (integer, >= 1) ✓
- `rideDateTimeLocal` (date-time) ✓
- `miles` (number, > 0) ✓
- `rideMinutes` (integer, > 0 when present, nullable) ✓
- `temperature` (number, nullable) ✓
- `source` = "BikeTracking.Api" (constant) ✓

**Acceptance**: All persisted events match JSON schema.

---

### 5-8: Code Cleanup and Documentation

**Tasks**:

1. Remove TODO comments and incomplete placeholders
2. Verify no debug logging remains
3. Add XML documentation comments to public methods in services
4. Ensure no hardcoded values (dates, IPs, timeouts)
5. Verify error messages are user-friendly and non-technical

**Files to check**:
- [src/BikeTracking.Api/Contracts/RidesContracts.cs](src/BikeTracking.Api/Contracts/RidesContracts.cs)
- [src/BikeTracking.Api/Application/Rides/RecordRideService.cs](src/BikeTracking.Api/Application/Rides/RecordRideService.cs)
- [src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs](src/BikeTracking.Api/Application/Rides/GetRideDefaultsService.cs)
- [src/BikeTracking.Api/Endpoints/RidesEndpoints.cs](src/BikeTracking.Api/Endpoints/RidesEndpoints.cs)
- [src/BikeTracking.Frontend/src/services/ridesService.ts](src/BikeTracking.Frontend/src/services/ridesService.ts)
- [src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx](src/BikeTracking.Frontend/src/pages/RecordRidePage.tsx)

**Acceptance**: Code is clean; no TODO comments; all messages are user-friendly.

---

### 5-9: Final Full Test Run

**Command**:
```bash
cd /workspaces/neCodeBikeTracking
dotnet test --verbosity=quiet 2>&1 | tail -5
cd src/BikeTracking.Frontend
npm run test:unit 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

**Expected Output**: All commands succeed (build, lint, all tests).

**Acceptance**: User confirms: "All tests pass, no lint errors, build succeeds."

---

### 5-10: Verification Matrix Summary

**Final Checklist**:

| Requirement | Status | Evidence |
|-------------|--------|----------|
| User can record ride with date/time and miles | ✓ | Manual verification step 3 |
| Date/time defaults to current time | ✓ | Manual verification step 2 |
| Miles defaults to last inserted value | ✓ | Manual verification step 5 |
| Optional fields can be left blank | ✓ | Manual verification step 3 |
| Optional fields prefill from last ride | ✓ | Manual verification step 8 |
| Validation blocks invalid miles | ✓ | Manual verification step 9 |
| Form values preserved on error | ✓ | Manual verification step 9 |
| Rides persisted in database | ✓ | Verification step 5-4 |
| RideRecorded events created in outbox | ✓ | Verification step 5-5 |
| API contract matches spec | ✓ | Verification step 5-6 |
| Event schema matches JSON schema | ✓ | Verification step 5-7 |
| All backend tests pass | ✓ | Verification step 5-1 |
| All frontend tests pass | ✓ | Verification step 5-2 |
| No linting errors | ✓ | Verification step 5-9 |
| Clean code, no TODOs | ✓ | Verification step 5-8 |

**Acceptance**: All items checked; feature ready for merge and deployment.

---

## File Structure Reference

### New Files Created

```
src/
├── BikeTracking.Api/
│   ├── Contracts/
│   │   └── RidesContracts.cs ........................ [3-1, 1-1]
│   ├── Endpoints/
│   │   └── RidesEndpoints.cs ........................ [3-6, 1-2]
│   ├── Application/
│   │   ├── Events/
│   │   │   └── RideRecordedEventPayload.cs ......... [1-4]
│   │   └── Rides/
│   │       ├── RecordRideService.cs ................ [3-4]
│   │       └── GetRideDefaultsService.cs ........... [3-5]
│   └── Infrastructure/
│       └── Persistence/
│           ├── Entities/
│           │   └── RideEntity.cs ................... [1-5, 3-2]
│           └── Migrations/
│               └── *AddRidesTable.cs ............... [3-3]
│
├── BikeTracking.Api.Tests/
│   ├── Endpoints/
│   │   └── RidesEndpointsTests.cs ................. [2-1]
│   ├── Application/
│   │   └── RidesApplicationServiceTests.cs ........ [2-2]
│   └── Infrastructure/
│       └── RidesPersistenceTests.cs ............... [2-3]
│
└── BikeTracking.Frontend/
    ├── src/
    │   ├── pages/
    │   │   └── RecordRidePage.tsx .................. [4-2]
    │   ├── services/
    │   │   └── ridesService.ts ..................... [4-1]
    │   └── routes/
    │       └── (index.tsx or App.tsx modified) .... [4-3]
    └── tests/
        ├── pages/
        │   └── RecordRidePage.test.tsx ............ [2-4]
        └── services/
            └── ridesService.test.ts ............... [2-5]
```

### Modified Files

- [src/BikeTracking.Api/Program.cs](src/BikeTracking.Api/Program.cs) .................... [3-7]
- [src/BikeTracking.Api/Infrastructure/Persistence/ApplicationDbContext.cs](src/BikeTracking.Api/Infrastructure/Persistence/ApplicationDbContext.cs) [3-2]
- [src/BikeTracking.Frontend/src/routes/index.tsx](src/BikeTracking.Frontend/src/routes/index.tsx) or similar [4-3]

---

## Task Execution Tips

1. **Sequential phases**: Do not skip to Phase 3 until Phase 2 tests all fail.
2. **Parallel tasks**: Tasks marked **[P]** can run in parallel; other tasks must wait for dependent files.
3. **Take screenshots**: Document manual verification steps with screenshots for audit trail.
4. **Git commits**: Commit after each major phase (Setup, Tests, Core, Integration, Polish).
5. **Error recovery**: If a test fails after implementation, use 5-1 and 5-2 to isolate and fix.
6. **Keep database clean**: Between manual verification runs, optionally clear rides table or snapshot state.

---

## Success Criteria (All Must Pass)

- ✅ All 27 tests implemented and passing
- ✅ Zero linting errors
- ✅ Frontend builds without errors
- ✅ Backend builds and runs
- ✅ Manual verification flow completes successfully
- ✅ Database persistence verified
- ✅ Event outbox integration verified
- ✅ API contracts and schemas match specifications
- ✅ Code is clean with no TODOs or debug logging

---

**End of tasks.md**
