# API Contracts: Bike Expense Tracking (Spec 015)

**Date**: 2026-04-17  
**Base path**: `/api/expenses`  
**Authentication**: All endpoints require bearer token (`RequireAuthorization()`)

---

## Endpoints

### POST /api/expenses
Record a new expense. Accepts `multipart/form-data` to support optional receipt upload.

**Request** (`multipart/form-data`):
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `expenseDate` | `string` (ISO 8601 date) | Yes | Valid date |
| `amount` | `string` (decimal) | Yes | > 0, max 2 dp |
| `notes` | `string` | No | Max 500 chars |
| `receipt` | `file` | No | JPEG/PNG/WEBP/PDF, ≤ 5 MB |

**Response 201**:
```json
{
  "expenseId": 42,
  "riderId": 7,
  "savedAtUtc": "2026-04-17T14:00:00Z",
  "receiptAttached": true
}
```

**Response 400** — validation failure:
```json
{
  "errors": {
    "amount": ["Expense amount must be greater than zero"],
    "expenseDate": ["Expense date is required"]
  }
}
```

**Response 422** — receipt constraint violation:
```json
{
  "error": "Receipt must be JPEG, PNG, WEBP, or PDF and no larger than 5 MB"
}
```

---

### GET /api/expenses
Get expense history for the authenticated rider. Returns all non-deleted expenses.

**Query params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `startDate` | `string` (ISO 8601) | No | Inclusive lower bound |
| `endDate` | `string` (ISO 8601) | No | Inclusive upper bound |

**Response 200**:
```json
{
  "expenses": [
    {
      "expenseId": 42,
      "expenseDate": "2026-04-15",
      "amount": 49.99,
      "notes": "New chain",
      "hasReceipt": true,
      "version": 1,
      "createdAtUtc": "2026-04-17T14:00:00Z"
    }
  ],
  "totalAmount": 49.99,
  "expenseCount": 1,
  "generatedAtUtc": "2026-04-17T14:01:00Z"
}
```

---

### PUT /api/expenses/{id}
Edit an existing expense (JSON body; no receipt — use separate receipt endpoint).

**Path param**: `id` — expense ID  
**Request** (`application/json`):
```json
{
  "expenseDate": "2026-04-15",
  "amount": 52.50,
  "notes": "New chain + lube",
  "expectedVersion": 1
}
```

| Field | Required | Constraints |
|-------|----------|-------------|
| `expenseDate` | Yes | Valid date |
| `amount` | Yes | > 0 |
| `notes` | No | Max 500 chars |
| `expectedVersion` | Yes | ≥ 1, optimistic concurrency |

**Response 200** — success:
```json
{
  "expenseId": 42,
  "savedAtUtc": "2026-04-17T14:05:00Z",
  "newVersion": 2
}
```

**Response 409** — version conflict:
```json
{
  "error": "This expense was updated by another session. Please refresh and try again."
}
```

---

### DELETE /api/expenses/{id}
Delete (tombstone) an expense. Receipt file removed from storage.

**Path param**: `id` — expense ID  
**Request body**: none  
**Response 204** — deleted  
**Response 404** — not found or belongs to a different rider  
**Response 409** — already deleted  

---

### PUT /api/expenses/{id}/receipt
Replace or upload a receipt for an existing expense.

**Path param**: `id` — expense ID  
**Request** (`multipart/form-data`):
| Field | Required | Constraints |
|-------|----------|-------------|
| `receipt` | Yes | JPEG/PNG/WEBP/PDF, ≤ 5 MB |

**Response 200** — success  
**Response 422** — file constraint violation  

---

### DELETE /api/expenses/{id}/receipt
Remove the receipt from an existing expense without deleting the expense itself.

**Path param**: `id` — expense ID  
**Response 204** — receipt removed  
**Response 404** — expense not found or no receipt attached  

---

### GET /api/expenses/{id}/receipt
Download/view the receipt image for an expense.

**Path param**: `id` — expense ID  
**Response 200** — file stream with appropriate `Content-Type`  
**Response 404** — expense or receipt not found  
**Security**: Server validates that the authenticated rider owns this expense before serving the file. Path is never derived from user input.

---

## Dashboard Contract Extension

`GET /api/dashboard` response — `DashboardTotals` gains new `expenseSummary` field:

```json
{
  "totals": {
    "currentMonthMiles": { ... },
    "yearToDateMiles": { ... },
    "allTimeMiles": { ... },
    "moneySaved": { ... },
    "expenseSummary": {
      "totalManualExpenses": 149.97,
      "oilChangeSavings": 89.99,
      "netExpenses": 59.98,
      "oilChangeIntervalCount": 1
    }
  },
  ...
}
```

When `oilChangeSavings` is `null` (oil change price not configured), `netExpenses` is also `null` and `oilChangeIntervalCount` reflects the interval count that would apply once a price is set.

---

## Frontend Service Contract

New TypeScript types in `src/services/expenses-api.ts`:

```typescript
interface RecordExpenseRequest {
  expenseDate: string      // YYYY-MM-DD
  amount: string           // decimal string
  notes?: string
  receipt?: File
}

interface ExpenseRow {
  expenseId: number
  expenseDate: string      // YYYY-MM-DD
  amount: number
  notes: string | null
  hasReceipt: boolean
  version: number
  createdAtUtc: string
}

interface ExpenseHistoryResponse {
  expenses: ExpenseRow[]
  totalAmount: number
  expenseCount: number
  generatedAtUtc: string
}

interface EditExpenseRequest {
  expenseDate: string
  amount: number
  notes?: string
  expectedVersion: number
}

interface DashboardExpenseSummary {
  totalManualExpenses: number
  oilChangeSavings: number | null
  netExpenses: number | null
  oilChangeIntervalCount: number
}
```
