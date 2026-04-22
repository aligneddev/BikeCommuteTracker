# API Contracts: Advanced Statistics Dashboard

**Branch**: `018-advanced-dashboard` | **Date**: 2026-04-22

---

## New Endpoint

### `GET /api/dashboard/advanced`

Returns the full advanced statistics payload for the authenticated user.

**Authentication**: Bearer token required (same as `GET /api/dashboard`)  
**Authorization**: User sees only their own data  
**Response**: `200 OK` → `AdvancedDashboardResponse`

---

## New Response Contracts (`AdvancedDashboardContracts.cs`)

```csharp
// Root response
public sealed record AdvancedDashboardResponse(
    AdvancedSavingsWindows SavingsWindows,
    IReadOnlyList<AdvancedDashboardSuggestion> Suggestions,
    AdvancedDashboardReminders Reminders,
    DateTime GeneratedAtUtc
);

// Four time-window breakdown
public sealed record AdvancedSavingsWindows(
    AdvancedSavingsWindow Weekly,
    AdvancedSavingsWindow Monthly,
    AdvancedSavingsWindow Yearly,
    AdvancedSavingsWindow AllTime
);

// Data for one time window
public sealed record AdvancedSavingsWindow(
    string Period,                    // "weekly" | "monthly" | "yearly" | "allTime"
    int RideCount,
    decimal TotalMiles,
    decimal? GallonsSaved,            // null when no rides have SnapshotAverageCarMpg
    decimal? FuelCostAvoided,         // null when no rides have calculable MPG + gas price
    bool FuelCostEstimated,           // true when any ride used fallback gas price
    decimal? MileageRateSavings,      // null when no rides have SnapshotMileageRateCents
    decimal? CombinedSavings          // FuelCostAvoided + MileageRateSavings; null when both null
);

// Rule-based suggestions
public sealed record AdvancedDashboardSuggestion(
    string SuggestionKey,    // "consistency" | "milestone" | "comeback"
    string Title,
    string Description,
    bool IsEnabled
);

// Reminder flags
public sealed record AdvancedDashboardReminders(
    bool MpgReminderRequired,          // true when AverageCarMpg is null in UserSettings
    bool MileageRateReminderRequired   // true when MileageRateCents is null in UserSettings
);
```

---

## Modified Contracts

### `DashboardEndpoints.cs` — added route

```csharp
endpoints
    .MapGet("/api/dashboard/advanced", GetAdvancedDashboardAsync)
    .RequireAuthorization()
    .WithName("GetAdvancedDashboard")
    .WithSummary("Get the authenticated rider advanced statistics dashboard")
    .Produces<AdvancedDashboardResponse>(StatusCodes.Status200OK)
    .Produces<ErrorResponse>(StatusCodes.Status401Unauthorized);
```

---

## Frontend TypeScript Types (`advanced-dashboard-api.ts`)

```typescript
export interface AdvancedDashboardResponse {
  savingsWindows: AdvancedSavingsWindows
  suggestions: AdvancedDashboardSuggestion[]
  reminders: AdvancedDashboardReminders
  generatedAtUtc: string
}

export interface AdvancedSavingsWindows {
  weekly: AdvancedSavingsWindow
  monthly: AdvancedSavingsWindow
  yearly: AdvancedSavingsWindow
  allTime: AdvancedSavingsWindow
}

export interface AdvancedSavingsWindow {
  period: 'weekly' | 'monthly' | 'yearly' | 'allTime'
  rideCount: number
  totalMiles: number
  gallonsSaved: number | null
  fuelCostAvoided: number | null
  fuelCostEstimated: boolean
  mileageRateSavings: number | null
  combinedSavings: number | null
}

export interface AdvancedDashboardSuggestion {
  suggestionKey: 'consistency' | 'milestone' | 'comeback'
  title: string
  description: string
  isEnabled: boolean
}

export interface AdvancedDashboardReminders {
  mpgReminderRequired: boolean
  mileageRateReminderRequired: boolean
}
```

---

## Modified Frontend

### `App.tsx` — new route

```tsx
<Route path="/dashboard/advanced" element={<AdvancedDashboardPage />} />
```
_(Inside the existing `ProtectedRoute` wrapper)_

### `app-header.tsx` — new NavLink (after "Dashboard")

```tsx
<NavLink
  to="/dashboard/advanced"
  className={({ isActive }) => isActive ? 'nav-link nav-link-active' : 'nav-link'}
>
  Advanced Stats
</NavLink>
```

### `dashboard-page.tsx` — card action link

A `<Link to="/dashboard/advanced">` styled as a secondary card action below the MoneySaved section, using existing CSS classes (no new CSS required).

---

## Contract Stability Notes

- Existing `GET /api/dashboard` and `DashboardResponse` are **unchanged**
- New contracts are purely additive
- `AdvancedDashboardSuggestion` uses a narrower `SuggestionKey` discriminant compared to `DashboardMetricSuggestion.MetricKey` — they are separate types and should not be merged
