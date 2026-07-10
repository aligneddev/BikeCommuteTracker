# Quickstart Validation: Split Savings Display Metrics

Use this to validate spec #27 end-to-end after implementation.

## Prerequisites

1. Run app stack:
   - `dotnet run --project src/BikeTracking.AppHost`
2. Have a rider account with ride data containing miles and savings-related snapshot data.

## Backend Validation

1. Run backend tests:
   - `dotnet test BikeTracking.slnx`
2. Confirm dashboard aggregation tests assert both formulas independently (mileage-rate and gallons-based).

## Frontend Validation

1. Run frontend unit tests:
   - `cd src/BikeTracking.Frontend && npm run test:unit`
2. Run E2E tests:
   - `cd src/BikeTracking.Frontend && npm run test:e2e`
3. Confirm tests verify:
   - Both labels render: **Mileage rate savings** and **Gallons-based savings**
   - Both values render simultaneously
   - No merged single-total savings display in the target view

## Manual Check

1. Log in and open dashboard/results view.
2. Verify two separate savings lines are present with expected labels.
3. Verify values match spec formulas.
4. Verify formatting/rounding behavior matches prior behavior.
5. Verify zero values still render (not hidden).

## Final Validation Matrix

| Area | Command/Check | Expected Result |
|------|----------------|-----------------|
| Backend suite | `dotnet test BikeTracking.slnx` | Pass; dashboard tests assert split formulas and no merged field in `/api/dashboard` payload |
| Frontend unit suite | `cd src/BikeTracking.Frontend && npm run test:unit` | Pass; dashboard page tests assert both labels, rounded currency values, and zero-value visibility |
| Frontend E2E suite | `cd src/BikeTracking.Frontend && npm run test:e2e` | Pass; split savings rows render together and merged savings label is absent |
| Manual dashboard check | Open dashboard/results after login | Both split labels visible with correctly formatted values and no merged line |

## Command Checklist

- [ ] `dotnet test BikeTracking.slnx`
- [ ] `cd src/BikeTracking.Frontend && npm run test:unit`
- [ ] `cd src/BikeTracking.Frontend && npm run test:e2e`

## References

- Spec: [spec.md](spec.md)
- Data model: [data-model.md](data-model.md)
- Contract: [contracts/dashboard-split-savings-contract.md](contracts/dashboard-split-savings-contract.md)
