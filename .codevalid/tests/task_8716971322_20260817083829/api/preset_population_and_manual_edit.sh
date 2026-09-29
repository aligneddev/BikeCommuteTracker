#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case mappings
# | case_id                          | method | path          | notes                                   |
# |----------------------------------|--------|---------------|-----------------------------------------|
# | preset_population_and_manual_edit| POST   | /api/rides    | Uses preset seeding, no vendor calls    |

# Case: preset_population_and_manual_edit

# Mocks
# No external vendor calls (gas price or weather) are needed in this scenario, so no WireMock stubs are imported.
cv_step "Given" "No vendor mocks needed for preset-only ride recording" $LINENO

# Preconditions
cv_prereq "Sign up rider, create two presets, and verify preset ordering" $LINENO
BASE_URL="http://app:${PORT}"

# Sign up a new rider and capture userId
cv_prereq "Sign up rider for preset ride test" $LINENO
SIGNUP_BODY_FILE="$(mktemp)"
cat > "${SIGNUP_BODY_FILE}" <<JSON
{
  "name": "PresetRider_$(date +%s)",
  "pin": "1234"
}
JSON
SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="POST ${BASE_URL}/api/users/signup
Content-Type: application/json"
REQUEST_BODY="$(cat "${SIGNUP_BODY_FILE}")"
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

SIGNUP_STATUS="$(curl -sS -D "${SIGNUP_HDR_FILE}" -o "${SIGNUP_RESP_FILE}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_BODY_FILE}")"

RESPONSE_HEADERS="$(cat "${SIGNUP_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SIGNUP_RESP_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "POST" "/api/users/signup" "${SIGNUP_STATUS}"
if [ "${SIGNUP_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from POST /api/users/signup, got ${SIGNUP_STATUS}" $LINENO
fi
RIDER_ID="$(jq -r '.userId // .id // .userID' "${SIGNUP_RESP_FILE}")"
if ! printf '%s' "${RIDER_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Signup response missing numeric userId" $LINENO
fi

# Create first preset
cv_prereq "Create first ride preset for rider" $LINENO
PRESET1_REQ_FILE="$(mktemp)"
cat > "${PRESET1_REQ_FILE}" <<JSON
{
  "name": "Morning Commute $(date +%s)",
  "primaryDirection": "North",
  "periodTag": "morning",
  "exactStartTimeLocal": "07:30",
  "durationMinutes": 45,
  "miles": 10.5
}
JSON
PRESET1_RESP_FILE="$(mktemp)"
PRESET1_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="POST ${BASE_URL}/api/rides/presets
Content-Type: application/json
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${PRESET1_REQ_FILE}")"
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

PRESET1_STATUS="$(curl -sS -D "${PRESET1_HDR_FILE}" -o "${PRESET1_RESP_FILE}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${PRESET1_REQ_FILE}")"

RESPONSE_HEADERS="$(cat "${PRESET1_HDR_FILE}")"
RESPONSE_BODY="$(cat "${PRESET1_RESP_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "POST" "/api/rides/presets" "${PRESET1_STATUS}"
if [ "${PRESET1_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from POST /api/rides/presets (preset1), got ${PRESET1_STATUS}" $LINENO
fi

# Create second preset
cv_prereq "Create second ride preset for rider" $LINENO
PRESET2_REQ_FILE="$(mktemp)"
cat > "${PRESET2_REQ_FILE}" <<JSON
{
  "name": "Evening Loop $(date +%s)",
  "primaryDirection": "North",
  "periodTag": "afternoon",
  "exactStartTimeLocal": "18:00",
  "durationMinutes": 60,
  "miles": 15.0
}
JSON
PRESET2_RESP_FILE="$(mktemp)"
PRESET2_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="POST ${BASE_URL}/api/rides/presets
Content-Type: application/json
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${PRESET2_REQ_FILE}")"
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

PRESET2_STATUS="$(curl -sS -D "${PRESET2_HDR_FILE}" -o "${PRESET2_RESP_FILE}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${PRESET2_REQ_FILE}")"

RESPONSE_HEADERS="$(cat "${PRESET2_HDR_FILE}")"
RESPONSE_BODY="$(cat "${PRESET2_RESP_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "POST" "/api/rides/presets" "${PRESET2_STATUS}"
if [ "${PRESET2_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from POST /api/rides/presets (preset2), got ${PRESET2_STATUS}" $LINENO
fi

# List presets and capture ordering and baseline fields
cv_prereq "List presets to capture baseline configuration" $LINENO
PRESETS_LIST_FILE="$(mktemp)"
PRESETS_LIST_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${BASE_URL}/api/rides/presets
X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

PRESETS_LIST_STATUS="$(curl -sS -D "${PRESETS_LIST_HDR_FILE}" -o "${PRESETS_LIST_FILE}" -w "%{http_code}" \
  -X GET "${BASE_URL}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_ID}")"

RESPONSE_HEADERS="$(cat "${PRESETS_LIST_HDR_FILE}")"
RESPONSE_BODY="$(cat "${PRESETS_LIST_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "GET" "/api/rides/presets" "${PRESETS_LIST_STATUS}"
if [ "${PRESETS_LIST_STATUS}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/presets, got ${PRESETS_LIST_STATUS}" $LINENO
fi

PRESETS_COUNT="$(jq '.presets | length' "${PRESETS_LIST_FILE}")"
if [ "${PRESETS_COUNT}" -lt 2 ]; then
  cv_fail "Expected at least 2 presets for rider, found ${PRESETS_COUNT}" $LINENO
fi

# Capture first preset (most recently updated) baseline fields
SELECTED_PRESET_JSON="$(jq '.presets[0]' "${PRESETS_LIST_FILE}")"
SELECTED_PRESET_ID="$(printf '%s' "${SELECTED_PRESET_JSON}" | jq -r '.presetId')"
BASE_MILES="$(printf '%s' "${SELECTED_PRESET_JSON}" | jq -r '.miles')"
BASE_DURATION="$(printf '%s' "${SELECTED_PRESET_JSON}" | jq -r '.durationMinutes')"
BASE_PRIMARY_DIRECTION="$(printf '%s' "${SELECTED_PRESET_JSON}" | jq -r '.primaryDirection')"
BASE_START_TIME="$(printf '%s' "${SELECTED_PRESET_JSON}" | jq -r '.exactStartTimeLocal')"
BASE_LAST_USED="$(printf '%s' "${SELECTED_PRESET_JSON}" | jq -r '.lastUsedAtUtc')" || true

if ! printf '%s' "${SELECTED_PRESET_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Selected preset id is not numeric" $LINENO
fi

# Ensure LastUsedAtUtc is null before use
if [ "${BASE_LAST_USED}" != "null" ]; then
  cv_fail "Expected LastUsedAtUtc to be null before using preset, got ${BASE_LAST_USED}" $LINENO
fi

# Construct edited values different from preset defaults
EDITED_MILES="$(awk "BEGIN { printf \"%.2f\", ${BASE_MILES} + 2.5 }")"
EDITED_DURATION="$((BASE_DURATION + 10))"

# When
cv_step "When" "Record ride using selected preset id but with edited miles and duration" $LINENO

# Build RecordRideRequest with SelectedPresetId and edited miles/duration
RIDE_REQ_FILE="$(mktemp)"
NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M")"
cat > "${RIDE_REQ_FILE}" <<JSON
{
  "rideDateTimeLocal": "${NOW_ISO}",
  "miles": ${EDITED_MILES},
  "rideMinutes": ${EDITED_DURATION},
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": null,
  "weatherUserOverridden": false,
  "difficulty": null,
  "primaryTravelDirection": "${BASE_PRIMARY_DIRECTION}",
  "selectedPresetId": ${SELECTED_PRESET_ID},
  "importSource": null
}
JSON

RIDE_RESP_FILE="$(mktemp)"
RIDE_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="POST ${BASE_URL}/api/rides
Content-Type: application/json
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "${RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

RIDE_STATUS="$(curl -sS -D "${RIDE_HDR_FILE}" -o "${RIDE_RESP_FILE}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${RIDE_REQ_FILE}")"

RESPONSE_HEADERS="$(cat "${RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "POST" "/api/rides" "${RIDE_STATUS}"
if [ "${RIDE_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from POST /api/rides, got ${RIDE_STATUS}" $LINENO
fi

RIDE_ID="$(jq -r '.rideId // .RideId' "${RIDE_RESP_FILE}")"
RESP_RIDER_ID="$(jq -r '.riderId // .RiderId' "${RIDE_RESP_FILE}")"
if [ "${RESP_RIDER_ID}" != "${RIDER_ID}" ]; then
  cv_fail "Ride response riderId ${RESP_RIDER_ID} does not match signed-up rider ${RIDER_ID}" $LINENO
fi
if ! printf '%s' "${RIDE_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "RideId in response is not numeric" $LINENO
fi

# Then
cv_step "Then" "Assert ride persisted with edited values and preset configuration unchanged except LastUsedAtUtc" $LINENO

# Fetch ride history and locate new ride
HISTORY_FILE="$(mktemp)"
HISTORY_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${BASE_URL}/api/rides/history
X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

HISTORY_STATUS="$(curl -sS -D "${HISTORY_HDR_FILE}" -o "${HISTORY_FILE}" -w "%{http_code}" \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}")"

RESPONSE_HEADERS="$(cat "${HISTORY_HDR_FILE}")"
RESPONSE_BODY="$(cat "${HISTORY_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "GET" "/api/rides/history" "${HISTORY_STATUS}"
if [ "${HISTORY_STATUS}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/history, got ${HISTORY_STATUS}" $LINENO
fi

RIDE_ROW_JSON="$(jq --argjson rideId "${RIDE_ID}" '.rides[] | select(.rideId == $rideId)' "${HISTORY_FILE}")"
if [ -z "${RIDE_ROW_JSON}" ]; then
  cv_fail "Newly recorded ride with id ${RIDE_ID} not found in history" $LINENO
fi

PERSISTED_MILES="$(printf '%s' "${RIDE_ROW_JSON}" | jq -r '.miles')"
PERSISTED_MINUTES="$(printf '%s' "${RIDE_ROW_JSON}" | jq -r '.rideMinutes // 0')"
PERSISTED_DIRECTION="$(printf '%s' "${RIDE_ROW_JSON}" | jq -r '.primaryTravelDirection')"

# Compare persisted miles and rideMinutes to edited values
if ! awk "BEGIN { exit (${PERSISTED_MILES} == ${EDITED_MILES} ? 0 : 1) }"; then
  cv_fail "Expected ride miles ${EDITED_MILES}, got ${PERSISTED_MILES}" $LINENO
fi

if [ "${PERSISTED_MINUTES}" -ne "${EDITED_DURATION}" ]; then
  cv_fail "Expected rideMinutes ${EDITED_DURATION}, got ${PERSISTED_MINUTES}" $LINENO
fi

# PrimaryTravelDirection should match canonical direction based on preset primaryDirection
if [ "${PERSISTED_DIRECTION}" != "${BASE_PRIMARY_DIRECTION}" ]; then
  cv_fail "Expected primaryTravelDirection '${BASE_PRIMARY_DIRECTION}', got '${PERSISTED_DIRECTION}'" $LINENO
fi

# Fetch presets again to verify configuration unchanged except LastUsedAtUtc on selected preset
PRESETS_AFTER_FILE="$(mktemp)"
PRESETS_AFTER_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${BASE_URL}/api/rides/presets
X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
echo "REQUEST_HEADERS:${REQUEST_HEADERS}"
echo "REQUEST_BODY:${REQUEST_BODY}"

PRESETS_AFTER_STATUS="$(curl -sS -D "${PRESETS_AFTER_HDR_FILE}" -o "${PRESETS_AFTER_FILE}" -w "%{http_code}" \
  -X GET "${BASE_URL}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_ID}")"

RESPONSE_HEADERS="$(cat "${PRESETS_AFTER_HDR_FILE}")"
RESPONSE_BODY="$(cat "${PRESETS_AFTER_FILE}")"
echo "RESPONSE_HEADERS:${RESPONSE_HEADERS}"
echo "RESPONSE_BODY:${RESPONSE_BODY}"

cv_http "GET" "/api/rides/presets" "${PRESETS_AFTER_STATUS}"
if [ "${PRESETS_AFTER_STATUS}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/presets after ride save, got ${PRESETS_AFTER_STATUS}" $LINENO
fi

SELECTED_AFTER_JSON="$(jq --argjson presetId "${SELECTED_PRESET_ID}" '.presets[] | select(.presetId == $presetId)' "${PRESETS_AFTER_FILE}")"
if [ -z "${SELECTED_AFTER_JSON}" ]; then
  cv_fail "Selected preset id ${SELECTED_PRESET_ID} not found in presets after ride save" $LINENO
fi

AFTER_MILES="$(printf '%s' "${SELECTED_AFTER_JSON}" | jq -r '.miles')"
AFTER_DURATION="$(printf '%s' "${SELECTED_AFTER_JSON}" | jq -r '.durationMinutes')"
AFTER_DIRECTION="$(printf '%s' "${SELECTED_AFTER_JSON}" | jq -r '.primaryDirection')"
AFTER_START_TIME="$(printf '%s' "${SELECTED_AFTER_JSON}" | jq -r '.exactStartTimeLocal')"
AFTER_LAST_USED="$(printf '%s' "${SELECTED_AFTER_JSON}" | jq -r '.lastUsedAtUtc')"

# Preset configuration fields remain unchanged
if ! awk "BEGIN { exit (${AFTER_MILES} == ${BASE_MILES} ? 0 : 1) }"; then
  cv_fail "Expected preset miles to remain ${BASE_MILES}, got ${AFTER_MILES}" $LINENO
fi

if [ "${AFTER_DURATION}" -ne "${BASE_DURATION}" ]; then
  cv_fail "Expected preset durationMinutes to remain ${BASE_DURATION}, got ${AFTER_DURATION}" $LINENO
fi

if [ "${AFTER_DIRECTION}" != "${BASE_PRIMARY_DIRECTION}" ]; then
  cv_fail "Expected preset primaryDirection to remain '${BASE_PRIMARY_DIRECTION}', got '${AFTER_DIRECTION}'" $LINENO
fi

if [ "${AFTER_START_TIME}" != "${BASE_START_TIME}" ]; then
  cv_fail "Expected preset exactStartTimeLocal to remain '${BASE_START_TIME}', got '${AFTER_START_TIME}" $LINENO
fi

# LastUsedAtUtc should now be non-null on the selected preset
if [ "${AFTER_LAST_USED}" = "null" ]; then
  cv_fail "Expected LastUsedAtUtc to be set after using preset, still null" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit cleanup; test data isolated in SQLite db file" $LINENO
# No cleanup needed: EF Core SQLite DB lives inside app container and is dedicated to this test run.

echo "CODEVALID_TEST_ASSERTION_OK:preset_population_and_manual_edit"
