# Contract: Advanced Dashboard CO2 Savings

Base endpoint: `GET /api/advanced-dashboard` (existing endpoint backing `GetAdvancedDashboardService`)

This feature extends the existing advanced-dashboard response with a CO2-saved figure per savings window and a single fixed CO2-saved-per-mile constant. No new endpoint is introduced.

## Response Fragment (savings windows + top-level constant)

```json
{
  "savingsWindows": {
    "weekly": {
      "period": "weekly",
      "rideCount": 3,
      "totalMiles": 24.5,
      "gallonsSaved": 0.98,
      "fuelCostAvoided": 3.43,
      "fuelCostEstimated": false,
      "mileageRateSavings": 16.17,
      "combinedSavings": 19.60,
      "totalExpenses": 0,
      "oilChangeSavings": null,
      "netSavings": 3.43,
      "co2Saved": 22.05
    },
    "monthly": { "...": "same shape, co2Saved added" },
    "yearly": { "...": "same shape, co2Saved added" },
    "allTime": { "...": "same shape, co2Saved added" }
  },
  "co2SavedPerMileLbs": 0.90
}
```

## Field Additions

1. **`savingsWindows.<period>.co2Saved`** (`number`, non-nullable)
   - Present on all four windows: `weekly`, `monthly`, `yearly`, `allTime`.
   - Computed as `totalMiles * 0.90`, rounded to 2 decimal places.
   - `0` (not `null`) when the window has zero ride miles.
   - Never varies with user MPG or mileage-rate settings.

2. **`co2SavedPerMileLbs`** (`number`, non-nullable, response-level — not nested per window)
   - Fixed constant `0.90`.
   - Present even when the rider has zero rides across all windows.
   - `savingsWindows.<period>.co2Saved` MUST equal `co2SavedPerMileLbs * savingsWindows.<period>.totalMiles` within 0.01 (per SC-003).

## Consumer Rules for Spec #29

1. Render a "CO2 Saved" value for each of the four savings-window rows in `SavingsWindowsTable`, formatted to 2 decimal places with a clearly labeled unit (e.g., `"22.05 lb"`).
2. Render the CO2-saved-per-mile figure once, near the CO2 totals (e.g., `"0.90 lb CO2/mile"`), not repeated per row.
3. Treat `co2Saved` as always-present and non-null; render `"0.00 lb"` for zero-mile windows rather than a blank/dash placeholder (unlike `gallonsSaved`/`fuelCostAvoided`, which use `null` + `"—"` for missing-data cases).
4. Backend and frontend tests must assert: (a) each window's `co2Saved` matches `totalMiles * co2SavedPerMileLbs` within 0.01, (b) a zero-mile window yields `co2Saved: 0`, and (c) `co2SavedPerMileLbs` is present and equal to `0.90` even when all windows have zero rides.

## Formula Requirements (Spec Source of Truth)

- CO2 saved (per window) = `windowTotalMiles * co2SavedPerMileLbs`, rounded to 2 decimal places.
- `co2SavedPerMileLbs` = fixed constant `0.90` lb CO2/mile (EPA average passenger-vehicle emission factor, ~404 g/mile) — independent of `AverageCarMpg`, `MileageRateCents`, or any other user setting.

Backend contracts (`AdvancedDashboardContracts.cs`) and frontend TypeScript models/tests (`advanced-dashboard-api.ts`, `SavingsWindowsTable.tsx`/`.test.tsx`) must stay synchronized for these new fields in the same change.
