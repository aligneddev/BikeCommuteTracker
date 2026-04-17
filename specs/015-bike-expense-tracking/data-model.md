# Data Model: Bike Expense Tracking (Spec 015)

**Date**: 2026-04-17  
**Branch**: `015-bike-expense-tracking`

---

## New Entities

### ExpenseEntity (EF Core / SQLite)

Maps to `Expenses` table. Represents the current projected state of a single expense entry.

| Column | Type | Nullable | Constraints |
|--------|------|----------|-------------|
| `Id` | `long` | No | PK, auto-increment |
| `RiderId` | `long` | No | FK → Users.UserId (cascade delete) |
| `ExpenseDate` | `DateTime` | No | Date of the expense (local) |
| `Amount` | `decimal(10,2)` | No | CHECK > 0 |
| `Notes` | `string` | Yes | MaxLength(500) |
| `ReceiptPath` | `string` | Yes | MaxLength(500); relative path within receipts root |
| `IsDeleted` | `bool` | No | Default false; tombstone flag |
| `Version` | `int` | No | Default 1; optimistic concurrency token |
| `CreatedAtUtc` | `DateTime` | No | Timestamp of first insert |
| `UpdatedAtUtc` | `DateTime` | No | Timestamp of last update |

**Indexes**:
- `IX_Expenses_RiderId_ExpenseDate_Desc` — (RiderId ASC, ExpenseDate DESC) for efficient history queries  
- `IX_Expenses_RiderId_IsDeleted` — (RiderId, IsDeleted) for quick active-expense queries

**Check constraints**:
- `CK_Expenses_Amount_Positive` — `CAST("Amount" AS REAL) > 0`

---

## Modified Entities

### DashboardTotals (DashboardContracts.cs)

Extended with new `ExpenseSummary` field:

```csharp
// Existing record — add one property:
public sealed record DashboardTotals(
    DashboardMileageMetric CurrentMonthMiles,
    DashboardMileageMetric YearToDateMiles,
    DashboardMileageMetric AllTimeMiles,
    DashboardMoneySaved MoneySaved,
    DashboardExpenseSummary ExpenseSummary   // NEW
);

// New record:
public sealed record DashboardExpenseSummary(
    decimal TotalManualExpenses,
    decimal? OilChangeSavings,        // null if oil change price not set in settings
    decimal? NetExpenses,             // null if oil change price not set
    int OilChangeIntervalCount        // floor(lifetime miles / 3000)
);
```

---

## F# Domain Types

### ExpenseEvents.fs (new file in BikeTracking.Domain.FSharp)

```fsharp
module BikeTracking.Domain.Expenses

open System

type ExpenseRecordedData = {
    ExpenseId   : int64
    RiderId     : int64
    ExpenseDate : DateTime
    Amount      : decimal      // validated > 0
    Notes       : string option
    ReceiptPath : string option
    RecordedAt  : DateTime
}

type ExpenseEditedData = {
    ExpenseId        : int64
    RiderId          : int64
    ExpenseDate      : DateTime
    Amount           : decimal
    Notes            : string option
    ReceiptPath      : string option
    ExpectedVersion  : int
    EditedAt         : DateTime
}

type ExpenseDeletedData = {
    ExpenseId   : int64
    RiderId     : int64
    DeletedAt   : DateTime
}

type ExpenseEvent =
    | ExpenseRecorded of ExpenseRecordedData
    | ExpenseEdited   of ExpenseEditedData
    | ExpenseDeleted  of ExpenseDeletedData

// Pure validation — Railway Oriented Programming
let validateAmount (amount: decimal) : Result<decimal, string> =
    if amount > 0m then Ok amount
    else Error "Expense amount must be greater than zero"

let validateNotes (notes: string option) : Result<string option, string> =
    match notes with
    | None -> Ok None
    | Some n when n.Length > 500 -> Error "Note must be 500 characters or fewer"
    | Some n -> Ok (Some n)

let validateDate (date: DateTime) : Result<DateTime, string> =
    if date = DateTime.MinValue then Error "Expense date is required"
    else Ok date
```

---

## Receipt File Storage Layout

```
{app_data_path}/
├── biketracking.local.db           # SQLite database (existing)
└── receipts/
    └── {riderId}/
        └── {expenseId}/
            └── {random_guid}.{ext} # Sanitized filename generated server-side
```

- `ReceiptPath` column stores the path relative to `receipts/` root: `{riderId}/{expenseId}/{random_guid}.{ext}`
- Accepted extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`
- Max size: 5 MB per receipt
- MIME type validated server-side independently of file extension

---

## Database Migration

New migration: `AddExpensesTable`

```sql
CREATE TABLE "Expenses" (
    "Id"           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "RiderId"      INTEGER NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
    "ExpenseDate"  TEXT    NOT NULL,
    "Amount"       TEXT    NOT NULL,
    "Notes"        TEXT    NULL,
    "ReceiptPath"  TEXT    NULL,
    "IsDeleted"    INTEGER NOT NULL DEFAULT 0,
    "Version"      INTEGER NOT NULL DEFAULT 1,
    "CreatedAtUtc" TEXT    NOT NULL,
    "UpdatedAtUtc" TEXT    NOT NULL,
    CONSTRAINT "CK_Expenses_Amount_Positive" CHECK (CAST("Amount" AS REAL) > 0)
);

CREATE INDEX "IX_Expenses_RiderId_ExpenseDate_Desc"
    ON "Expenses" ("RiderId" ASC, "ExpenseDate" DESC);

CREATE INDEX "IX_Expenses_RiderId_IsDeleted"
    ON "Expenses" ("RiderId", "IsDeleted");
```

---

## State Transitions

```
[New Expense]
      │
      ▼
  ExpenseRecorded ──→ ExpenseEdited (0..n times)
      │                      │
      └──────────────────────┘
                │
                ▼
         ExpenseDeleted (IsDeleted = true; removed from UI and totals)
```

**Validation rules** (enforced at all entry points):
- Amount: required, decimal > 0, max 2 decimal places
- ExpenseDate: required, valid date
- Notes: optional, max 500 characters
- Receipt: optional; if present: accepted MIME type + ≤ 5 MB

---

## Relationships

```
Users (1) ──── (*) Expenses
Users (1) ──── (*) Rides         [existing]
UserSettings (1) ──── (1) Users  [existing]
```

Oil-change savings are **calculated** (not stored) from:
- `SUM(Rides.Miles) WHERE RiderId = x AND IsDeleted = false` (existing Rides table)
- `UserSettings.OilChangePrice WHERE UserId = x` (existing UserSettings)
- Formula: `FLOOR(totalMiles / 3000) * oilChangePrice`
