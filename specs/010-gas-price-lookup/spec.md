# Feature Specification: Gas Price Lookup at Ride Entry

**Feature Branch**: `010-gas-price-lookup`  
**Created**: 2026-03-31  
**Status**: Draft  
**Input**: User description: "Find and call a free API to get the average gas per gallon price at the time of the entry. Store that in the ride created/updated events for future calculations. Store the API calls for those dates so we can reuse those prices in the future."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gas Price Displayed and Editable on Ride Creation (Priority: P1)

When a user opens the ride creation form, the gas price field is pre-populated with the national average regular unleaded price for the selected ride date, fetched automatically. The user can see this value and may overwrite it with their own number before saving. Whatever value is in the field when the user submits — whether the fetched price, a fallback, or a manually entered value — is stored with the ride record.

**Why this priority**: This is the foundation — gas price must be captured at creation and the user must be able to correct it before saving. Without this all other stories have nothing to build on.

**Independent Test**: Can be fully tested by opening the ride creation form, confirming a pre-populated gas price appears, editing it, saving, and confirming the saved ride record reflects the user-entered value.

**Acceptance Scenarios**:

1. **Given** a user opens the ride creation form for today's date and the EIA price is available, **When** the form loads, **Then** the gas price field is pre-populated with the national average price per gallon for that date.
2. **Given** a user opens the ride creation form for a past date and the EIA price is available, **When** the date is selected, **Then** the gas price field updates to reflect the price for that specific past date.
3. **Given** a pre-populated gas price is shown, **When** the user clears and types a different value, **Then** the user-entered value is stored on save (not the fetched value).
4. **Given** a user creates a ride entry for a date with no available gas price data (e.g. a future date), **When** the ride is saved, **Then** the ride is saved successfully and the gas price field is recorded as absent.

---

### User Story 2 - Fallback to Last Ride's Gas Price When Lookup Unavailable (Priority: P2)

When the gas price for the selected date cannot be fetched (external service unavailable, no data for that date, no internet connection), the gas price field is pre-populated with the gas price from the user's most recently saved ride instead of being left blank. The user can still overwrite this fallback value before saving.

**Why this priority**: A blank or zero gas price is less useful than a recent price the user already approved. The fallback provides a sensible default and reduces manual entry burden in offline or degraded scenarios.

**Independent Test**: Can be fully tested by disabling network access, opening the ride creation form, and confirming the gas price field is pre-populated with the price from the user's last saved ride.

**Acceptance Scenarios**:

1. **Given** the EIA API is unavailable and the user has at least one prior saved ride with a gas price, **When** the ride creation form loads, **Then** the gas price field is pre-populated with the gas price from the user's most recent ride.
2. **Given** the EIA API returns no data for the selected date and the user has at least one prior ride with a gas price, **When** the form loads or the date changes, **Then** the fallback price from the most recent ride is shown.
3. **Given** a fallback price is shown, **When** the user edits the field to a different value and saves, **Then** the user-entered value is stored in the ride record.
4. **Given** the EIA API is unavailable and the user has no prior saved rides with a gas price, **When** the ride creation form loads, **Then** the gas price field is empty and the user may enter a value manually or leave it blank.

---

### User Story 3 - Gas Price Displayed and Editable on Ride Edit (Priority: P3)

When a user opens the edit form for an existing ride, the gas price field is pre-populated with the gas price already stored on that ride. If the user changes the ride date, the gas price field is refreshed to show the fetched price for the new date (cache-first), or the fallback price if unavailable. The user may overwrite the gas price field at any time before saving.

**Why this priority**: Edit parity with creation — the price field must be visible and editable on the edit page too, and must react to date changes.

**Independent Test**: Can be fully tested by editing an existing ride, changing its date, confirming the gas price field updates, overwriting it, and verifying the saved record reflects the user-entered value.

**Acceptance Scenarios**:

1. **Given** a user opens the edit form for a ride, **When** the form loads, **Then** the gas price field is pre-populated with the gas price stored on that ride.
2. **Given** the user changes the ride date to a new date with an available EIA price, **When** the date changes, **Then** the gas price field updates to the price for the new date.
3. **Given** the user changes the ride date to a date with no EIA price available, **When** the date changes, **Then** the gas price field falls back to the most recent prior ride's gas price.
4. **Given** the user changes the ride date and the gas price field updates, **When** the user manually overwrites the field and saves, **Then** the user-entered value is stored in the ride updated event.
5. **Given** the user edits a ride without changing the date, **When** the form is submitted, **Then** the existing gas price value is preserved unchanged.

---

### User Story 4 - Gas Price Cache Prevents Redundant API Calls (Priority: P4)

When a gas price has already been fetched for a given date, any subsequent form loads or date selections for that same date reuse the cached price without calling the external service.

**Why this priority**: Caching ensures data consistency across rides on the same date and prevents unnecessary external API calls.

**Independent Test**: Can be fully tested by loading the ride creation form for the same date twice and confirming the external API was called only once.

**Acceptance Scenarios**:

1. **Given** a gas price has already been retrieved and cached for a specific date, **When** the form loads or date changes to that same date again, **Then** the cached price is used and no new external lookup is performed.
2. **Given** a cached price exists for a date, **When** the app is restarted and a ride form is opened for that same date, **Then** the cached price is still used (cache is durable across restarts).

---

### Edge Cases

- What happens when the external gas price API returns an error or times out? → The fallback (last ride's gas price) is shown in the field; the user may edit before saving.
- What happens when no price data exists for a date (future date, data gap)? → The fallback is shown; if no fallback exists the field is empty.
- What happens when a ride is created or edited while the app has no internet access? → Fallback price is shown; ride saves successfully with whatever the user leaves in the field.
- What happens if the same date is looked up concurrently from two form loads simultaneously? → Only one external call is made; the result is shared via the cache.
- What happens when a ride's date is not changed during an edit? → The existing stored gas price is pre-populated; no new lookup is triggered.
- What happens if the user clears the gas price field entirely and saves? → The ride is saved with no gas price recorded (absent, treated the same as a lookup failure).
- What happens when the user enters a non-numeric or negative value in the gas price field? → Client-side validation prevents submission; the user is prompted to enter a valid positive number or leave it blank.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The ride creation form MUST display a gas price field (USD per gallon) pre-populated with the national average regular unleaded price for the selected ride date, fetched automatically on form load and whenever the date changes.
- **FR-002**: The ride edit form MUST display the gas price field pre-populated with the gas price stored on the existing ride. If the user changes the date, the field MUST refresh to the fetched price for the new date.
- **FR-003**: The gas price field MUST be editable — the user can overwrite the pre-populated value before saving.
- **FR-004**: The value stored in the ride created/updated domain events MUST be whatever value is in the gas price field at the time of submission (fetched, fallback, or user-entered).
- **FR-005**: If the gas price for the selected date cannot be fetched (API unavailable, no data, no network), the gas price field MUST be pre-populated with the gas price from the user's most recently saved ride as a fallback.
- **FR-006**: If the gas price cannot be fetched and no prior ride has a gas price, the gas price field MUST be left empty; the user may enter a value manually or submit without one.
- **FR-007**: If the user clears the gas price field and saves, the ride MUST be saved successfully with the gas price recorded as absent.
- **FR-008**: The gas price field MUST only accept a valid positive decimal number or be empty; the form MUST prevent submission with an invalid (non-numeric or negative) gas price value.
- **FR-009**: The system MUST store each successfully fetched gas price in a durable local cache keyed by date, so the same date is never looked up from the external service more than once.
- **FR-010**: If a gas price for the requested date is already in the local cache, the system MUST use the cached value without calling the external service.
- **FR-011**: The local gas price cache MUST be durable — persisted to the same local storage as ride data so it survives app restarts.
- **FR-012**: The external gas price data source MUST be the U.S. Energy Information Administration (EIA) public API, using a team-managed free API key stored in application configuration. End users do not need to supply or manage any API key. The mechanism for securely storing and distributing the key is out of scope for this feature and will be addressed separately.

### Key Entities

- **GasPriceLookup**: Represents a single gas price retrieved for a calendar date. Key attributes: date (calendar date), price per gallon (decimal, USD), data source identifier, retrieved-at timestamp. One record per date; acts as the durable cache entry.
- **RideCreatedEvent**: Extended to include an optional gas price per gallon (USD) at the time of the ride's date.
- **RideUpdatedEvent**: Extended to include an optional gas price per gallon (USD) reflecting the price for the (possibly new) ride date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created or edited ride records include a gas price value for any date within the past 5 years, either from the EIA lookup, the fallback, or a user-entered value.
- **SC-002**: The same date's gas price is never fetched from the external source more than once across the lifetime of the application's local data store.
- **SC-003**: Ride creation and editing complete successfully even when the gas price service is unavailable — zero ride save failures attributable to price lookup failures.
- **SC-004**: The gas price field is visible and pre-populated on the ride creation and edit forms before the user submits.
- **SC-005**: Invalid gas price input (non-numeric, negative) is rejected before submission with a clear validation message.
- **SC-006**: Historical gas prices stored in the cache remain unchanged over time — a price recorded for a specific date never changes after the first successful retrieval.

## Assumptions

- The app targets users in the United States; national average retail regular unleaded price (sourced from a U.S. government or equivalent public data provider) is a sufficient default.
- Weekly granularity from the data source is acceptable — if a daily price is unavailable, the price for the nearest available reporting period for that date is used.
- The gas price field is displayed and editable on both the ride creation and edit forms. It is also stored in events for future calculation features (e.g., commute savings, cost comparison).
- An EIA API key (free, self-registered) is manageable by the development team; end users do not supply a key. Secure key storage is deferred to a separate concern.
- Gas prices are stored in USD per gallon to four decimal places of precision.
- There is no requirement to update or backfill gas prices for historical rides that were created before this feature was introduced.
