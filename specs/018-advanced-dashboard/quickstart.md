# Quickstart: Advanced Statistics Dashboard

**Branch**: `018-advanced-dashboard` | **Date**: 2026-04-22

This guide walks a developer through implementing spec 018 end-to-end, following the mandatory TDD red-green-refactor cycle.

---

## Prerequisites

- DevContainer running (`.devcontainer`)
- Full solution builds: `dotnet build BikeTracking.slnx`
- Frontend dependencies installed: `npm ci --prefix src/BikeTracking.Frontend`
- Existing tests pass: `dotnet test BikeTracking.slnx && npm run test:unit --prefix src/BikeTracking.Frontend`

---

## Step 1 — Write Failing Backend Tests (RED)

Create `src/BikeTracking.Api.Tests/Application/Dashboard/GetAdvancedDashboardServiceTests.cs` with the following failing test cases before writing any implementation:

```csharp
// Test: gallons saved are calculated per time window using SnapshotAverageCarMpg
[Fact]
public async Task GetAsync_WithRidesInMultipleWindows_ReturnsCorrectGallonsSavedPerWindow()

// Test: FuelCostEstimated = true when any ride in window has null GasPricePerGallon
[Fact]
public async Task GetAsync_WithRideMissingGasPrice_FlagsFuelCostEstimatedTrue()

// Test: MpgReminderRequired = true when user has no AverageCarMpg setting
[Fact]
public async Task GetAsync_UserWithNoMpgSetting_ReturnsMpgReminderRequired()

// Test: MileageRateReminderRequired = true when user has no MileageRateCents setting
[Fact]
public async Task GetAsync_UserWithNoMileageRateSetting_ReturnsMileageRateReminderRequired()

// Test: comeback suggestion IsEnabled = true when last ride > 7 days ago
[Fact]
public async Task GetAsync_LastRideMoreThan7DaysAgo_ComebackSuggestionEnabled()

// Test: consistency suggestion IsEnabled = true when ≥1 ride this calendar week
[Fact]
public async Task GetAsync_RideThisCalendarWeek_ConsistencySuggestionEnabled()

// Test: milestone suggestion IsEnabled = true when combined savings crosses $50
[Fact]
public async Task GetAsync_CombinedSavingsExceedsMilestone_MilestoneSuggestionEnabled()

// Test: zero rides returns zero/null values gracefully (no divide-by-zero)
[Fact]
public async Task GetAsync_UserWithNoRides_ReturnsZeroValuesGracefully()
```

**Run and confirm RED:**
```bash
dotnet test src/BikeTracking.Api.Tests/BikeTracking.Api.Tests.csproj --filter "GetAdvancedDashboard"
```
→ All tests must fail (compilation error or assertion failure). Confirm failure reason is behavioral, not infrastructure.

**User must confirm RED before proceeding to implementation.**

---

## Step 2 — Write Failing Frontend Tests (RED)

Create test files before any component implementation:

**`src/BikeTracking.Frontend/src/services/advanced-dashboard-api.test.ts`**
```typescript
// Test: getAdvancedDashboard fetches /api/dashboard/advanced with auth header
// Test: getAdvancedDashboard returns typed AdvancedDashboardResponse
```

**`src/BikeTracking.Frontend/src/pages/advanced-dashboard/advanced-dashboard-page.test.tsx`**
```typescript
// Test: renders savings windows table with weekly/monthly/yearly/all-time rows
// Test: renders reminder card when mpgReminderRequired = true
// Test: renders reminder card when mileageRateReminderRequired = true
// Test: renders 3 suggestion items (consistency, milestone, comeback)
// Test: shows loading state while fetch in progress
// Test: shows error state when fetch fails
```

**`src/BikeTracking.Frontend/src/pages/advanced-dashboard/SavingsWindowsTable.test.tsx`**
```typescript
// Test: renders 4 rows (weekly, monthly, yearly, all-time)
// Test: shows "Estimated" badge on row when fuelCostEstimated = true
// Test: shows "—" for null values
```

**Run and confirm RED:**
```bash
npm run test:unit --prefix src/BikeTracking.Frontend
```

**User must confirm RED before proceeding.**

---

## Step 3 — Implement Backend (GREEN)

### 3a. Add contracts

Create `src/BikeTracking.Api/Contracts/AdvancedDashboardContracts.cs` — see [contracts/api-contracts.md](./contracts/api-contracts.md) for all record definitions.

### 3b. Implement F# pure helpers (optional but preferred)

Add `src/BikeTracking.Domain.FSharp/AdvancedDashboardCalculations.fs`:
- `calculateGallonsSaved : RideSnapshot list -> decimal option`
- `calculateFuelCostAvoided : RideSnapshot list -> decimal option * bool` (value + estimated flag)
- `calculateMileageRateSavings : RideSnapshot list -> decimal option`
- `buildSuggestions : RideHistory -> SuggestionResult list`

> **Implementation note**: The F# helpers in `AdvancedDashboardCalculations.fs` were created and cover the pure calculation logic. In the actual implementation, `GetAdvancedDashboardService` reimplements equivalent logic inline in C# for directness and to avoid an F#-interop layer in the hot path. The F# module remains available for future extraction or as a pure-function reference implementation. No behavioural difference exists between the two; all tests pass through the C# service layer.

### 3c. Implement service

Create `src/BikeTracking.Api/Application/Dashboard/GetAdvancedDashboardService.cs`:
- Inject `BikeTrackingDbContext`
- Load all rides for user, UserSettings, and GasPriceLookups in a single async batch
- Compute 4 windows by filtering rides by `RideDateTimeLocal`
- For each window: aggregate gallons, fuel cost, mileage rate; check estimated flag
- Build 3 rule-based suggestions with deterministic conditions
- Build reminder flags from UserSettings nullability
- Return `AdvancedDashboardResponse`

### 3d. Register service and endpoint

- Register `GetAdvancedDashboardService` in `Program.cs` (same pattern as `GetDashboardService`)
- Add `GET /api/dashboard/advanced` route in `DashboardEndpoints.cs` — see contracts doc

### 3e. Run tests

```bash
dotnet test src/BikeTracking.Api.Tests/BikeTracking.Api.Tests.csproj --filter "GetAdvancedDashboard"
```
→ All backend tests must be GREEN.

---

## Step 4 — Implement Frontend (GREEN)

### 4a. API service

Create `src/BikeTracking.Frontend/src/services/advanced-dashboard-api.ts`:
- Export `getAdvancedDashboard(token: string): Promise<AdvancedDashboardResponse>`
- Use `fetch('/api/dashboard/advanced', { headers: { Authorization: \`Bearer \${token}\` } })`

### 4b. Components

Create `SavingsWindowsTable.tsx` — renders a 4-row table (weekly/monthly/yearly/all-time) showing miles, gallons saved, fuel cost avoided (with "Estimated" badge when flagged), mileage rate savings, combined savings.

Create `AdvancedSuggestionsPanel.tsx` — renders up to 3 active suggestion cards (consistency, milestone, comeback). Hides disabled suggestions.

### 4c. Page

Create `advanced-dashboard-page.tsx`:
- Loads data from `getAdvancedDashboard`
- Shows loading spinner while fetching
- Shows error message if fetch fails  
- Renders reminder cards for MPG and mileage rate when flags are set
- Renders `SavingsWindowsTable` and `AdvancedSuggestionsPanel`
- Includes `<Link to="/dashboard">← Back to Dashboard</Link>`

### 4d. Register route

In `App.tsx`, inside `ProtectedRoute`, add:
```tsx
<Route path="/dashboard/advanced" element={<AdvancedDashboardPage />} />
```

### 4e. Add navigation entry points

In `app-header.tsx`: add "Advanced Stats" NavLink after "Dashboard" — see contracts doc.

In `dashboard-page.tsx`: add `<Link to="/dashboard/advanced">` card action in the savings section.

### 4f. Run frontend tests

```bash
npm run test:unit --prefix src/BikeTracking.Frontend
```
→ All frontend unit tests must be GREEN.

---

## Step 5 — Full CI Validation

```bash
dotnet test BikeTracking.slnx
cd src/BikeTracking.Frontend && npm run lint && npm run build && npm run test:unit
```

Start the app via Aspire, then run E2E:
```bash
dotnet run --project src/BikeTracking.AppHost
cd src/BikeTracking.Frontend && npm run test:e2e
```

**Expected E2E tests to add in `tests/e2e/`:**
- `advanced-dashboard.spec.ts`: navigate to advanced stats from main dashboard card link; verify savings windows table rendered; navigate via top nav; verify reminder cards shown when settings missing

---

## Step 6 — Consider Refactoring

Once all tests are green, review:
- Duplication between `GetDashboardService` and `GetAdvancedDashboardService` (e.g., shared window-bucketing helpers, savings aggregation helpers). Extract shared helpers only if reuse is genuine and tested.
- Ensure `AdvancedDashboardCalculations.fs` (F# pure functions) is covered by unit tests independently.

---

## Definition of Done

- [ ] All backend unit tests pass (`dotnet test`)
- [ ] All frontend unit tests pass (`npm run test:unit`)
- [ ] `npm run lint` and `npm run build` clean
- [ ] E2E tests for advanced dashboard pass
- [ ] Main dashboard existing tests still pass (no regressions)
- [ ] `csharpier format .` passes
- [ ] Branch rebased on `main`; PR created with GitHub issue reference
