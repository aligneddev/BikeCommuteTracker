# Data Model: Advanced Statistics Dashboard

**Branch**: `018-advanced-dashboard` | **Date**: 2026-04-22

## Summary

No new database tables or migrations are required. This feature is a read-only aggregation of existing tables. All source data is already persisted by earlier specs.

---

## Existing Tables Used (read-only)

### `Rides` table

Key columns used by the advanced dashboard service:

| Column | Type | Used For |
|--------|------|----------|
| `RiderId` | `BIGINT` | Filter rides to authenticated user |
| `RideDateTimeLocal` | `DATETIME` | Time-window bucketing (week/month/year) |
| `Miles` | `DECIMAL` | Distance base for all savings calculations |
| `SnapshotAverageCarMpg` | `DECIMAL?` | Gallons-saved calculation (ride-date snapshot) |
| `SnapshotMileageRateCents` | `INT?` | Mileage-rate savings calculation (ride-date snapshot) |
| `GasPricePerGallon` | `DECIMAL?` | Fuel-cost-avoided calculation; NULL = fallback needed |

### `UserSettings` table

| Column | Type | Used For |
|--------|------|----------|
| `UserId` | `BIGINT` | Join to authenticated user |
| `AverageCarMpg` | `DECIMAL?` | NULL = show MPG reminder card |
| `MileageRateCents` | `INT?` | NULL = show mileage-rate reminder card |

### `GasPriceLookups` table

| Column | Type | Used For |
|--------|------|----------|
| `PriceDate` | `DATE` | Find most recent price on or before ride date |
| `PricePerGallon` | `DECIMAL` | Fallback gas price when `Rides.GasPricePerGallon IS NULL` |

---

## Derived Calculations (computed at query time, not persisted)

### Time Window Bucketing

Four windows computed per request:

| Window | Definition | C# Expression |
|--------|-----------|----------------|
| Weekly | Current ISO calendar week (Mon–Sun) | `RideDateTimeLocal >= weekStart && < weekStart.AddDays(7)` |
| Monthly | Current calendar month | `RideDateTimeLocal.Month == now.Month && .Year == now.Year` |
| Yearly | Current calendar year | `RideDateTimeLocal.Year == now.Year` |
| All-time | All user rides | _(no date filter)_ |

### Gallons Saved (per window)

```
gallon_saved_for_ride = ride.Miles / ride.SnapshotAverageCarMpg
total_gallons_saved   = Σ gallons_saved_for_ride  (where SnapshotAverageCarMpg > 0)
```

Fallback: if `SnapshotAverageCarMpg IS NULL`, ride contributes 0 gallons.

### Fuel Cost Avoided (per window)

```
effective_price(ride) = ride.GasPricePerGallon
                        ?? latestKnownGasPrice(GasPriceLookups, ride.RideDateTimeLocal)
                        ?? 0

fuel_cost_avoided_for_ride = (ride.Miles / ride.SnapshotAverageCarMpg) × effective_price(ride)
total_fuel_cost_avoided    = Σ fuel_cost_avoided_for_ride

fuel_cost_estimated = any ride in window has GasPricePerGallon IS NULL
```

### Mileage Rate Savings (per window)

```
mileage_rate_savings_for_ride = ride.Miles × ride.SnapshotMileageRateCents / 100
total_mileage_rate_savings     = Σ mileage_rate_savings_for_ride

mileage_rate_savings = null if no rides have SnapshotMileageRateCents set
```

### Rule-Based Suggestions

| Suggestion | Computation |
|------------|-------------|
| Consistency | Count rides in current ISO week; IsEnabled = count >= 1 |
| Milestone | Compute all-time combined savings; compare against $10/$50/$100/$500 thresholds; IsEnabled = highest crossed threshold exists |
| Comeback | Days since last ride = (now - lastRide.RideDateTimeLocal).Days; IsEnabled = days > 7 && totalRideCount >= 1 |

### Reminder Flags

| Flag | Condition |
|------|-----------|
| `MpgReminderRequired` | `UserSettings.AverageCarMpg IS NULL` |
| `MileageRateReminderRequired` | `UserSettings.MileageRateCents IS NULL` |

---

## No Schema Changes

This feature requires zero EF Core migrations. All required columns were introduced by earlier specs:
- `SnapshotAverageCarMpg`, `SnapshotMileageRateCents` → spec 012
- `GasPricePerGallon` → spec 010
- `GasPriceLookups` table → spec 010
- `AverageCarMpg`, `MileageRateCents` in `UserSettings` → spec 009/012
