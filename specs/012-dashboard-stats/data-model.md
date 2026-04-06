# Data Model: Rider Dashboard Statistics

**Feature**: 012-dashboard-stats  
**Date**: 2026-04-06  
**Status**: Complete

---

## Overview

This feature introduces three data-model changes:

1. Extend `RideEntity` with a calculation snapshot captured from user settings at ride create/edit time.
2. Extend `UserSettingsEntity` with two dashboard optional-metric approval preferences.
3. Introduce a dashboard query response model that aggregates cards, averages, chart series, and
   optional metric suggestions for the frontend.

No new table is required if dashboard approvals are stored on the existing `UserSettings` row.

---

## Existing Entity: `RideEntity` (extensions only)

File: `src/BikeTracking.Api/Infrastructure/Persistence/Entities/RideEntity.cs`

**Existing fields used by the dashboard**:

| Field | Type | Notes |
|-------|------|-------|
| `RiderId` | `long` | Rider scoping |
| `RideDateTimeLocal` | `DateTime` | Month/year/all-time bucketing |
| `Miles` | `decimal` | Mileage totals and averages |
| `RideMinutes` | `int?` | Average ride duration |
| `Temperature` | `decimal?` | Average temperature |
| `GasPricePerGallon` | `decimal?` | Fuel-cost avoided calculation |

**New snapshot fields**:

| Field | Type | Notes |
|-------|------|-------|
| `SnapshotAverageCarMpg` | `decimal?` | Historical fuel-economy assumption for this ride |
| `SnapshotMileageRateCents` | `decimal?` | Historical mileage-rate assumption for this ride |
| `SnapshotYearlyGoalMiles` | `decimal?` | Historical yearly goal available for progress calculations |
| `SnapshotOilChangePrice` | `decimal?` | Forward-compatible snapshot for later maintenance savings |

**Validation / semantics**:
- Snapshot fields are nullable because older rides will not have them.
- Positive-value constraints should mirror the corresponding user settings rules.
- Snapshot fields are written from current user settings on ride create and overwritten with current
  user settings again when a ride is edited.

---

## Existing Entity: `UserSettingsEntity` (extensions only)

File: `src/BikeTracking.Api/Infrastructure/Persistence/Entities/UserSettingsEntity.cs`

**Existing fields reused by this feature**:

| Field | Type | Notes |
|-------|------|-------|
| `AverageCarMpg` | `decimal?` | Snapshot source |
| `YearlyGoalMiles` | `decimal?` | Snapshot source and optional metric source |
| `OilChangePrice` | `decimal?` | Snapshot source for future options |
| `MileageRateCents` | `decimal?` | Snapshot source |

**New preference fields**:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `DashboardGallonsAvoidedEnabled` | `bool` | `false` | Approved optional metric visibility |
| `DashboardGoalProgressEnabled` | `bool` | `false` | Approved optional metric visibility |

**Validation / semantics**:
- These are current user preferences, not historical data.
- They participate in the existing partial-update settings flow.

---

## Extended Event Payloads

Files:
- `src/BikeTracking.Api/Application/Events/RideRecordedEventPayload.cs`
- `src/BikeTracking.Api/Application/Events/RideEditedEventPayload.cs`

**New event fields**:

| Field | Type | Source |
|-------|------|--------|
| `SnapshotAverageCarMpg` | `decimal?` | Current user settings at save time |
| `SnapshotMileageRateCents` | `decimal?` | Current user settings at save time |
| `SnapshotYearlyGoalMiles` | `decimal?` | Current user settings at save time |
| `SnapshotOilChangePrice` | `decimal?` | Current user settings at save time |

These fields preserve the audit trail needed for historically accurate analytics.

---

## New Query Model: `DashboardResponse`

File: `src/BikeTracking.Api/Contracts/DashboardContracts.cs`

### `DashboardResponse`

| Field | Type | Notes |
|-------|------|-------|
| `Totals` | `DashboardTotals` | Headline mileage and savings cards |
| `Averages` | `DashboardAverages` | Average temperature, miles/ride, ride duration |
| `Charts` | `DashboardCharts` | Monthly mileage and monthly savings series |
| `Suggestions` | `IReadOnlyList<DashboardMetricSuggestion>` | Optional metrics available for approval |
| `MissingData` | `DashboardMissingData` | Counts for rides excluded from partial calculations |
| `GeneratedAtUtc` | `DateTime` | Response timestamp |

### `DashboardTotals`

| Field | Type | Notes |
|-------|------|-------|
| `CurrentMonthMiles` | `DashboardMileageMetric` | Current local month total |
| `YearToDateMiles` | `DashboardMileageMetric` | Current local year total |
| `AllTimeMiles` | `DashboardMileageMetric` | Lifetime total |
| `MoneySaved` | `DashboardMoneySaved` | Mileage-rate and MPG-based savings |

### `DashboardMoneySaved`

| Field | Type | Notes |
|-------|------|-------|
| `MileageRateSavings` | `decimal?` | Sum of mileage-rate formula for qualifying rides |
| `FuelCostAvoided` | `decimal?` | Sum of fuel-cost formula for qualifying rides |
| `CombinedSavings` | `decimal?` | Sum of both components when derivable |
| `QualifiedRideCount` | `int` | Number of rides contributing to at least one savings calculation |

### `DashboardAverages`

| Field | Type | Notes |
|-------|------|-------|
| `AverageTemperature` | `decimal?` | Only rides with saved temperature |
| `AverageMilesPerRide` | `decimal?` | All rides with miles |
| `AverageRideMinutes` | `decimal?` | Only rides with duration |

### `DashboardCharts`

| Field | Type | Notes |
|-------|------|-------|
| `MileageByMonth` | `IReadOnlyList<DashboardMileagePoint>` | Last 12 months |
| `SavingsByMonth` | `IReadOnlyList<DashboardSavingsPoint>` | Last 12 months |

### `DashboardMetricSuggestion`

| Field | Type | Notes |
|-------|------|-------|
| `MetricKey` | `string` | Stable key (`gallonsAvoided`, `goalProgress`) |
| `Title` | `string` | UI label |
| `Description` | `string` | Why the metric might be useful |
| `IsEnabled` | `bool` | Current user preference state |

### `DashboardMissingData`

| Field | Type | Notes |
|-------|------|-------|
| `RidesMissingSavingsSnapshot` | `int` | Legacy rides missing calculation snapshot data |
| `RidesMissingGasPrice` | `int` | Rides that cannot participate in fuel-cost avoided |
| `RidesMissingTemperature` | `int` | Rides excluded from temperature average |
| `RidesMissingDuration` | `int` | Rides excluded from average ride duration |

---

## Relationships

- One rider has one `UserSettingsEntity` row.
- One rider has many `RideEntity` rows.
- Each ride captures a snapshot of selected values from the rider’s settings row at save time.
- The dashboard query is rider-scoped and aggregates only that rider’s rides plus that rider’s
  current optional-metric approval settings.

---

## State Transitions

### Ride Create

```text
RecordRideRequest received
  → load current UserSettingsEntity for rider
  → copy current calculation settings into RideEntity snapshot columns
  → save RideEntity
  → emit RideRecordedEventPayload containing the same snapshot values
```

### Ride Edit

```text
EditRideRequest received
  → load current UserSettingsEntity for rider
  → overwrite ride snapshot columns with current calculation settings
  → save updated RideEntity version
  → emit RideEditedEventPayload containing the updated snapshot values
```

### Optional Metric Approval

```text
User approves gallons avoided and/or goal progress
  → PUT /api/users/me/settings with dashboard preference booleans
  → UserSettingsEntity updated
  → subsequent dashboard queries mark approved suggestions as enabled and render those metrics
```

### Dashboard Query

```text
GET /api/dashboard
  → load all rider rides and current user settings
  → bucket rides into current month, current year, all time, and last 12 monthly chart points
  → compute averages and savings using ride snapshots when present
  → count rides excluded by missing data rules
  → return dashboard response DTO
```
