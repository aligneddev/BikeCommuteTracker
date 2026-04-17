# Research: Bike Expense Tracking (Spec 015)

**Date**: 2026-04-17  
**Resolved**: All unknowns from Technical Context  

---

## 1. Receipt File Storage — Local-First Deployment

**Decision**: Store receipt files in a `receipts/` subdirectory alongside the SQLite database file on the user's machine. The database record stores only the relative file path/reference; binary content is never stored in the SQLite BLOB column.

**Rationale**:
- Consistent with existing SQLite local-file deployment pattern; one backup folder covers both DB and receipts.
- Avoids BLOB storage which degrades EF Core query performance and inflates DB file size.
- The existing `SqliteMigrationBootstrapper.cs` already resolves the DB path from `IConfiguration`; the same path resolution can derive the receipts root.
- IReceiptStorage port → FileSystemReceiptStorage adapter satisfies the Ports-and-Adapters architecture requirement (Principle I) and allows testing without real filesystem.

**File path convention**: `{receipts_root}/{riderId}/{expenseId}/{original_filename_sanitized}.{ext}`  
Using `expenseId` subfolder prevents filename collisions across edits/retries.

**Accepted file types**: JPEG, PNG, WEBP, PDF — common receipt capture formats (phone camera → JPEG/HEIC converted by browser, scanner → PDF).  
**Max file size**: 5 MB per receipt — sufficient for a high-res phone photo; prevents runaway disk usage.  
**Alternatives considered**:  
- SQLite BLOB: Rejected — degrades query performance; harder to open/preview receipts externally.  
- User-chosen folder: Rejected — adds setup friction; inconsistent with local-first simplicity.

---

## 2. Oil-Change Savings Calculation Scope

**Decision**: Lifetime cumulative ride miles (all-time total, never resets). Formula: `floor(lifetime_ride_miles / 3000) × oil_change_price`.

**Rationale**:
- Oil changes are per-vehicle maintenance events unrelated to calendar years — a rider who has ridden 8500 lifetime miles has genuinely deferred ~2.8 oil changes.
- Annual reset creates a confusing "cliff" on January 1 where savings drop to zero even though the bike still hasn't needed an oil change.
- Consistent with the existing `SnapshotOilChangePrice` field already present on `RideEntity` — the data is already available for historical calculation accuracy.
- Uses `UserSettingsEntity.OilChangePrice` as the multiplier; if null → savings unavailable (not zero).

**Alternatives considered**:  
- Annual reset: Rejected — conceptually incorrect; oil change intervals don't reset with the year.  
- Rolling 12 months: Rejected — adds complexity without matching real-world bike maintenance.

---

## 3. Integration with Existing Dashboard

**Decision**: Extend `DashboardResponse` with a new `ExpenseSummary` property rather than a separate endpoint.

**Rationale**:
- The dashboard already returns a single `DashboardResponse` from `GET /api/dashboard`; adding expense data avoids a second round-trip for the page.
- `GetDashboardService` already queries both `Rides` and `UserSettings`; adding an `Expenses` query is a natural extension.
- Oil-change savings (`floor(totalMiles / 3000) × oilChangePrice`) can be computed from already-loaded rides + settings data — no additional DB call needed.
- Existing `DashboardTotals` record is extended; frontend `DashboardPage` component adds the new summary card.

**New dashboard fields**:
```
DashboardTotals.ExpenseSummary:
  TotalManualExpenses: decimal       # sum of non-deleted expense amounts
  OilChangeSavings: decimal?         # null if oil change price not set
  NetExpenses: decimal?              # null if oil change price not set
  OilChangeIntervalsMiles: int       # floor(lifetime miles / 3000)
```

---

## 4. Expense Delete Pattern

**Decision**: Same tombstone-event pattern as ride delete (spec 007). A logical `IsDeleted` flag on `ExpenseEntity` acts as the tombstone projection; the underlying EF row is never physically removed. Deleted expenses are excluded from history list and expense totals.

**Rationale**:
- Matches existing `DeleteRideHandler`/`DeleteRideService` pattern — implementation consistency.
- Event sourcing principle (Principle III): events are append-only; delete is a new event, not a mutation.
- Deleted expense receipt files: removed from filesystem on delete; tombstone event records that removal occurred.

---

## 5. Expense History Filter Pattern

**Decision**: Date-range filter matching the ride history page pattern (start date + end date; both optional). Filtered total updates with the visible list. Applied client-side on already-loaded expense list (same approach as ride history) for responsive UX without extra API calls.

**Rationale**:
- Ride history uses client-side filtering over a fully loaded list; expense lists will typically be shorter than ride lists so the same approach is appropriate.
- API remains simple: `GET /api/expenses?startDate=...&endDate=...` with optional date params to optionally filter server-side when the list grows large.

---

## 6. F# Domain Layer Design

**Decision**: Add `ExpenseEvents` discriminated union in `BikeTracking.Domain.FSharp` following the same pattern as `UserEvents.fs`.

**Module structure**:
```fsharp
type ExpenseEvent =
  | ExpenseRecorded of ExpenseRecordedData
  | ExpenseEdited   of ExpenseEditedData
  | ExpenseDeleted  of ExpenseDeletedId

type ExpenseRecordedData = {
  ExpenseId  : int64
  RiderId    : int64
  Date       : DateTime
  Amount     : decimal       // always positive
  Note       : string option
  ReceiptPath: string option
  RecordedAt : DateTime
}
// etc.
```

Pure validation functions return `Result<ExpenseEvent, string>` following Railway Oriented Programming (Principle II).

---

## 7. Navigation / Menu Link

**Decision**: Add two routes and nav links:
- `/expenses/entry` — "Add Expense" entry form
- `/expenses/history` — "Expense History" list with filter and edit

Navigation links added to the shared nav component used by all protected pages (same pattern as existing `/rides/history`, `/rides/record`, `/settings`).

**Naming**: "Expenses" as the menu group label; "Add Expense" and "Expense History" as individual link labels — descriptive and consistent with "Record Ride" / "Ride History" naming.

---

## 8. Multipart vs JSON for Receipt Upload

**Decision**: Multipart form upload (`multipart/form-data`) for the initial `POST /api/expenses` (expense + optional receipt in one request). For edits, a separate `PUT /api/expenses/{id}/receipt` endpoint handles receipt replacement/removal to keep the edit JSON endpoint clean.

**Rationale**:
- Multipart is the standard HTTP mechanism for file + JSON field co-submission.
- Separating receipt management from field editing avoids re-uploading an existing receipt every time text fields are edited.
- ASP.NET Core Minimal API supports `IFormFile` natively.

**Security considerations**:
- Validate MIME type server-side (not just client file extension).
- Generate a sanitized, random filename on upload — never trust the original filename.
- Restrict file read to the owning rider (path includes riderId; API validates).
- Max 5 MB enforced via `RequestSizeLimitAttribute` or middleware.
