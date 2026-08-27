# Quickstart Validation: CO2 Savings on Advanced Dashboard

Use this to validate spec #29 end-to-end after implementation.

## Prerequisites

1. Run app stack:
   - `dotnet run --project src/BikeTracking.AppHost`
2. Have a rider account with ride data containing miles across at least the current week/month/year (and optionally a rider with zero rides, to verify the zero/edge-case path).

## Backend Validation

1. Run backend tests:
   - `dotnet test BikeTracking.slnx`
2. Confirm F# calculation tests (`AdvancedDashboardCalculations`) assert:
   - `calculateCo2Saved` returns `totalMiles * 0.90` rounded to 2 decimal places.
   - Zero miles returns `0.00m`, not an exception, null, or NaN.
3. Confirm `GetAdvancedDashboardServiceTests` assert:
   - `co2Saved` is present on all four windows (weekly, monthly, yearly, allTime) and matches `totalMiles * 0.90` within 0.01.
   - `co2SavedPerMileLbs` is `0.90` on the response, present even for a rider with zero rides.
   - CO2 values do not change when user MPG/mileage-rate settings are changed (only ride miles affect it).

## Frontend Validation

1. Run frontend unit tests:
   - `cd src/BikeTracking.Frontend && npm run test:unit`
2. Run E2E tests:
   - `cd src/BikeTracking.Frontend && npm run test:e2e`
3. Confirm tests verify:
   - A "CO2 Saved" value renders for each of the four savings-window rows, formatted to 2 decimal places with a unit label (e.g., "22.05 lb").
   - The CO2-saved-per-mile figure ("0.90 lb CO2/mile") renders once near the totals.
   - Changing the underlying ride data (or reloading) recalculates the CO2 total; no stale/cached value persists across reloads.
   - A window with zero miles shows "0.00 lb" (not blank or an error).

## Manual Check

1. Log in and open the advanced dashboard (`/advanced-dashboard` or equivalent route).
2. Verify the savings breakdown table shows a CO2 Saved value for This Week, This Month, This Year, and All Time.
3. Verify the CO2 saved-per-mile figure is visible near the totals.
4. Verify: (per-mile figure) × (a window's Miles value) ≈ that window's CO2 Saved value, within 0.01 lb.
5. Verify a rider/period with no rides shows CO2 Saved as "0.00 lb", and the per-mile figure still displays.
6. Verify CO2 values are not stored: reload the page and confirm the value is recomputed (no persisted/stale value if ride data changed since last load).

## Final Validation Matrix

| Area | Command/Check | Expected Result |
|------|----------------|-----------------|
| F# calculation unit tests | `dotnet test BikeTracking.slnx` (domain test project) | Pass; `calculateCo2Saved` returns correct rounded value and `0.00m` for zero miles |
| Backend service tests | `dotnet test BikeTracking.slnx` (`GetAdvancedDashboardServiceTests`) | Pass; all four windows expose `co2Saved`; response exposes `co2SavedPerMileLbs = 0.90` |
| Frontend unit suite | `cd src/BikeTracking.Frontend && npm run test:unit` | Pass; `SavingsWindowsTable` renders CO2 values and per-mile figure with correct formatting |
| Frontend E2E suite | `cd src/BikeTracking.Frontend && npm run test:e2e` | Pass; CO2 totals and per-mile figure visible on advanced dashboard |
| Manual dashboard check | Open advanced dashboard after login | CO2 Saved visible for all four windows; per-mile figure visible; totals ≈ per-mile × miles; zero-ride case shows 0.00 lb |

## Command Checklist

- [ ] `dotnet test BikeTracking.slnx`
- [ ] `cd src/BikeTracking.Frontend && npm run test:unit`
- [ ] `cd src/BikeTracking.Frontend && npm run test:e2e`

## References

- Spec: [spec.md](spec.md)
- Research: [research.md](research.md)
- Data model: [data-model.md](data-model.md)
- Contract: [contracts/advanced-dashboard-co2-contract.md](contracts/advanced-dashboard-co2-contract.md)
