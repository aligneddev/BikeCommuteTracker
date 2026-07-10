# Feature Specification: Split Savings Display Metrics

**Feature Branch**: `027-mileage-rate-savings`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Split savings display into 2 separate metrics in dashboard/results view."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View two separate savings metrics (Priority: P1)

As a rider reviewing ride results, I want to see Mileage rate savings and Gallons-based savings as two distinct lines, so I can understand each savings calculation independently instead of a merged value.

**Why this priority**: This is the core business change and the primary user-facing outcome.

**Independent Test**: Open a ride summary with valid ride data and verify two separate savings lines are displayed with the correct labels and formulas.

**Acceptance Scenarios**:

1. **Given** a ride summary with valid `mileageRate`, `gallonsSaved`, and `miles`, **When** the dashboard/results view renders, **Then** it shows a line labeled "Mileage rate savings" with value `mileageRate * miles`.
2. **Given** a ride summary with valid `gallonsSaved` and `miles`, **When** the dashboard/results view renders, **Then** it shows a line labeled "Gallons-based savings" with value `gallonsSaved * miles`.
3. **Given** both savings lines are displayed, **When** a rider reviews the summary, **Then** the values are not merged into a single total.

---

### User Story 2 - Preserve existing presentation behavior (Priority: P2)

As a rider, I want the same units, currency formatting, and rounding behavior to remain unchanged while the savings values are split, so the display is consistent with existing expectations.

**Why this priority**: Prevents confusion and regression in trusted formatting while introducing the new split display.

**Independent Test**: Compare old and new display formatting on identical ride inputs and verify only metric separation changed.

**Acceptance Scenarios**:

1. **Given** a ride summary rendered before and after this feature, **When** values are displayed, **Then** units, currency format, and rounding rules remain unchanged.
2. **Given** ride data is entered through create/edit ride-entry flows, **When** this feature is enabled, **Then** create/edit behavior and persisted ride data shape remain unchanged.

---

### User Story 3 - Keep backend/frontend validation aligned (Priority: P3)

As a team maintaining both backend and frontend, we want automated tests and consumer contracts to reflect the two savings metrics, so regressions are caught quickly across layers.

**Why this priority**: Ensures confidence that formula and labeling changes are consistently enforced.

**Independent Test**: Run backend, frontend, and end-to-end automated tests and verify explicit coverage for both formulas and labels.

**Acceptance Scenarios**:

1. **Given** backend savings computation tests, **When** tests run, **Then** they assert both formulas independently.
2. **Given** frontend rendering tests, **When** tests run, **Then** they assert both labels and both separate values are shown.
3. **Given** an end-to-end ride summary flow, **When** tests run, **Then** both savings lines appear together on the same summary screen.
4. **Given** dashboard API responses are consumed by frontend types, **When** this feature is implemented, **Then** `combinedSavings` is removed from the `moneySaved` contract and automated tests verify backend/frontend alignment for remaining split fields.

### Edge Cases

- When either computed value is zero, both lines still render with zero-valued formatted output rather than hiding one metric.
- Negative or unexpected source values must follow existing validation/error-display behavior; this feature does not introduce new data-entry rules.
- Historical rides must render the two split metrics consistently, without mutating stored ride records.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate and display "Mileage rate savings" as `mileageRate * miles`. use SnapshotMileageRateCents if set for the current ride
- **FR-002**: System MUST calculate and display "Gallons-based savings" as `gallonsSaved * miles`.
- **FR-003**: System MUST render the two savings metrics as separate lines in the dashboard/results ride summary view.
- **FR-004**: System MUST NOT combine the two savings metrics into a single displayed total in that view.
- **FR-005**: System MUST preserve existing units, currency formatting, and rounding rules for both displayed metrics.
- **FR-006**: System MUST keep create/edit ride-entry flows unchanged and MUST keep persisted ride data shape unchanged.
- **FR-007**: System MUST remove `combinedSavings` from the dashboard `moneySaved` contract and MUST keep frontend-consumed contract/types and backend/frontend automated tests synchronized with remaining split fields (`mileageRateSavings`, `fuelCostAvoided`).
- **FR-008**: Automated test coverage MUST include backend formula validation, frontend label/value rendering validation, and end-to-end validation that both metrics appear on the same ride summary screen.

**Terminology Note**: User-facing label **"Gallons-based savings"** maps to dashboard contract field `totals.moneySaved.fuelCostAvoided`.

### Key Entities

- **Ride Summary Metrics**: The displayed savings values derived from ride inputs and settings for a single ride summary view.
- **Mileage Rate Savings**: Derived metric computed as `mileageRate * miles`, labeled "Mileage rate savings." 
- **Gallons-Based Savings**: Derived metric computed as `gallonsSaved * miles`, labeled "Gallons-based savings."

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of ride summary screens with valid ride data display two distinct savings lines with the specified labels.
- **SC-002**: In verification tests, 100% of the defined deterministic fixture matrix (minimum: zero-value, standard-value, snapshot-rate, missing-rate, and historical-ride cases) match expected values for both formulas independently.
- **SC-003**: 0 instances of merged single-total savings display remain in the dashboard/results ride summary view.
- **SC-004**: Backend, frontend, and end-to-end test suites each include at least one passing test that verifies both split savings metrics.

## Assumptions

- Existing ride data already includes the inputs needed to compute both savings metrics.
- Existing formatting and rounding logic is authoritative and reused unchanged.
- No new user roles or permissions are needed for showing split savings metrics.
- This feature is limited to splitting savings presentation and related contract/test alignment, not broader dashboard redesign.
