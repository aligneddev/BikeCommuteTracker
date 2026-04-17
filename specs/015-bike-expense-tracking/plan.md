# Implementation Plan: Bike Expense Tracking

**Branch**: `015-bike-expense-tracking` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/015-bike-expense-tracking/spec.md`

---

## Summary

Add bike expense tracking: a rider records manual expenses (date, amount, optional note, optional receipt image), views and inline-edits expense history with date-range filtering, and deletes expenses. The dashboard gains an expense summary panel showing total manual expenses, automatic oil-change savings (`floor(lifetime_miles / 3000) × oil_change_price`), and the net figure alongside existing gas-saved and mileage-saved values.

**Technical approach**: New `Expenses` SQLite table via EF Core migration. F# `ExpenseEvents` discriminated union for domain modeling. Four Application Services + `IReceiptStorage` port with `FileSystemReceiptStorage` adapter for local-disk receipt files. Seven new Minimal API endpoints under `/api/expenses`. `GetDashboardService` extended to query expenses and compute oil-change savings. Two new frontend pages (`/expenses/entry`, `/expenses/history`) following the existing ride pattern. Dashboard extended with expense summary card.

---

## Technical Context

**Language/Version**: C# 13 / .NET 10 (API), F# (domain), TypeScript 5 / React 19 (frontend)
**Primary Dependencies**: ASP.NET Core Minimal API, EF Core 9 (SQLite), xUnit, Vitest, Playwright, React Router v7, Vite
**Storage**: SQLite local file (`biketracking.local.db`); receipt files in `receipts/` subfolder alongside DB
**Testing**: xUnit (backend unit + integration), Vitest (frontend unit), Playwright (E2E)
**Target Platform**: Local user machine (Windows/macOS/Linux); devcontainer for development
**Project Type**: Local-first desktop web application (Aspire-orchestrated)
**Performance Goals**: API response <500ms p95
**Constraints**: Offline-capable; no cloud services; single-user SQLite file; receipts ≤5 MB
**Scale/Scope**: Single-user local deployment; expense list typically <500 rows per rider

---

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I — Clean Architecture / Ports-and-Adapters | `IReceiptStorage` port + `FileSystemReceiptStorage` adapter; no filesystem calls in Application layer | PASS |
| I — No god services | Four focused services, each single-responsibility | PASS |
| II — Pure/Impure Sandwich | F# `ExpenseEvents.fs` pure validation returning `Result<_,string>`; I/O in C# services only | PASS |
| III — Event Sourcing | `ExpenseRecorded/Edited/Deleted` events; `IsDeleted` tombstone projection | PASS |
| IV — TDD | Red-Green-Refactor mandatory; test plan in quickstart.md; failing tests before implementation | PASS |
| V — UX Consistency | History page follows `HistoryPage.tsx`; inline edit follows ride edit pattern | PASS |
| VI — Performance | Dashboard adds one Expenses scan; indexed on (RiderId, ExpenseDate DESC) | PASS |
| VII — Three-layer validation | React form + DataAnnotations DTOs + SQLite CHECK constraint on Amount | PASS |
| VIII — Security | Receipt path never from user input; rider ownership validated before file serve; MIME server-validated | PASS |
| IX — Contract-first | API contracts in `contracts/api-contracts.md` before implementation | PASS |
| X — TBD | Additive new pages + new endpoints; no feature flag needed | PASS |

---

## Project Structure

### Documentation (this feature)

```text
specs/015-bike-expense-tracking/
├── plan.md              <- this file
├── research.md          <- Phase 0 output
├── data-model.md        <- Phase 1 output
├── quickstart.md        <- Phase 1 output
├── contracts/
│   └── api-contracts.md <- Phase 1 output
└── tasks.md             <- Phase 2 output (/speckit.tasks)
```

### Source Code — New Files

```text
src/BikeTracking.Domain.FSharp/
└── Expenses/
    └── ExpenseEvents.fs

src/BikeTracking.Api/
├── Infrastructure/
│   ├── Persistence/
│   │   ├── Entities/
│   │   │   └── ExpenseEntity.cs
│   │   └── Migrations/
│   │       └── {timestamp}_AddExpensesTable.cs
│   └── Receipts/
│       └── FileSystemReceiptStorage.cs
├── Application/
│   └── Expenses/
│       ├── IReceiptStorage.cs
│       ├── RecordExpenseService.cs
│       ├── EditExpenseService.cs
│       ├── DeleteExpenseService.cs
│       └── GetExpenseHistoryService.cs
├── Contracts/
│   └── ExpenseContracts.cs
└── Endpoints/
    └── ExpensesEndpoints.cs

src/BikeTracking.Api.Tests/
└── Expenses/
    ├── RecordExpenseServiceTests.cs
    ├── EditExpenseServiceTests.cs
    ├── DeleteExpenseServiceTests.cs
    └── GetExpenseHistoryServiceTests.cs

src/BikeTracking.Frontend/src/
├── pages/
│   └── expenses/
│       ├── ExpenseEntryPage.tsx
│       ├── ExpenseEntryPage.css
│       ├── ExpenseHistoryPage.tsx
│       ├── ExpenseHistoryPage.css
│       └── expense-page.helpers.ts
└── services/
    └── expenses-api.ts
```

### Source Code — Modified Files

```text
src/BikeTracking.Domain.FSharp/BikeTracking.Domain.FSharp.fsproj    # Register ExpenseEvents.fs
src/BikeTracking.Api/Infrastructure/Persistence/BikeTrackingDbContext.cs   # Add DbSet + model config
src/BikeTracking.Api/Application/Dashboard/GetDashboardService.cs          # Add expense + savings calc
src/BikeTracking.Api/Contracts/DashboardContracts.cs                       # Add DashboardExpenseSummary
src/BikeTracking.Api/Program.cs                                            # Register services + endpoints
src/BikeTracking.Frontend/src/App.tsx                                      # Add 2 new routes
src/BikeTracking.Frontend/src/pages/dashboard/dashboard-page.tsx           # Add expense panel
src/BikeTracking.Frontend/src/[nav component]                              # Add 2 nav links
```

---

## Architecture Decisions

### 1. Multipart for Record, JSON + Separate Endpoints for Edits
Initial `POST /api/expenses` uses `multipart/form-data` (fields + optional receipt in one request). Edit uses plain JSON `PUT /api/expenses/{id}`. Receipt changes use dedicated `PUT /api/expenses/{id}/receipt` and `DELETE /api/expenses/{id}/receipt` — avoids re-uploading existing receipts on text-only edits.

### 2. Receipt File Path Security
Server generates a `Guid`-based filename — original browser filename is never stored or used. DB `ReceiptPath` stores relative path from receipts root: `{riderId}/{expenseId}/{guid}.{ext}`. `GET /api/expenses/{id}/receipt` validates JWT `sub` claim against expense `RiderId` before serving the file — path is never derived from user request data.

### 3. Oil-Change Savings in Dashboard
Dashboard already loads all rides for the rider. Oil-change savings are a simple in-memory calculation over the already-loaded ride list + `UserSettings.OilChangePrice` — no extra DB round-trip needed.

### 4. IsDeleted Tombstone
`ExpenseEntity.IsDeleted = true` is the tombstone. Receipt file removed from disk on delete. All queries filter `WHERE IsDeleted = false`. `IX_Expenses_RiderId_IsDeleted` index keeps this cheap.

---

## Test Plan (TDD Gates)

### F# Domain
- `validateAmount 0m` -> Error; `-1m` -> Error; `0.01m` -> Ok
- `validateNotes (501 chars)` -> Error; `None` -> Ok; short string -> Ok
- `validateDate DateTime.MinValue` -> Error; valid date -> Ok

### Backend Application Services
- `RecordExpenseService`: saves entity; null receipt is valid
- `EditExpenseService`: version conflict -> Conflict result; valid edit increments version
- `DeleteExpenseService`: sets IsDeleted=true; subsequent GET excludes it
- `GetExpenseHistoryService`: date filter excludes out-of-range; total is correct

### API Endpoints (integration)
- POST with missing amount -> 400
- POST with oversized receipt -> 422
- PUT with wrong version -> 409
- DELETE -> 204; GET excludes deleted expense
- GET receipt as different rider -> 404

### Frontend Unit (Vitest)
- Entry form renders all fields
- Blank amount -> validation message shown
- Valid submit -> calls expenses-api service

### E2E (Playwright)
- Record -> appears in history with correct amount
- Edit -> updated in list and total
- Delete -> removed; total decreases
- Dashboard shows totalManualExpenses matching recorded
- Dashboard shows oilChangeSavings when price set and miles >= 3000
