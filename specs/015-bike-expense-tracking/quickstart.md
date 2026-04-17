# Quickstart: Bike Expense Tracking (Spec 015)

**Date**: 2026-04-17  
**For**: Implementers working from tasks.md

---

## Prerequisites

- DevContainer running (all tooling pre-configured)
- App starts via `dotnet run --project src/BikeTracking.AppHost`
- Existing specs 009 (user settings) and 012 (dashboard) implemented — `UserSettingsEntity.OilChangePrice` and `GetDashboardService` already exist

---

## Key Files to Read Before Starting

| File | Why |
|------|-----|
| `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs` | Template for ExpenseEntity shape |
| `src/BikeTracking.Api/Application/Rides/DeleteRideHandler.cs` | Template for tombstone delete pattern |
| `src/BikeTracking.Api/Application/Rides/EditRideService.cs` | Template for optimistic concurrency edit pattern |
| `src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs` | Extension point for expense summary calculation |
| `src/BikeTracking.Api/Contracts/DashboardContracts.cs` | Extension point for DashboardExpenseSummary |
| `src/BikeTracking.Api/Endpoints/RidesEndpoints.cs` | Template for new ExpensesEndpoints |
| `src/BikeTracking.Domain.FSharp/Users/UserEvents.fs` | Template for new ExpenseEvents.fs |
| `src/BikeTracking.Frontend/src/pages/HistoryPage.tsx` | Template for ExpenseHistoryPage |
| `src/BikeTracking.Frontend/src/services/ridesService.ts` | Template for expenses-api.ts |
| `src/BikeTracking.Frontend/src/App.tsx` | Add new routes here |

---

## Implementation Sequence (TDD order)

### Step 1 — F# Domain Events
Add `ExpenseEvents.fs` to `BikeTracking.Domain.FSharp` and register it in `.fsproj`. Write F# unit tests for:
- `validateAmount` rejects ≤ 0, accepts > 0
- `validateNotes` rejects > 500 chars, accepts None and short strings
- `validateDate` rejects MinValue

### Step 2 — EF Core Entity + Migration
Add `ExpenseEntity.cs` to `Infrastructure/Persistence/Entities/`. Add `DbSet<ExpenseEntity>` to `BikeTrackingDbContext`. Add EF model config with check constraint and indexes. Run `dotnet ef migrations add AddExpensesTable --project src/BikeTracking.Api`.

### Step 3 — Receipt Storage Port/Adapter
Create `Application/Expenses/IReceiptStorage.cs` (port interface) and `Infrastructure/Receipts/FileSystemReceiptStorage.cs` (adapter). Register in `Program.cs`. Write unit tests with in-memory/temp-path stub.

### Step 4 — Application Services (TDD)
For each service, write failing tests first:
- `RecordExpenseService` — saves entity, calls receipt storage, returns success
- `EditExpenseService` — optimistic concurrency check, updates entity
- `DeleteExpenseService` — sets IsDeleted=true, removes receipt file
- `GetExpenseHistoryService` — returns filtered list, computes totalAmount

### Step 5 — API Contracts + Endpoints
Add `Contracts/ExpenseContracts.cs`. Add `Endpoints/ExpensesEndpoints.cs` (7 endpoints). Register in `Program.cs`. Write integration tests via `BikeTracking.Api.Tests`.

### Step 6 — Dashboard Extension
Extend `DashboardContracts.cs` with `DashboardExpenseSummary`. Update `GetDashboardService` to query non-deleted expenses and compute oil-change savings. Update frontend `DashboardPage`.

### Step 7 — Frontend Entry Form
Add `src/pages/expenses/ExpenseEntryPage.tsx` + service calls. Add route `/expenses/entry`. Add nav link.

### Step 8 — Frontend History Page
Add `src/pages/expenses/ExpenseHistoryPage.tsx` following `HistoryPage.tsx` pattern. Add route `/expenses/history`. Add nav link. Implement inline edit + delete + date range filter.

### Step 9 — Dashboard UI Updates
Update `DashboardPage` / `DashboardSummaryCard` to show `expenseSummary` panel alongside existing savings cards.

### Step 10 — E2E Tests
Add Playwright tests:
- Full expense record → view in history flow
- Edit expense
- Delete expense
- Dashboard shows correct totals

---

## Common Patterns Reference

### Optimistic Concurrency (Edit)
```csharp
// From EditRideService pattern:
var expense = await dbContext.Expenses
    .Where(e => e.Id == request.ExpenseId && e.RiderId == riderId)
    .SingleOrDefaultAsync(ct);
if (expense is null) return ExpenseEditResult.NotFound;
if (expense.Version != request.ExpectedVersion) return ExpenseEditResult.Conflict;
// ... update fields ...
expense.Version++;
```

### Tombstone Delete
```csharp
// From DeleteRideHandler pattern:
expense.IsDeleted = true;
expense.UpdatedAtUtc = DateTime.UtcNow;
await dbContext.SaveChangesAsync(ct);
// then remove receipt file via IReceiptStorage
```

### Oil-Change Savings Calculation
```csharp
var lifetimeMiles = rides.Where(r => !r.IsDeleted).Sum(r => r.Miles); // rides already loaded
var intervalCount = (int)Math.Floor((double)lifetimeMiles / 3000);
var oilChangeSavings = settings?.OilChangePrice is decimal price
    ? intervalCount * price
    : (decimal?)null;
```

### Multipart Expense Record (API)
```csharp
app.MapPost("/api/expenses", async (
    [FromForm] RecordExpenseRequest request,
    IFormFile? receipt,
    HttpContext context,
    RecordExpenseService service,
    CancellationToken ct) => { ... })
    .DisableAntiforgery();  // JWT auth; CSRF not applicable for API
```

---

## Test Commands

```bash
# Backend tests
dotnet test src/BikeTracking.Api.Tests/BikeTracking.Api.Tests.csproj

# Frontend unit tests
cd src/BikeTracking.Frontend && npm run test:unit

# E2E (start app first)
cd src/BikeTracking.Frontend && npm run test:e2e
```

---

## File Size / MIME Validation
```csharp
private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
{
    "image/jpeg", "image/png", "image/webp", "application/pdf"
};
private const long MaxReceiptBytes = 5 * 1024 * 1024; // 5 MB

if (receipt.Length > MaxReceiptBytes) return Results.UnprocessableEntity(...);
if (!AllowedMimeTypes.Contains(receipt.ContentType)) return Results.UnprocessableEntity(...);
```
