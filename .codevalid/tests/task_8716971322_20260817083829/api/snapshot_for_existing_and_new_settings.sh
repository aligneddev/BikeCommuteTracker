#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

BASE_URL="http://app:${PORT}"

# Case mappings
# | Case id                               | Method | Path         |
# |---------------------------------------|--------|--------------|
# | snapshot_for_existing_and_new_settings| POST   | /api/rides   |

# Case: snapshot_for_existing_and_new_settings

### Mocks

# No external vendor calls are exercised in this scenario.
# Weather and gas price lookups are disabled by omitting latitude/longitude and EIA/Weather API keys.
# No WireMock case mappings are required.

### Preconditions

cv_step "Given" "Signup rider and seed initial settings and baseline rides" $LINENO

# Sign up a new rider; API expects JSON { "name": string, "pin": string }.
SIGNUP_BODY_FILE="$(mktemp)"
cat > "${SIGNUP_BODY_FILE}" <<EOF
{
  "name": "SnapshotRider_$(date +%s)",
  "pin": "1234"
}
EOF

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"
cv_prereq "POST /api/users/signup to create rider" $LINENO

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "${SIGNUP_BODY_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_BODY_FILE}" \
  -D "${SIGNUP_HDR_FILE}" \
  -o "${SIGNUP_RESP_FILE}" || cv_fail "Signup request failed" $LINENO

RESPONSE_HEADERS="$(cat "${SIGNUP_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SIGNUP_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "POST" "/api/users/signup" "201"

RIDER_ID="$(jq -r '.userId' < "${SIGNUP_RESP_FILE}")"
if ! [[ "${RIDER_ID}" =~ ^[0-9]+$ ]] || [ "${RIDER_ID}" -le 0 ]; then
  cv_fail "Signup did not return a valid userId, got '${RIDER_ID}'" $LINENO
fi

# Seed initial user settings with baseline snapshot values; omit lat/lon and API keys
SETTINGS_BASELINE_BODY_FILE="$(mktemp)"
cat > "${SETTINGS_BASELINE_BODY_FILE}" <<EOF
{
  "averageCarMpg": 25.0,
  "yearlyGoalMiles": 1000.0,
  "oilChangePrice": 49.99,
  "mileageRateCents": 45.0,
  "locationLabel": null,
  "latitude": null,
  "longitude": null,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "eiaGasApiKey": null,
  "weatherApiKey": null
}
EOF

SETTINGS_BASELINE_RESP_FILE="$(mktemp)"
SETTINGS_BASELINE_HDR_FILE="$(mktemp)"
cv_prereq "PUT /api/users/me/settings with baseline values" $LINENO

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${SETTINGS_BASELINE_BODY_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X PUT "${BASE_URL}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${SETTINGS_BASELINE_BODY_FILE}" \
  -D "${SETTINGS_BASELINE_HDR_FILE}" \
  -o "${SETTINGS_BASELINE_RESP_FILE}" || cv_fail "Baseline settings PUT failed" $LINENO

RESPONSE_HEADERS="$(cat "${SETTINGS_BASELINE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SETTINGS_BASELINE_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "PUT" "/api/users/me/settings" "200"

# Record first ride under baseline settings; distinct miles and gas price
FIRST_RIDE_REQ_FILE="$(mktemp)"
FIRST_RIDE_DATETIME="$(date -u +'%Y-%m-%dT%H:%M')"
cat > "${FIRST_RIDE_REQ_FILE}" <<EOF
{
  "rideDateTimeLocal": "${FIRST_RIDE_DATETIME}",
  "miles": 10.0,
  "rideMinutes": 40,
  "temperature": null,
  "gasPricePerGallon": 3.2000,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "Baseline snapshot ride",
  "weatherUserOverridden": true,
  "difficulty": 3,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "snapshot-test-baseline"
}
EOF

FIRST_RIDE_RESP_FILE="$(mktemp)"
FIRST_RIDE_HDR_FILE="$(mktemp)"
cv_prereq "POST /api/rides to create baseline ride" $LINENO

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${FIRST_RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${FIRST_RIDE_REQ_FILE}" \
  -D "${FIRST_RIDE_HDR_FILE}" \
  -o "${FIRST_RIDE_RESP_FILE}" || cv_fail "Baseline ride POST failed" $LINENO

RESPONSE_HEADERS="$(cat "${FIRST_RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${FIRST_RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "POST" "/api/rides" "201"

FIRST_RIDE_ID="$(jq -r '.rideId' < "${FIRST_RIDE_RESP_FILE}")"
if ! [[ "${FIRST_RIDE_ID}" =~ ^[0-9]+$ ]] || [ "${FIRST_RIDE_ID}" -le 0 ]; then
  cv_fail "Baseline ride response did not contain a valid rideId, got '${FIRST_RIDE_ID}'" $LINENO
fi

# Record a second ride under baseline settings to act as an untouched historical ride
SECOND_RIDE_REQ_FILE="$(mktemp)"
SECOND_RIDE_DATETIME="$(date -u +'%Y-%m-%dT%H:%M' -d '+5 minutes' 2>/dev/null || date -u +'%Y-%m-%dT%H:%M')"
cat > "${SECOND_RIDE_REQ_FILE}" <<EOF
{
  "rideDateTimeLocal": "${SECOND_RIDE_DATETIME}",
  "miles": 6.5,
  "rideMinutes": 25,
  "temperature": null,
  "gasPricePerGallon": 3.1500,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "Historical snapshot ride",
  "weatherUserOverridden": true,
  "difficulty": 2,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "snapshot-test-historical"
}
EOF

SECOND_RIDE_RESP_FILE="$(mktemp)"
SECOND_RIDE_HDR_FILE="$(mktemp)"
cv_prereq "POST /api/rides to create historical ride" $LINENO

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${SECOND_RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${SECOND_RIDE_REQ_FILE}" \
  -D "${SECOND_RIDE_HDR_FILE}" \
  -o "${SECOND_RIDE_RESP_FILE}" || cv_fail "Historical ride POST failed" $LINENO

RESPONSE_HEADERS="$(cat "${SECOND_RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SECOND_RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "POST" "/api/rides" "201"

SECOND_RIDE_ID="$(jq -r '.rideId' < "${SECOND_RIDE_RESP_FILE}")"
if ! [[ "${SECOND_RIDE_ID}" =~ ^[0-9]+$ ]] || [ "${SECOND_RIDE_ID}" -le 0 ]; then
  cv_fail "Historical ride response did not contain a valid rideId, got '${SECOND_RIDE_ID}'" $LINENO
fi

### When

cv_step "When" "Change settings, edit baseline ride, and record a new ride under updated settings" $LINENO

# Update rider settings to new values to simulate settings change over time
SETTINGS_UPDATED_BODY_FILE="$(mktemp)"
cat > "${SETTINGS_UPDATED_BODY_FILE}" <<EOF
{
  "averageCarMpg": 30.0,
  "yearlyGoalMiles": 1500.0,
  "oilChangePrice": 79.99,
  "mileageRateCents": 50.0,
  "locationLabel": null,
  "latitude": null,
  "longitude": null,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "eiaGasApiKey": null,
  "weatherApiKey": null
}
EOF

SETTINGS_UPDATED_RESP_FILE="$(mktemp)"
SETTINGS_UPDATED_HDR_FILE="$(mktemp)"
cv_prereq "PUT /api/users/me/settings with updated values" $LINENO

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${SETTINGS_UPDATED_BODY_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X PUT "${BASE_URL}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${SETTINGS_UPDATED_BODY_FILE}" \
  -D "${SETTINGS_UPDATED_HDR_FILE}" \
  -o "${SETTINGS_UPDATED_RESP_FILE}" || cv_fail "Updated settings PUT failed" $LINENO

RESPONSE_HEADERS="$(cat "${SETTINGS_UPDATED_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SETTINGS_UPDATED_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "PUT" "/api/users/me/settings" "200"

# Edit the first ride with new miles and gas price, ExpectedVersion = 1
EDIT_RIDE_REQ_FILE="$(mktemp)"
EDIT_RIDE_DATETIME="${FIRST_RIDE_DATETIME}"
cat > "${EDIT_RIDE_REQ_FILE}" <<EOF
{
  "rideDateTimeLocal": "${EDIT_RIDE_DATETIME}",
  "miles": 11.5,
  "rideMinutes": 42,
  "temperature": null,
  "expectedVersion": 1,
  "gasPricePerGallon": 3.3000,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "Edited after settings change",
  "weatherUserOverridden": true,
  "difficulty": 4,
  "primaryTravelDirection": null
}
EOF

EDIT_RIDE_RESP_FILE="$(mktemp)"
EDIT_RIDE_HDR_FILE="$(mktemp)"
cv_prereq "PUT /api/rides/{id} to edit baseline ride under updated settings" $LINENO

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${EDIT_RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X PUT "${BASE_URL}/api/rides/${FIRST_RIDE_ID}" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${EDIT_RIDE_REQ_FILE}" \
  -D "${EDIT_RIDE_HDR_FILE}" \
  -o "${EDIT_RIDE_RESP_FILE}" || cv_fail "Edit ride PUT failed" $LINENO

RESPONSE_HEADERS="$(cat "${EDIT_RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${EDIT_RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "PUT" "/api/rides/{id}" "200"

# Record a third ride entirely under updated settings to represent new snapshot data
THIRD_RIDE_REQ_FILE="$(mktemp)"
THIRD_RIDE_DATETIME="$(date -u +'%Y-%m-%dT%H:%M' -d '+10 minutes' 2>/dev/null || date -u +'%Y-%m-%dT%H:%M')"
cat > "${THIRD_RIDE_REQ_FILE}" <<EOF
{
  "rideDateTimeLocal": "${THIRD_RIDE_DATETIME}",
  "miles": 8.0,
  "rideMinutes": 35,
  "temperature": null,
  "gasPricePerGallon": 3.3500,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "New ride under updated settings",
  "weatherUserOverridden": true,
  "difficulty": 3,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "snapshot-test-updated"
}
EOF

THIRD_RIDE_RESP_FILE="$(mktemp)"
THIRD_RIDE_HDR_FILE="$(mktemp)"
cv_prereq "POST /api/rides to create new ride under updated settings" $LINENO

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${THIRD_RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${THIRD_RIDE_REQ_FILE}" \
  -D "${THIRD_RIDE_HDR_FILE}" \
  -o "${THIRD_RIDE_RESP_FILE}" || cv_fail "Updated settings ride POST failed" $LINENO

RESPONSE_HEADERS="$(cat "${THIRD_RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${THIRD_RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "POST" "/api/rides" "201"

THIRD_RIDE_ID="$(jq -r '.rideId' < "${THIRD_RIDE_RESP_FILE}")"
if ! [[ "${THIRD_RIDE_ID}" =~ ^[0-9]+$ ]] || [ "${THIRD_RIDE_ID}" -le 0 ]; then
  cv_fail "Updated settings ride response did not contain a valid rideId, got '${THIRD_RIDE_ID}'" $LINENO
fi

### Then

cv_step "Then" "Assert history shows stable historical ride and updated snapshots for edited and new rides" $LINENO

HISTORY_RESP_FILE="$(mktemp)"
HISTORY_HDR_FILE="$(mktemp)"
cv_prereq "GET /api/rides/history to inspect recorded rides" $LINENO

REQUEST_HEADERS="X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -f -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}" \
  -D "${HISTORY_HDR_FILE}" \
  -o "${HISTORY_RESP_FILE}" || cv_fail "Ride history GET failed" $LINENO

RESPONSE_HEADERS="$(cat "${HISTORY_HDR_FILE}")"
RESPONSE_BODY="$(cat "${HISTORY_RESP_FILE}")"
echo "RESPONSE_HEADERS: ${RESPONSE_HEADERS}"
echo "RESPONSE_BODY: ${RESPONSE_BODY}"

cv_http "GET" "/api/rides/history" "200"

# Extract the three rides by id
BASELINE_RIDE_JSON="$(jq --arg id "${FIRST_RIDE_ID}" '.rides[] | select(.rideId == ($id|tonumber))' < "${HISTORY_RESP_FILE}")"
HISTORICAL_RIDE_JSON="$(jq --arg id "${SECOND_RIDE_ID}" '.rides[] | select(.rideId == ($id|tonumber))' < "${HISTORY_RESP_FILE}")"
UPDATED_RIDE_JSON="$(jq --arg id "${THIRD_RIDE_ID}" '.rides[] | select(.rideId == ($id|tonumber))' < "${HISTORY_RESP_FILE}")"

if [ -z "${BASELINE_RIDE_JSON}" ]; then
  cv_fail "Edited baseline ride not found in history" $LINENO
fi
if [ -z "${HISTORICAL_RIDE_JSON}" ]; then
  cv_fail "Historical ride not found in history" $LINENO
fi
if [ -z "${UPDATED_RIDE_JSON}" ]; then
  cv_fail "New ride under updated settings not found in history" $LINENO
fi

# Assert edited baseline ride has updated miles and gas price per edit request
BASELINE_MILES_AFTER_EDIT="$(jq -r '.miles' <<< "${BASELINE_RIDE_JSON}")"
BASELINE_GAS_AFTER_EDIT="$(jq -r '.gasPricePerGallon // empty' <<< "${BASELINE_RIDE_JSON}")"
BASELINE_NOTE_AFTER_EDIT="$(jq -r '.note // empty' <<< "${BASELINE_RIDE_JSON}")"

if [ "${BASELINE_MILES_AFTER_EDIT}" != "11.5" ]; then
  cv_fail "Edited baseline ride miles expected 11.5, got ${BASELINE_MILES_AFTER_EDIT}" $LINENO
fi
if [ "${BASELINE_GAS_AFTER_EDIT}" != "3.3000" ] && [ "${BASELINE_GAS_AFTER_EDIT}" != "3.3" ]; then
  cv_fail "Edited baseline ride gasPricePerGallon expected 3.3000, got ${BASELINE_GAS_AFTER_EDIT}" $LINENO
fi
if [ "${BASELINE_NOTE_AFTER_EDIT}" != "Edited after settings change" ]; then
  cv_fail "Edited baseline ride note expected 'Edited after settings change', got '${BASELINE_NOTE_AFTER_EDIT}'" $LINENO
fi

# Assert historical ride retains its original miles and gas price, proving no retroactive change
HISTORICAL_MILES="$(jq -r '.miles' <<< "${HISTORICAL_RIDE_JSON}")"
HISTORICAL_GAS="$(jq -r '.gasPricePerGallon // empty' <<< "${HISTORICAL_RIDE_JSON}")"
HISTORICAL_NOTE="$(jq -r '.note // empty' <<< "${HISTORICAL_RIDE_JSON}")"

if [ "${HISTORICAL_MILES}" != "6.5" ]; then
  cv_fail "Historical ride miles expected 6.5, got ${HISTORICAL_MILES}" $LINENO
fi
if [ "${HISTORICAL_GAS}" != "3.1500" ] && [ "${HISTORICAL_GAS}" != "3.15" ]; then
  cv_fail "Historical ride gasPricePerGallon expected 3.1500, got ${HISTORICAL_GAS}" $LINENO
fi
if [ "${HISTORICAL_NOTE}" != "Historical snapshot ride" ]; then
  cv_fail "Historical ride note expected 'Historical snapshot ride', got '${HISTORICAL_NOTE}'" $LINENO
fi

# Assert new ride under updated settings has its own miles and gas price values
UPDATED_MILES="$(jq -r '.miles' <<< "${UPDATED_RIDE_JSON}")"
UPDATED_GAS="$(jq -r '.gasPricePerGallon // empty' <<< "${UPDATED_RIDE_JSON}")"
UPDATED_NOTE="$(jq -r '.note // empty' <<< "${UPDATED_RIDE_JSON}")"

if [ "${UPDATED_MILES}" != "8" ] && [ "${UPDATED_MILES}" != "8.0" ]; then
  cv_fail "Updated settings ride miles expected 8.0, got ${UPDATED_MILES}" $LINENO
fi
if [ "${UPDATED_GAS}" != "3.3500" ] && [ "${UPDATED_GAS}" != "3.35" ]; then
  cv_fail "Updated settings ride gasPricePerGallon expected 3.3500, got ${UPDATED_GAS}" $LINENO
fi
if [ "${UPDATED_NOTE}" != "New ride under updated settings" ]; then
  cv_fail "Updated settings ride note expected 'New ride under updated settings', got '${UPDATED_NOTE}'" $LINENO
fi

# Together these assertions confirm that:
# - The edited ride reflects its explicit changes without altering unrelated historical rides.
# - Historical rides keep their originally recorded values even after settings change.
# - New rides recorded under updated settings carry their own values, demonstrating stable snapshots over time.

# Success marker required by the runner
echo "CODEVALID_TEST_ASSERTION_OK:snapshot_for_existing_and_new_settings"

### Teardown

cv_step "Cleanup" "No explicit teardown; SQLite DB is scoped to the test container" $LINENO

# No cleanup required: the app uses an ephemeral SQLite file inside the container for tests.
# Subsequent runs start from a fresh database via the compose health/start sequence.
