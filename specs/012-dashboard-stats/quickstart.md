# Developer Quickstart: Rider Dashboard Statistics

**Feature**: 012-dashboard-stats  
**Branch**: `012-dashboard-stats`  
**Date**: 2026-04-06

---

## Overview

This feature replaces the current minimal miles landing page with a dashboard backed by a dedicated
API endpoint. The dashboard shows current-month, year-to-date, and all-time mileage; money saved
from mileage-rate and MPG-based formulas; average temperature; average miles per ride; average ride
duration; and two baseline charts. Historical accuracy comes from snapshotting calculation-relevant
user settings into each ride and ride event at save time.

---

## Prerequisites

- DevContainer running
- App launch path available: `dotnet run --project src/BikeTracking.AppHost`
- Existing ride, settings, and login flows already working
- Follow strict TDD: write failing tests first, run them, and get user confirmation before implementation

---

## Implementation Order

### Step 1 — Contracts first

Create/modify:

```text
src/BikeTracking.Api/Contracts/
  DashboardContracts.cs          ← new
  UsersContracts.cs              ← extend settings DTOs
```

Then wire endpoint shell:

```text
src/BikeTracking.Api/Endpoints/
  DashboardEndpoints.cs          ← new
```

Goal: lock the backend/frontend contract before changing services or UI.

---

### Step 2 — Persist dashboard-related data

Modify:

```text
src/BikeTracking.Api/Infrastructure/Persistence/Entities/
  RideEntity.cs                  ← add snapshot columns
  UserSettingsEntity.cs          ← add optional metric preference booleans

src/BikeTracking.Api/Infrastructure/Persistence/
  BikeTrackingDbContext.cs       ← configure new columns/defaults/constraints
```

Create migration:

```bash
cd src/BikeTracking.Api
dotnet ef migrations add AddDashboardSnapshotsAndPreferences
```

Update:

```text
src/BikeTracking.Api.Tests/Infrastructure/MigrationTestCoveragePolicyTests.cs
```

---

### Step 3 — Snapshot settings during ride writes

Modify:

```text
src/BikeTracking.Api/Application/Rides/
  RecordRideService.cs
  EditRideService.cs

src/BikeTracking.Api/Application/Events/
  RideRecordedEventPayload.cs
  RideEditedEventPayload.cs
```

Logic:
- Load current user settings when saving a ride.
- Copy relevant setting values into ride snapshot columns.
- Copy the same values into the event payload factory call.

---

### Step 4 — Build the dashboard query service

Create:

```text
src/BikeTracking.Api/Application/Dashboard/
  GetDashboardService.cs
```

Responsibilities:
- aggregate month/year/all-time totals
- compute average temperature, miles per ride, ride duration
- compute mileage-rate savings and fuel-cost avoided from ride snapshots
- build last-12-month chart series
- count missing-data exclusions
- expose gallons-avoided and goal-progress suggestions with current enablement state

---

### Step 5 — Extend settings flow for optional metric approvals

Modify:

```text
src/BikeTracking.Api/Application/Users/UserSettingsService.cs
src/BikeTracking.Api/Endpoints/UsersEndpoints.cs
src/BikeTracking.Frontend/src/services/users-api.ts
src/BikeTracking.Frontend/src/pages/settings/SettingsPage.tsx
```

Goal: let riders approve `gallonsAvoided` and `goalProgress` before those metrics appear.

---

### Step 6 — Add dashboard frontend

Create/modify:

```text
src/BikeTracking.Frontend/src/services/
  dashboard-api.ts
  dashboard-api.test.ts

src/BikeTracking.Frontend/src/components/ui/
  chart.tsx                      ← local ShadCN-style wrapper for Recharts

src/BikeTracking.Frontend/src/components/dashboard/
  ...                            ← cards, chart sections, missing-data callouts

src/BikeTracking.Frontend/src/pages/dashboard/
  dashboard-page.tsx
  dashboard-page.css
  dashboard-page.test.tsx

src/BikeTracking.Frontend/src/App.tsx
src/BikeTracking.Frontend/src/components/app-header/app-header.tsx
```

Route behavior:
- authenticated landing page becomes dashboard
- legacy `/miles` route redirects to dashboard

---

## Verification Commands

Run after each meaningful slice, not just at the end:

```bash
dotnet test BikeTracking.slnx

cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit

cd src/BikeTracking.Frontend && npm run test:e2e
```

Formatting before merge:

```bash
csharpier format .
```

---

## TDD Test Plan

Write these tests first, run them red, and get user confirmation before implementing.

### Backend unit tests

`GetDashboardServiceTests.cs`

| Test | What it proves |
|------|----------------|
| Returns zeroed mileage cards and empty series for riders with no rides | Empty-state dashboard is supported |
| Aggregates current month, current year, and all time miles correctly | Core headline totals are correct |
| Computes average miles per ride from all rides | Requested average metric is correct |
| Computes average ride duration only from rides with duration | Missing-duration handling is correct |
| Computes average temperature only from rides with temperature | Missing-temperature handling is correct |
| Computes mileage-rate savings from snapshot mileage rate | Historical mileage-rate math is correct |
| Computes fuel-cost avoided from snapshot MPG and saved gas price | Historical MPG-based savings math is correct |
| Excludes legacy rides without snapshots from savings totals and counts them in missing data | Safe fallback behavior is correct |

`RidesApplicationServiceTests.cs`

| Test | What it proves |
|------|----------------|
| RecordRideService copies current user settings into ride snapshot fields | New rides are historically accurate |
| RecordRideService includes snapshot fields in `RideRecordedEventPayload` | Event audit trail is complete |
| EditRideService refreshes snapshot fields from current settings on edit save | Edited rides use the new versioned assumptions |
| EditRideService includes snapshot fields in `RideEditedEventPayload` | Edited event audit trail is complete |

`UserSettingsServiceTests.cs`

| Test | What it proves |
|------|----------------|
| Saves dashboard optional metric preferences when explicitly provided | Approval state persists |
| Leaves existing approval values unchanged when omitted from partial update | Partial update semantics are preserved |
| Returns approval values in `UserSettingsResponse` | Frontend can render the saved state |

### Endpoint / integration tests

| Test | What it proves |
|------|----------------|
| `GET /api/dashboard` returns authenticated rider-scoped data only | Rider isolation is preserved |
| `GET /api/dashboard` returns empty-state payload for rider with no rides | Empty-state API contract is stable |
| `PUT /api/users/me/settings` round-trips dashboard approval booleans | Settings contract extension works |
| Migration coverage test includes new migration entry | Constitution migration rule is satisfied |

### Frontend unit tests

| Test | What it proves |
|------|----------------|
| Dashboard page loads and renders headline cards from API data | Main page UI contract works |
| Dashboard page renders missing-data notice for partial savings | Partial-data UX is clear |
| Dashboard page renders chart sections with provided series | Chart container wiring is correct |
| Settings page shows and saves optional metric approvals | Approval UI works |
| App routing sends authenticated users to dashboard and legacy `/miles` redirects | Main-page behavior is correct |

### E2E tests

| Test | What it proves |
|------|----------------|
| Authenticated login lands on dashboard instead of the old miles shell | Main-page requirement is satisfied |
| Recording a ride updates dashboard mileage and averages | Dashboard reflects new ride data |
| Changing user settings does not retroactively change old ride savings totals | Historical accuracy works end to end |
| Approving gallons avoided and goal progress makes those optional metrics appear | Suggest-first behavior works |
