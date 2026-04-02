# Quickstart: Gas Price Lookup at Ride Entry

**Feature**: 010-gas-price-lookup  
**Branch**: `010-gas-price-lookup`

---

## What This Feature Does

When a user creates or edits a ride, the form now shows a **Gas Price ($/gal)** field pre-populated with the national average retail gasoline price for the ride's date. The price is fetched from the EIA API (U.S. government data) and cached locally so the same date is never looked up twice. The user can overwrite the value before saving. The stored price travels with the ride record for future cost calculations.

---

## How to Test It Locally

1. Start the full stack:
   ```bash
   dotnet run --project src/BikeTracking.AppHost
   ```

2. Open the Aspire Dashboard and launch the frontend.

3. Log in and open the **Record Ride** page.
   - The **Gas Price ($/gal)** field should be pre-populated with either:
     - The price from your most recent ride (fallback), or
     - The EIA price for today's date (if available and no prior ride exists).

4. Change the ride date — the gas price field should update to reflect the price for the new date.

5. Optionally edit the gas price field and save. Navigate to **Ride History** to confirm the recorded price is shown in the ride row.

6. Edit an existing ride and change its date — confirm the gas price refreshes.

---

## EIA API Key Setup (Development)

The EIA API key is required for the lookup to succeed. In development (on your local machine), set it via .NET User Secrets:

```bash
cd src/BikeTracking.Api
dotnet user-secrets set "GasPriceLookup:EiaApiKey" "YOUR_EIA_KEY_HERE"
```

If you run the API in a dev container, bind-mount your host User Secrets directory so secrets persist across container rebuilds:

```yaml
# docker-compose.yml
services:
   api:
      volumes:
         - ${HOME}/.microsoft/usersecrets:/root/.microsoft/usersecrets
```

Windows host path equivalent:

```text
%APPDATA%\Microsoft\UserSecrets -> /root/.microsoft/usersecrets
```

Get a free key at: https://www.eia.gov/opendata/register.php

Without the key, the field will fall back to the last ride's gas price (or remain empty for new users). The ride can still be saved — gas price is always optional.

---

## What Was Changed

### Backend (C# / F#)
- New `GasPriceLookups` table — durable cache, keyed by date, SQLite-persisted.
- `Rides` table gains a nullable `GasPricePerGallon` column.
- New endpoint: `GET /api/rides/gas-price?date=YYYY-MM-DD` — returns EIA price (cached).
- `GET /api/rides/defaults` extended — includes `DefaultGasPricePerGallon` from last ride.
- `POST /api/rides` and `PUT /api/rides/{id}` accept and store `gasPricePerGallon`.
- `RideRecordedEventPayload` and `RideEditedEventPayload` carry `GasPricePerGallon`.

### Frontend (React / TypeScript)
- **Record Ride page**: gas price field shown, pre-populated from defaults, refreshed on date change (debounced 300ms).
- **History page** inline edit form: gas price field shown and editable; refreshes on date change.
- History table shows gas price column (or "N/A").

### Database Migration
- Migration: `AddGasPriceToRidesAndLookupCache`
- Applied automatically on startup (existing migration auto-apply behavior).

---

## Offline / Degraded Behavior

| Scenario | Behavior |
|---|---|
| EIA API unreachable | Field keeps the fallback value (last ride's price, or empty) |
| Date has no EIA data | Same as above |
| User clears the field | Ride saves with `gasPricePerGallon = null` |
| No prior rides and EIA down | Field is empty; ride saves without a price |
| Cached price exists for date | Returned instantly; no EIA call made |
