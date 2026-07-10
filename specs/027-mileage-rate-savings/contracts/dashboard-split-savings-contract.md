# Contract: Dashboard Split Savings Metrics

Base endpoint: `GET /api/dashboard`

This feature keeps the existing dashboard endpoint and requires the consumer-facing savings section to expose two independently displayable metrics in the response consumed by the dashboard page.

## Response Fragment (savings section)

```json
{
  "totals": {
    "moneySaved": {
      "mileageRateSavings": 42.5,
      "fuelCostAvoided": 18.2,
      "qualifiedRideCount": 7
    }
  }
}
```

## Consumer Rules for Spec #27

1. Render **Mileage rate savings** from `totals.moneySaved.mileageRateSavings`.
2. Render **Gallons-based savings** from `totals.moneySaved.fuelCostAvoided` (field name remains unchanged in this feature).
3. `totals.moneySaved.combinedSavings` is removed from this contract for the split-savings scope.
4. Preserve existing currency formatting and rounding conventions.
5. Backend and frontend assertions must explicitly verify split fields are present and `combinedSavings` is absent in `totals.moneySaved`.

## Formula Requirements (Spec Source of Truth)

- Mileage rate savings = `mileageRate * miles`
- Gallons-based savings = `gallonsSaved * miles`

Backend contracts and frontend TypeScript models/tests must stay synchronized for these existing fields in the same change.
