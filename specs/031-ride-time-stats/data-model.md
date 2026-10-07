# Data Model: Riding Time Totals

**Feature**: `031-ride-time-stats` | **Date**: 2026-10-06

This feature adds **no persisted data**. It reads one existing column and adds a derived read-only value to three API response records.

## Source Entity (existing, unchanged)

### `RideEntity` (`src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs`)

| Field | Type | Notes |
|-------|------|-------|
| `RiderId` | `long` | Scopes all sums to the authenticated rider (FR-007) |
| `RideDateTimeLocal` | `DateTime` | Year scope: `>= Jan 1 {year}` and `< Jan 1 {year+1}` (existing year-stats filter) |
| `RideMinutes` | `int?` | Recorded duration. DB check `CK_Rides_RideMinutes_GreaterThanZero` guarantees `NULL` or `> 0` |

No migration. No new index. The existing per-rider ride queries already load these rows.

## Derived Value

### `TotalRideMinutes` (`int`, non-nullable)

```text
TotalRideMinutes(scope) = Σ ride.RideMinutes  for ride in scope where ride.RideMinutes is not null
                        = 0                    when no ride in scope has a duration
```

| Rule | Source |
|------|--------|
| Rides with `RideMinutes == null` are excluded, not counted as 0 | FR-004 |
| Only the authenticated rider's rides | FR-007 (existing `RiderId` filters) |
| Never stored or snapshotted; recomputed per request | Spec Assumption 2 |
| Always ≥ 0; never null | research.md Decision 2 |

Computed by `RidingTimeRules.SumRecordedRideMinutes(IEnumerable<RideEntity>)` (new, `Application/Dashboard`).

## Response Records (additive changes)

| Record | File | New field | Scope |
|--------|------|-----------|-------|
| `DashboardTotals` | `Contracts/DashboardContracts.cs` | `int TotalRideMinutes` | All rides for the rider |
| `AdvancedDashboardResponse` | `Contracts/AdvancedDashboardContracts.cs` | `int TotalRideMinutes` (before `DifficultySection`) | All rides for the rider |
| `YearStatsTotals` | `Contracts/DashboardContracts.cs` | `int TotalRideMinutes` | Rides in the requested calendar year |

Matching TypeScript interfaces gain `totalRideMinutes: number`:

| Interface | File |
|-----------|------|
| `DashboardTotals` | `src/BikeTracking.Frontend/src/services/dashboard-api.ts` |
| `YearStatsTotals` | `src/BikeTracking.Frontend/src/services/dashboard-api.ts` |
| `AdvancedDashboardResponse` | `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts` |

## Display Projection (frontend only)

`formatHoursMinutes(totalMinutes)` → `"{floor(total/60) with en-US grouping}h {total mod 60}m"`

| Input | Output |
|-------|--------|
| `0` | `0h 0m` |
| `45` | `0h 45m` |
| `120` | `2h 0m` |
| `2535` | `42h 15m` |
| `62550` | `1,042h 30m` |

## State Transitions

None. The value is read-only and derived. It changes only as a side effect of existing ride record, edit, delete, and import flows, and it is picked up on the next dashboard request.
