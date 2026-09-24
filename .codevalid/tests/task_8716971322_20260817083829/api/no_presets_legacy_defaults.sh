#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: no_presets_legacy_defaults

# Preconditions
cv_step "Given" "Signup rider and record an initial ride without presets" $LINENO

BASE_URL="http://app:${PORT}"

# 1) Sign up a new rider via POST /api/users/signup
cv_prereq "Sign up a rider to obtain a valid X-User-Id" $LINENO

SIGNUP_REQ_BODY="$(jq -n --arg name "no-presets-legacy-$(date +%s)" --arg pin "1234" '{name:$name, pin:$pin}')"

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="${SIGNUP_REQ_BODY}"
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -D "${SIGNUP_HDR_FILE}" -o "${SIGNUP_RESP_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data "${SIGNUP_REQ_BODY}" > "${SIGNUP_STATUS_FILE}"
SIGNUP_STATUS="$(cat "${SIGNUP_STATUS_FILE}")"

RESPONSE_HEADERS="$(cat "${SIGNUP_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SIGNUP_RESP_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "POST" "/api/users/signup" "${SIGNUP_STATUS}"

if [ "${SIGNUP_STATUS}" -ne 201 ]; then
  cv_fail "Expected 201 from POST /api/users/signup, got ${SIGNUP_STATUS}" $LINENO
fi

USER_ID="$(jq -r '.userId' < "${SIGNUP_RESP_FILE}")"
if ! printf '%s
' "${USER_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Signup response missing numeric userId" $LINENO
fi

# 2) Record an initial ride to establish prior history (no presets involved)
cv_prereq "Record initial ride without presets to create prior ride history" $LINENO

INITIAL_RIDE_REQ_FILE="$(mktemp)"
# Use current local time; backend only requires a valid DateTime and miles > 0
INITIAL_RIDE_DATETIME="$(date -u +'%Y-%m-%dT%H:%M:%S')"
jq -n --arg dt "${INITIAL_RIDE_DATETIME}" \
  '{rideDateTimeLocal: $dt, miles: 5.5}' > "${INITIAL_RIDE_REQ_FILE}"

INITIAL_RIDE_RESP_FILE="$(mktemp)"
INITIAL_RIDE_STATUS_FILE="$(mktemp)"
INITIAL_RIDE_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${USER_ID}"
REQUEST_BODY="$(cat "${INITIAL_RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -D "${INITIAL_RIDE_HDR_FILE}" -o "${INITIAL_RIDE_RESP_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data @"${INITIAL_RIDE_REQ_FILE}" > "${INITIAL_RIDE_STATUS_FILE}"
INITIAL_RIDE_STATUS="$(cat "${INITIAL_RIDE_STATUS_FILE}")"

RESPONSE_HEADERS="$(cat "${INITIAL_RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${INITIAL_RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "POST" "/api/rides" "${INITIAL_RIDE_STATUS}"

if [ "${INITIAL_RIDE_STATUS}" -ne 201 ]; then
  cv_fail "Expected 201 from initial POST /api/rides, got ${INITIAL_RIDE_STATUS}" $LINENO
fi

INITIAL_RIDE_ID="$(jq -r '.rideId' < "${INITIAL_RIDE_RESP_FILE}")"
if ! printf '%s
' "${INITIAL_RIDE_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Initial ride response missing numeric rideId" $LINENO
fi

# Ensure no presets exist for this rider (we never create any via /api/rides/presets)
cv_prereq "Confirm rider has no presets configured (no calls to presets endpoints)" $LINENO
# No-op: by design, we do not hit /api/rides/presets create endpoint, so RidePresets table remains empty for this rider in this test.

# When
cv_step "When" "Record a second ride with full fields, omitting selectedPresetId" $LINENO

SECOND_RIDE_REQ_FILE="$(mktemp)"

# Prepare explicit values for all relevant fields
SECOND_RIDE_DATETIME="$(date -u +'%Y-%m-%dT%H:%M:%S')"          # valid ISO timestamp
SECOND_RIDE_MILES="12.75"                                      # within (0, 200]
SECOND_RIDE_MINUTES="45"                                      # > 0
SECOND_RIDE_TEMPERATURE="68.5"                                # °F
SECOND_RIDE_GAS_PRICE="3.4567"                                # positive decimal, within DataAnnotations range
SECOND_RIDE_WIND_SPEED="15.0"                                 # between 0 and 500 mph
SECOND_RIDE_WIND_DIRECTION_DEG="180"                          # 0–360°
SECOND_RIDE_HUMIDITY="55"                                     # 0–100%
SECOND_RIDE_CLOUD_COVER="40"                                  # 0–100%
SECOND_RIDE_PRECIP_TYPE="rain"                                # <= 50 chars
SECOND_RIDE_NOTE="Evening commute ride with moderate tailwind and light rain."  # <= 500 chars
SECOND_RIDE_DIFFICULTY="2"                                   # between 1 and 5
SECOND_RIDE_PRIMARY_DIRECTION="South"                        # canonical direction string
SECOND_RIDE_IMPORT_SOURCE="seed-test-no-presets"             # <= 64 chars

# Build RecordRideRequest JSON; omit selectedPresetId explicitly
jq -n \
  --arg dt "${SECOND_RIDE_DATETIME}" \
  --arg miles "${SECOND_RIDE_MILES}" \
  --arg minutes "${SECOND_RIDE_MINUTES}" \
  --arg temp "${SECOND_RIDE_TEMPERATURE}" \
  --arg gas "${SECOND_RIDE_GAS_PRICE}" \
  --arg windSpeed "${SECOND_RIDE_WIND_SPEED}" \
  --arg windDir "${SECOND_RIDE_WIND_DIRECTION_DEG}" \
  --arg humidity "${SECOND_RIDE_HUMIDITY}" \
  --arg cloud "${SECOND_RIDE_CLOUD_COVER}" \
  --arg precip "${SECOND_RIDE_PRECIP_TYPE}" \
  --arg note "${SECOND_RIDE_NOTE}" \
  --arg difficulty "${SECOND_RIDE_DIFFICULTY}" \
  --arg primaryDir "${SECOND_RIDE_PRIMARY_DIRECTION}" \
  --arg importSource "${SECOND_RIDE_IMPORT_SOURCE}" \
  '{
    rideDateTimeLocal: $dt,
    miles: ($miles | tonumber),
    rideMinutes: ($minutes | tonumber),
    temperature: ($temp | tonumber),
    gasPricePerGallon: ($gas | tonumber),
    windSpeedMph: ($windSpeed | tonumber),
    windDirectionDeg: ($windDir | tonumber),
    relativeHumidityPercent: ($humidity | tonumber),
    cloudCoverPercent: ($cloud | tonumber),
    precipitationType: $precip,
    note: $note,
    weatherUserOverridden: true,
    difficulty: ($difficulty | tonumber),
    primaryTravelDirection: $primaryDir,
    importSource: $importSource
  }' > "${SECOND_RIDE_REQ_FILE}"

SECOND_RIDE_RESP_FILE="$(mktemp)"
SECOND_RIDE_STATUS_FILE="$(mktemp)"
SECOND_RIDE_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${USER_ID}"
REQUEST_BODY="$(cat "${SECOND_RIDE_REQ_FILE}")"
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -D "${SECOND_RIDE_HDR_FILE}" -o "${SECOND_RIDE_RESP_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data @"${SECOND_RIDE_REQ_FILE}" > "${SECOND_RIDE_STATUS_FILE}"
SECOND_RIDE_STATUS="$(cat "${SECOND_RIDE_STATUS_FILE}")"

RESPONSE_HEADERS="$(cat "${SECOND_RIDE_HDR_FILE}")"
RESPONSE_BODY="$(cat "${SECOND_RIDE_RESP_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "POST" "/api/rides" "${SECOND_RIDE_STATUS}"

if [ "${SECOND_RIDE_STATUS}" -ne 201 ]; then
  cv_fail "Expected 201 from second POST /api/rides, got ${SECOND_RIDE_STATUS}" $LINENO
fi

SECOND_RIDE_ID="$(jq -r '.rideId' < "${SECOND_RIDE_RESP_FILE}")"
SECOND_RIDER_ID_FIELD="$(jq -r '.riderId' < "${SECOND_RIDE_RESP_FILE}")"

if ! printf '%s
' "${SECOND_RIDE_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Second ride response missing numeric rideId" $LINENO
fi

if [ "${SECOND_RIDER_ID_FIELD}" != "${USER_ID}" ]; then
  cv_fail "Second ride response riderId ${SECOND_RIDER_ID_FIELD} does not match signed-up userId ${USER_ID}" $LINENO
fi

# Then
cv_step "Then" "Assert second ride is persisted with submitted fields and no preset metadata" $LINENO

HISTORY_RESP_FILE="$(mktemp)"
HISTORY_STATUS_FILE="$(mktemp)"
HISTORY_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -D "${HISTORY_HDR_FILE}" -o "${HISTORY_RESP_FILE}" -w '%{http_code}' \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${USER_ID}" > "${HISTORY_STATUS_FILE}"
HISTORY_STATUS="$(cat "${HISTORY_STATUS_FILE}")"

RESPONSE_HEADERS="$(cat "${HISTORY_HDR_FILE}")"
RESPONSE_BODY="$(cat "${HISTORY_RESP_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "GET" "/api/rides/history" "${HISTORY_STATUS}"

if [ "${HISTORY_STATUS}" -ne 200 ]; then
  cv_fail "Expected 200 from GET /api/rides/history, got ${HISTORY_STATUS}" $LINENO
fi

# Extract the ride row matching SECOND_RIDE_ID (RideHistoryResponse uses camelCase)
SECOND_RIDE_ROW="$(jq --arg id "${SECOND_RIDE_ID}" '.rides[] | select(.rideId == ($id | tonumber))' < "${HISTORY_RESP_FILE}")"

if [ -z "${SECOND_RIDE_ROW}" ]; then
  cv_fail "Second ride with rideId ${SECOND_RIDE_ID} not found in history response" $LINENO
fi

# Assert core fields match submitted values

# rideDateTimeLocal preserved (compare up to seconds)
RECORDED_DT="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.rideDateTimeLocal')"
# Normalize both by stripping timezone offset if present and seconds precision, comparing prefix
STRIP_RECORDED_DT="$(printf '%s
' "${RECORDED_DT}" | sed -E 's/([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}):[0-9]{2}.*/\1/')"
STRIP_EXPECTED_DT="$(printf '%s
' "${SECOND_RIDE_DATETIME}" | sed -E 's/([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}):[0-9]{2}.*/\1/')"

if [ "${STRIP_RECORDED_DT}" != "${STRIP_EXPECTED_DT}" ]; then
  cv_fail "rideDateTimeLocal mismatch; expected prefix ${STRIP_EXPECTED_DT}, got ${STRIP_RECORDED_DT}" $LINENO
fi

# miles
RECORDED_MILES="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.miles')"
if ! awk "BEGIN {exit !(${RECORDED_MILES} == ${SECOND_RIDE_MILES})}"; then
  cv_fail "Miles mismatch; expected ${SECOND_RIDE_MILES}, got ${RECORDED_MILES}" $LINENO
fi

# rideMinutes
RECORDED_MINUTES="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.rideMinutes')"
if [ "${RECORDED_MINUTES}" != "${SECOND_RIDE_MINUTES}" ]; then
  cv_fail "RideMinutes mismatch; expected ${SECOND_RIDE_MINUTES}, got ${RECORDED_MINUTES}" $LINENO
fi

# temperature
RECORDED_TEMP="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.temperature')"
if ! awk "BEGIN {exit !(${RECORDED_TEMP} == ${SECOND_RIDE_TEMPERATURE})}"; then
  cv_fail "Temperature mismatch; expected ${SECOND_RIDE_TEMPERATURE}, got ${RECORDED_TEMP}" $LINENO
fi

# gasPricePerGallon
RECORDED_GAS="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.gasPricePerGallon')"
if ! awk "BEGIN {exit !(${RECORDED_GAS} == ${SECOND_RIDE_GAS_PRICE})}"; then
  cv_fail "GasPricePerGallon mismatch; expected ${SECOND_RIDE_GAS_PRICE}, got ${RECORDED_GAS}" $LINENO
fi

# windSpeedMph
RECORDED_WIND_SPEED="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.windSpeedMph')"
if ! awk "BEGIN {exit !(${RECORDED_WIND_SPEED} == ${SECOND_RIDE_WIND_SPEED})}"; then
  cv_fail "WindSpeedMph mismatch; expected ${SECOND_RIDE_WIND_SPEED}, got ${RECORDED_WIND_SPEED}" $LINENO
fi

# windDirectionDeg
RECORDED_WIND_DIR="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.windDirectionDeg')"
if [ "${RECORDED_WIND_DIR}" != "${SECOND_RIDE_WIND_DIRECTION_DEG}" ]; then
  cv_fail "WindDirectionDeg mismatch; expected ${SECOND_RIDE_WIND_DIRECTION_DEG}, got ${RECORDED_WIND_DIR}" $LINENO
fi

# relativeHumidityPercent
RECORDED_HUMIDITY="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.relativeHumidityPercent')"
if [ "${RECORDED_HUMIDITY}" != "${SECOND_RIDE_HUMIDITY}" ]; then
  cv_fail "RelativeHumidityPercent mismatch; expected ${SECOND_RIDE_HUMIDITY}, got ${RECORDED_HUMIDITY}" $LINENO
fi

# cloudCoverPercent
RECORDED_CLOUD_COVER="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.cloudCoverPercent')"
if [ "${RECORDED_CLOUD_COVER}" != "${SECOND_RIDE_CLOUD_COVER}" ]; then
  cv_fail "CloudCoverPercent mismatch; expected ${SECOND_RIDE_CLOUD_COVER}, got ${RECORDED_CLOUD_COVER}" $LINENO
fi

# precipitationType
RECORDED_PRECIP="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.precipitationType')"
if [ "${RECORDED_PRECIP}" != "${SECOND_RIDE_PRECIP_TYPE}" ]; then
  cv_fail "PrecipitationType mismatch; expected ${SECOND_RIDE_PRECIP_TYPE}, got ${RECORDED_PRECIP}" $LINENO
fi

# note
RECORDED_NOTE="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.note')"
if [ "${RECORDED_NOTE}" != "${SECOND_RIDE_NOTE}" ]; then
  cv_fail "Note mismatch; expected '${SECOND_RIDE_NOTE}', got '${RECORDED_NOTE}'" $LINENO
fi

# weatherUserOverridden (boolean)
RECORDED_WEATHER_OVERRIDDEN="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.weatherUserOverridden')"
if [ "${RECORDED_WEATHER_OVERRIDDEN}" != "true" ]; then
  cv_fail "WeatherUserOverridden mismatch; expected true, got ${RECORDED_WEATHER_OVERRIDDEN}" $LINENO
fi

# difficulty
RECORDED_DIFFICULTY="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.difficulty')"
if [ "${RECORDED_DIFFICULTY}" != "${SECOND_RIDE_DIFFICULTY}" ]; then
  cv_fail "Difficulty mismatch; expected ${SECOND_RIDE_DIFFICULTY}, got ${RECORDED_DIFFICULTY}" $LINENO
fi

# primaryTravelDirection
RECORDED_PRIMARY_DIR="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.primaryTravelDirection')"
if [ "${RECORDED_PRIMARY_DIR}" != "${SECOND_RIDE_PRIMARY_DIRECTION}" ]; then
  cv_fail "PrimaryTravelDirection mismatch; expected ${SECOND_RIDE_PRIMARY_DIRECTION}, got ${RECORDED_PRIMARY_DIR}" $LINENO
fi

# windResistanceRating should be non-null when both direction and windSpeedMph are present.
RECORDED_WIND_RESISTANCE="$(printf '%s
' "${SECOND_RIDE_ROW}" | jq -r '.windResistanceRating')"
if [ "${RECORDED_WIND_RESISTANCE}" = "null" ]; then
  cv_fail "WindResistanceRating is null; expected non-null rating when windSpeedMph and primaryTravelDirection are provided" $LINENO
fi

# Ensure no preset metadata is attached: RideHistoryRow does not contain any preset id field.
# We assert that JSON object for the ride has only the expected known keys and does not include a selectedPresetId or presetId property.
if printf '%s
' "${SECOND_RIDE_ROW}" | jq -e 'has("selectedPresetId") or has("presetId")' > /dev/null; then
  cv_fail "History row for rideId ${SECOND_RIDE_ID} unexpectedly contains preset-related fields" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit cleanup; rides remain in SQLite DB for historical integrity" $LINENO
# Per efcore-sqlite skill, we do not attempt direct DB cleanup; the ephemeral test database is discarded when the app container stops.

echo "CODEVALID_TEST_ASSERTION_OK:no_presets_legacy_defaults"
