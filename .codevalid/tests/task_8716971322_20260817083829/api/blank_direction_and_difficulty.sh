#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: blank_direction_and_difficulty

# Mocks
cv_step "Given" "No external vendor calls required; skip WireMock case stubs for this scenario." $LINENO
# This scenario does not trigger EIA or Open-Meteo lookups because UserSettings will not include latitude/longitude
# and the RecordRide request will not cause any gas or weather enrichment at save time.
# Therefore, no WireMock case mappings are written or imported here.

# Preconditions
cv_prereq "Signup a rider and optionally set user settings without lat/lon so weather auto-fetch is skipped." $LINENO

BASE_URL="http://app:${PORT}"

# 1) Signup a new rider to obtain a real user id for X-User-Id.
cv_prereq "Create rider via POST /api/users/signup" $LINENO
SIGNUP_BODY_FILE="$(mktemp)"
cat > "${SIGNUP_BODY_FILE}" <<'JSON'
{
  "name": "blank-direction-difficulty-user",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "${SIGNUP_BODY_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${SIGNUP_HDR_FILE}" -o "${SIGNUP_RESP_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_BODY_FILE}" > "${SIGNUP_STATUS_FILE}"
SIGNUP_STATUS="$(cat "${SIGNUP_STATUS_FILE}")"
cv_http "POST" "/api/users/signup" "${SIGNUP_STATUS}"
echo "RESPONSE_HEADERS:"
cat "${SIGNUP_HDR_FILE}"
echo "RESPONSE_BODY:"
cat "${SIGNUP_RESP_FILE}"
if [ "${SIGNUP_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from POST /api/users/signup, got ${SIGNUP_STATUS}" $LINENO
fi

RIDER_ID="$(jq -r '.userId' < "${SIGNUP_RESP_FILE}")"
if [ -z "${RIDER_ID}" ] || [ "${RIDER_ID}" = "null" ]; then
  cv_fail "Signup response did not contain userId" $LINENO
fi

# 2) Optionally set UserSettings without latitude/longitude so weather auto-fetch is skipped.
cv_prereq "PUT /api/users/me/settings without lat/lon to avoid weather-fetch" $LINENO
SETTINGS_BODY_FILE="$(mktemp)"
cat > "${SETTINGS_BODY_FILE}" <<'JSON'
{
  "averageCarMpg": 30.5,
  "yearlyGoalMiles": 1500,
  "oilChangePrice": 45.00,
  "mileageRateCents": 62.5,
  "locationLabel": null,
  "latitude": null,
  "longitude": null,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "eiaGasApiKey": null,
  "weatherApiKey": null
}
JSON

SETTINGS_RESP_FILE="$(mktemp)"
SETTINGS_STATUS_FILE="$(mktemp)"
SETTINGS_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${SETTINGS_BODY_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${SETTINGS_HDR_FILE}" -o "${SETTINGS_RESP_FILE}" -w '%{http_code}' \
  -X PUT "${BASE_URL}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${SETTINGS_BODY_FILE}" > "${SETTINGS_STATUS_FILE}"
SETTINGS_STATUS="$(cat "${SETTINGS_STATUS_FILE}")"
cv_http "PUT" "/api/users/me/settings" "${SETTINGS_STATUS}"
echo "RESPONSE_HEADERS:"
cat "${SETTINGS_HDR_FILE}"
echo "RESPONSE_BODY:"
cat "${SETTINGS_RESP_FILE}"
if [ "${SETTINGS_STATUS}" != "200" ]; then
  cv_fail "Expected 200 from PUT /api/users/me/settings, got ${SETTINGS_STATUS}" $LINENO
fi

# When
cv_step "When" "POST /api/rides with valid fields but omitting difficulty and primaryTravelDirection." $LINENO

# Build a RecordRideRequest JSON body. We include date/time, miles, optional minutes, optional gas price and note,
# and leave difficulty and primaryTravelDirection out entirely so they are null server-side.
NOW_ISO_MINUTE="$(date -u +'%Y-%m-%dT%H:%M')"
RIDE_BODY_FILE="$(mktemp)"
cat > "${RIDE_BODY_FILE}" <<JSON
{
  "rideDateTimeLocal": "${NOW_ISO_MINUTE}:00",
  "miles": 12.5,
  "rideMinutes": 50,
  "temperature": null,
  "gasPricePerGallon": 3.4599,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "Morning commute without direction/difficulty set",
  "weatherUserOverridden": false,
  "selectedPresetId": null,
  "importSource": "seed-test-blank-direction-difficulty"
}
JSON

RIDE_RESP_FILE="$(mktemp)"
RIDE_STATUS_FILE="$(mktemp)"
RIDE_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${RIDE_BODY_FILE}")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${RIDE_HDR_FILE}" -o "${RIDE_RESP_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${RIDE_BODY_FILE}" > "${RIDE_STATUS_FILE}"
RIDE_STATUS="$(cat "${RIDE_STATUS_FILE}")"
cv_http "POST" "/api/rides" "${RIDE_STATUS}"
echo "RESPONSE_HEADERS:"
cat "${RIDE_HDR_FILE}"
echo "RESPONSE_BODY:"
cat "${RIDE_RESP_FILE}"
if [ "${RIDE_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from POST /api/rides, got ${RIDE_STATUS}" $LINENO
fi

RIDE_ID="$(jq -r '.rideId' < "${RIDE_RESP_FILE}")"
SAVED_RIDER_ID="$(jq -r '.riderId' < "${RIDE_RESP_FILE}")"
if [ -z "${RIDE_ID}" ] || [ "${RIDE_ID}" = "null" ]; then
  cv_fail "RecordRideSuccessResponse did not contain rideId" $LINENO
fi
if [ "${SAVED_RIDER_ID}" != "${RIDER_ID}" ]; then
  cv_fail "RecordRideSuccessResponse riderId ${SAVED_RIDER_ID} does not match signed-up riderId ${RIDER_ID}" $LINENO
fi

# Then
cv_step "Then" "GET /api/rides/history and assert difficulty, primaryTravelDirection, and windResistanceRating are null for the new ride." $LINENO

HISTORY_RESP_FILE="$(mktemp)"
HISTORY_STATUS_FILE="$(mktemp)"
HISTORY_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${HISTORY_HDR_FILE}" -o "${HISTORY_RESP_FILE}" -w '%{http_code}' \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}" > "${HISTORY_STATUS_FILE}"
HISTORY_STATUS="$(cat "${HISTORY_STATUS_FILE}")"
cv_http "GET" "/api/rides/history" "${HISTORY_STATUS}"
echo "RESPONSE_HEADERS:"
cat "${HISTORY_HDR_FILE}"
echo "RESPONSE_BODY:"
cat "${HISTORY_RESP_FILE}"
if [ "${HISTORY_STATUS}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/history, got ${HISTORY_STATUS}" $LINENO
fi

# Find the ride with matching rideId in the history response.
MATCHING_RIDE_JSON="$(jq -c --arg rid "${RIDE_ID}" '.rides[] | select(.rideId == ($rid|tonumber))' < "${HISTORY_RESP_FILE}")"
if [ -z "${MATCHING_RIDE_JSON}" ]; then
  cv_fail "GET /api/rides/history did not contain a ride row with rideId=${RIDE_ID}" $LINENO
fi

# Assert difficulty, primaryTravelDirection, and windResistanceRating are null.
RIDE_DIFFICULTY="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.difficulty')"
RIDE_DIRECTION="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.primaryTravelDirection')"
RIDE_WIND_RATING="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.windResistanceRating')"

if [ "${RIDE_DIFFICULTY}" != "null" ]; then
  cv_fail "Expected difficulty null for rideId=${RIDE_ID}, got ${RIDE_DIFFICULTY}" $LINENO
fi
if [ "${RIDE_DIRECTION}" != "null" ]; then
  cv_fail "Expected primaryTravelDirection null for rideId=${RIDE_ID}, got ${RIDE_DIRECTION}" $LINENO
fi
if [ "${RIDE_WIND_RATING}" != "null" ]; then
  cv_fail "Expected windResistanceRating null for rideId=${RIDE_ID}, got ${RIDE_WIND_RATING}" $LINENO
fi

# Also assert that core fields match the submitted values.
RIDE_MILES="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.miles')"
RIDE_MINUTES="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.rideMinutes')"
RIDE_GAS_PRICE="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.gasPricePerGallon')"
RIDE_NOTE="$(echo "${MATCHING_RIDE_JSON}" | jq -r '.note')"

# Miles must equal 12.5
awk 'BEGIN {if (ARGV[1]+0 != 12.5) exit 1}' "${RIDE_MILES}" 2>/dev/null || cv_fail "Expected miles 12.5 for rideId=${RIDE_ID}, got ${RIDE_MILES}" $LINENO
if [ "${RIDE_MINUTES}" != "50" ]; then
  cv_fail "Expected rideMinutes 50 for rideId=${RIDE_ID}, got ${RIDE_MINUTES}" $LINENO
fi
# Gas price stored as decimal 3.4599
awk 'BEGIN {if (ARGV[1]+0 != 3.4599) exit 1}' "${RIDE_GAS_PRICE}" 2>/dev/null || cv_fail "Expected gasPricePerGallon 3.4599 for rideId=${RIDE_ID}, got ${RIDE_GAS_PRICE}" $LINENO
if [ "${RIDE_NOTE}" != "Morning commute without direction/difficulty set" ]; then
  cv_fail "Expected note 'Morning commute without direction/difficulty set' for rideId=${RIDE_ID}, got ${RIDE_NOTE}" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit cleanup; rides remain in SQLite DB for inspection." $LINENO
# There is no DELETE /api/rides endpoint used here; the created rider and ride remain in the test database.
# Subsequent seed-test runs use a fresh /app/data/app.db file per stack, so no cross-run cleanup is required.

echo "CODEVALID_TEST_ASSERTION_OK:blank_direction_and_difficulty"
