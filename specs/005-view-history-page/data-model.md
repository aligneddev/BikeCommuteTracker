# Data Model: Ride History Page

**Branch**: `005-view-history-page` | **Date**: 2026-03-26

## Overview

This feature introduces a read-oriented history query model for authenticated riders. It does not create new write-side domain events; it aggregates existing `RideRecorded` data into paged rows and period summaries.

## Entities

### DateRangeFilter

Represents rider-supplied date boundaries used to scope visible rides and filtered totals.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| from | string (date) | No | valid date when present | Inclusive lower boundary |
| to | string (date) | No | valid date when present | Inclusive upper boundary |

Rules:
- If both `from` and `to` are present, `from <= to` must hold.
- If omitted, the history is unbounded (all rides).

### RideHistoryRow

Projection row for display in the TanStack grid.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| rideId | integer | Yes | Unique ride record identity |
| rideDateTimeLocal | string (date-time) | Yes | Rider-entered local ride date/time |
| miles | number | Yes | Miles for this ride (> 0) |
| rideMinutes | integer | No | Optional duration in minutes |
| temperature | number | No | Optional recorded temperature |

### MileageSummary

Aggregated miles for a defined period.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| miles | number | Yes | Sum of miles for period, `0` when no rides |
| rideCount | integer | Yes | Number of rides included in period |
| period | string | Yes | `thisMonth`, `thisYear`, `allTime`, or `filtered` |

### RideHistoryResponse

API query response payload containing both summaries and paged rows.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| summaries.thisMonth | MileageSummary | Yes | Current-month summary |
| summaries.thisYear | MileageSummary | Yes | Current-year summary |
| summaries.allTime | MileageSummary | Yes | Lifetime summary |
| filteredTotal | MileageSummary | Yes | Total for current filter result set |
| rides | array<RideHistoryRow> | Yes | Rows for current page/filter |
| page | integer | Yes | Current page number (1-based) |
| pageSize | integer | Yes | Rows per page |
| totalRows | integer | Yes | Total rows matching filter across all pages |

## Relationships

- One authenticated rider has many `RideHistoryRow` records derived from persisted ride events.
- Each `MileageSummary` aggregates over the rider's ride rows for a specific period.
- `filteredTotal` aggregates over exactly the same filtered set represented by `totalRows`.

## State Transitions

1. Rider opens History page.
2. Frontend requests `GET /api/rides/history` with optional `from`, `to`, `page`, `pageSize`.
3. API validates filter and auth context.
4. API queries rider-specific ride projections/events and computes summaries.
5. Frontend renders summary cards + TanStack grid + filtered total.
6. Rider adjusts date range; frontend re-requests endpoint and rerenders.
