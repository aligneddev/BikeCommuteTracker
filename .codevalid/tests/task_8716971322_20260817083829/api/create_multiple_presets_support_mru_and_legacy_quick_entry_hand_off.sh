#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: create_multiple_presets_support_mru_and_legacy_quick_entry_hand_off

# Mocks
cv_step "Given" "No vendor mocks needed; presets and rides do not call external APIs in this scenario" $LINENO
# This case exercises POST /api/rides/presets, GET /api/rides/presets, and POST /api/rides.
# None of these handlers call IGasPriceLookupService or IWeatherLookupService, so no WireMock mappings are required.

# Preconditions
cv_prereq "Signup a rider and capture userId for X-User-Id auth" $LINENO
cv_prereq "API healthcheck must pass before running preset tests" $LINENO

HEALTH_STATUS_FILE="$(mktemp)"
HEALTH_BODY_FILE="$(mktemp)"

# Healthcheck request
REQUEST_HEADERS="GET /health"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${HEALTH_BODY_FILE}.hdr" -o "$HEALTH_BODY_FILE" -w '%{http_code}' "http://app:${PORT}/health" >"$HEALTH_STATUS_FILE" || cv_fail "Healthcheck request failed" $LINENO
HEALTH_STATUS="$(cat "$HEALTH_STATUS_FILE")"

echo "RESPONSE_HEADERS:"
cat "${HEALTH_BODY_FILE}.hdr"
echo "RESPONSE_BODY:"
cat "$HEALTH_BODY_FILE"

cv_http "GET" "/health" "$HEALTH_STATUS"
if [ "$HEALTH_STATUS" != "200" ]; then
  cv_fail "Expected health status 200 got ${HEALTH_STATUS}" $LINENO
fi

SIGNUP_REQ_FILE="$(mktemp)"
SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"

# Use unique name per run to avoid collisions; PIN must satisfy backend pin policy (4+ digits).
RANDOM_SUFFIX="$(date +%s)"
cat >"$SIGNUP_REQ_FILE" <<EOF
{
  "name": "PresetMRUUser_${RANDOM_SUFFIX}",
  "pin": "1234"
}
EOF

# Signup request
REQUEST_HEADERS="POST /api/users/signup\
Content-Type: application/json"
REQUEST_BODY="$(cat "$SIGNUP_REQ_FILE")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${SIGNUP_RESP_FILE}.hdr" -o "$SIGNUP_RESP_FILE" -w '%{http_code}' \
  -X POST "http://app:${PORT}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$SIGNUP_REQ_FILE" >"$SIGNUP_STATUS_FILE" || cv_fail "Signup request failed" $LINENO
SIGNUP_STATUS="$(cat "$SIGNUP_STATUS_FILE")"

echo "RESPONSE_HEADERS:"
cat "${SIGNUP_RESP_FILE}.hdr"
echo "RESPONSE_BODY:"
cat "$SIGNUP_RESP_FILE"

cv_http "POST" "/api/users/signup" "$SIGNUP_STATUS"

if [ "$SIGNUP_STATUS" != "201" ]; then
  cv_fail "Expected 201 from signup got ${SIGNUP_STATUS}" $LINENO
fi

RIDER_ID="$(jq -r '.userId // .id // .riderId' "$SIGNUP_RESP_FILE")"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "Failed to extract riderId/userId from signup response" $LINENO
fi

# When
cv_step "When" "Create multiple ride presets and record a ride using one preset" $LINENO

# Create first preset: Morning Commute
CREATE_PRESET1_REQ_FILE="$(mktemp)"
CREATE_PRESET1_RESP_FILE="$(mktemp)"
CREATE_PRESET1_STATUS_FILE="$(mktemp)"

cat >"$CREATE_PRESET1_REQ_FILE" <<EOF
{
  "name": "Morning Commute",
  "primaryDirection": "SW",
  "periodTag": "morning",
  "exactStartTimeLocal": "07:45",
  "durationMinutes": 34,
  "miles": 7.2
}
EOF

# Create preset 1 request
REQUEST_HEADERS="POST /api/rides/presets\
Content-Type: application/json\
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$CREATE_PRESET1_REQ_FILE")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${CREATE_PRESET1_RESP_FILE}.hdr" -o "$CREATE_PRESET1_RESP_FILE" -w '%{http_code}' \
  -X POST "http://app:${PORT}/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$CREATE_PRESET1_REQ_FILE" >"$CREATE_PRESET1_STATUS_FILE" || cv_fail "Create preset 1 request failed" $LINENO
CREATE_PRESET1_STATUS="$(cat "$CREATE_PRESET1_STATUS_FILE")"

echo "RESPONSE_HEADERS:"
cat "${CREATE_PRESET1_RESP_FILE}.hdr"
echo "RESPONSE_BODY:"
cat "$CREATE_PRESET1_RESP_FILE"

cv_http "POST" "/api/rides/presets" "$CREATE_PRESET1_STATUS"

if [ "$CREATE_PRESET1_STATUS" != "201" ]; then
  cv_fail "Expected 201 when creating first preset got ${CREATE_PRESET1_STATUS}" $LINENO
fi

PRESET1_ID="$(jq -r '.presetId' "$CREATE_PRESET1_RESP_FILE")"
if [ -z "$PRESET1_ID" ] || [ "$PRESET1_ID" = "null" ]; then
  cv_fail "Failed to extract presetId for first preset" $LINENO
fi

# Create second preset: Afternoon Return
CREATE_PRESET2_REQ_FILE="$(mktemp)"
CREATE_PRESET2_RESP_FILE="$(mktemp)"
CREATE_PRESET2_STATUS_FILE="$(mktemp)"

cat >"$CREATE_PRESET2_REQ_FILE" <<EOF
{
  "name": "Afternoon Return",
  "primaryDirection": "NE",
  "periodTag": "afternoon",
  "exactStartTimeLocal": "17:35",
  "durationMinutes": 32,
  "miles": 8.1
}
EOF

# Create preset 2 request
REQUEST_HEADERS="POST /api/rides/presets\
Content-Type: application/json\
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$CREATE_PRESET2_REQ_FILE")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${CREATE_PRESET2_RESP_FILE}.hdr" -o "$CREATE_PRESET2_RESP_FILE" -w '%{http_code}' \
  -X POST "http://app:${PORT}/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$CREATE_PRESET2_REQ_FILE" >"$CREATE_PRESET2_STATUS_FILE" || cv_fail "Create preset 2 request failed" $LINENO
CREATE_PRESET2_STATUS="$(cat "$CREATE_PRESET2_STATUS_FILE")"

echo "RESPONSE_HEADERS:"
cat "${CREATE_PRESET2_RESP_FILE}.hdr"
echo "RESPONSE_BODY:"
cat "$CREATE_PRESET2_RESP_FILE"

cv_http "POST" "/api/rides/presets" "$CREATE_PRESET2_STATUS"

if [ "$CREATE_PRESET2_STATUS" != "201" ]; then
  cv_fail "Expected 201 when creating second preset got ${CREATE_PRESET2_STATUS}" $LINENO
fi

PRESET2_ID="$(jq -r '.presetId' "$CREATE_PRESET2_RESP_FILE")"
if [ -z "$PRESET2_ID" ] || [ "$PRESET2_ID" = "null" ]; then
  cv_fail "Failed to extract presetId for second preset" $LINENO
fi

# Record a ride using the first preset to update its LastUsedAtUtc for MRU ordering
RECORD_RIDE_REQ_FILE="$(mktemp)"
RECORD_RIDE_RESP_FILE="$(mktemp)"
RECORD_RIDE_STATUS_FILE="$(mktemp)"

CURRENT_LOCAL_ISO="$(date -u +"%Y-%m-%dT%H:%M")"

cat >"$RECORD_RIDE_REQ_FILE" <<EOF
{
  "rideDateTimeLocal": "${CURRENT_LOCAL_ISO}",
  "miles": 9.0,
  "rideMinutes": 30,
  "selectedPresetId": ${PRESET1_ID}
}
EOF

# Record ride request
REQUEST_HEADERS="POST /api/rides\
Content-Type: application/json\
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$RECORD_RIDE_REQ_FILE")"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${RECORD_RIDE_RESP_FILE}.hdr" -o "$RECORD_RIDE_RESP_FILE" -w '%{http_code}' \
  -X POST "http://app:${PORT}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$RECORD_RIDE_REQ_FILE" >"$RECORD_RIDE_STATUS_FILE" || cv_fail "Record ride request failed" $LINENO
RECORD_RIDE_STATUS="$(cat "$RECORD_RIDE_STATUS_FILE")"

echo "RESPONSE_HEADERS:"
cat "${RECORD_RIDE_RESP_FILE}.hdr"
echo "RESPONSE_BODY:"
cat "$RECORD_RIDE_RESP_FILE"

cv_http "POST" "/api/rides" "$RECORD_RIDE_STATUS"

if [ "$RECORD_RIDE_STATUS" != "201" ]; then
  cv_fail "Expected 201 when recording ride with selectedPresetId got ${RECORD_RIDE_STATUS}" $LINENO
fi

# Then
cv_step "Then" "Verify presets are persisted with correct fields and MRU ordering puts used preset first" $LINENO

LIST_PRESETS_RESP_FILE="$(mktemp)"
LIST_PRESETS_STATUS_FILE="$(mktemp)"

# List presets request
REQUEST_HEADERS="GET /api/rides/presets\
X-User-Id: ${RIDER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

curl -sS -D "${LIST_PRESETS_RESP_FILE}.hdr" -o "$LIST_PRESETS_RESP_FILE" -w '%{http_code}' \
  -X GET "http://app:${PORT}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_ID}" >"$LIST_PRESETS_STATUS_FILE" || cv_fail "List presets request failed" $LINENO
LIST_PRESETS_STATUS="$(cat "$LIST_PRESETS_STATUS_FILE")"

echo "RESPONSE_HEADERS:"
cat "${LIST_PRESETS_RESP_FILE}.hdr"
echo "RESPONSE_BODY:"
cat "$LIST_PRESETS_RESP_FILE"

cv_http "GET" "/api/rides/presets" "$LIST_PRESETS_STATUS"

if [ "$LIST_PRESETS_STATUS" != "200" ]; then
  cv_fail "Expected 200 when listing presets got ${LIST_PRESETS_STATUS}" $LINENO
fi

PRESET_COUNT="$(jq '.presets | length' "$LIST_PRESETS_RESP_FILE")"
if [ "$PRESET_COUNT" -lt 2 ]; then
  cv_fail "Expected at least 2 presets for rider got ${PRESET_COUNT}" $LINENO
fi

FIRST_PRESET_ID="$(jq -r '.presets[0].presetId' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_ID="$(jq -r '.presets[1].presetId' "$LIST_PRESETS_RESP_FILE")"

if [ "$FIRST_PRESET_ID" != "$PRESET1_ID" ]; then
  cv_fail "Expected first listed preset to be the one used in the ride (id ${PRESET1_ID}) got ${FIRST_PRESET_ID}" $LINENO
fi

if [ "$SECOND_PRESET_ID" != "$PRESET2_ID" ]; then
  cv_fail "Expected second listed preset to be the unused preset (id ${PRESET2_ID}) got ${SECOND_PRESET_ID}" $LINENO
fi

# Assert fields for first preset (Morning Commute) are correct and suitable for later Record Ride preset selection
FIRST_PRESET_NAME="$(jq -r '.presets[0].name' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_DIRECTION="$(jq -r '.presets[0].primaryDirection' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_PERIOD="$(jq -r '.presets[0].periodTag' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_TIME="$(jq -r '.presets[0].exactStartTimeLocal' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_DURATION="$(jq -r '.presets[0].durationMinutes' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_MILES="$(jq -r '.presets[0].miles' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_LAST_USED="$(jq -r '.presets[0].lastUsedAtUtc' "$LIST_PRESETS_RESP_FILE")"
FIRST_PRESET_UPDATED_AT="$(jq -r '.presets[0].updatedAtUtc' "$LIST_PRESETS_RESP_FILE")"

if [ "$FIRST_PRESET_NAME" != "Morning Commute" ]; then
  cv_fail "Expected first preset name 'Morning Commute' got ${FIRST_PRESET_NAME}" $LINENO
fi
if [ "$FIRST_PRESET_DIRECTION" != "SW" ]; then
  cv_fail "Expected first preset primaryDirection 'SW' got ${FIRST_PRESET_DIRECTION}" $LINENO
fi
if [ "$FIRST_PRESET_PERIOD" != "morning" ]; then
  cv_fail "Expected first preset periodTag 'morning' got ${FIRST_PRESET_PERIOD}" $LINENO
fi
if [ "$FIRST_PRESET_TIME" != "07:45" ]; then
  cv_fail "Expected first preset exactStartTimeLocal '07:45' got ${FIRST_PRESET_TIME}" $LINENO
fi
if [ "$FIRST_PRESET_DURATION" != "34" ]; then
  cv_fail "Expected first preset durationMinutes 34 got ${FIRST_PRESET_DURATION}" $LINENO
fi
if [ "$FIRST_PRESET_MILES" != "7.2" ]; then
  cv_fail "Expected first preset miles 7.2 got ${FIRST_PRESET_MILES}" $LINENO
fi
if [ "$FIRST_PRESET_LAST_USED" = "null" ]; then
  cv_fail "Expected first preset lastUsedAtUtc to be non-null after recording ride" $LINENO
fi
if [ "$FIRST_PRESET_UPDATED_AT" = "null" ]; then
  cv_fail "Expected first preset updatedAtUtc to be non-null" $LINENO
fi

# Assert fields for second preset (Afternoon Return) are persisted correctly and LastUsedAtUtc remains null
SECOND_PRESET_NAME="$(jq -r '.presets[1].name' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_DIRECTION="$(jq -r '.presets[1].primaryDirection' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_PERIOD="$(jq -r '.presets[1].periodTag' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_TIME="$(jq -r '.presets[1].exactStartTimeLocal' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_DURATION="$(jq -r '.presets[1].durationMinutes' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_MILES="$(jq -r '.presets[1].miles' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_LAST_USED="$(jq -r '.presets[1].lastUsedAtUtc' "$LIST_PRESETS_RESP_FILE")"
SECOND_PRESET_UPDATED_AT="$(jq -r '.presets[1].updatedAtUtc' "$LIST_PRESETS_RESP_FILE")"

if [ "$SECOND_PRESET_NAME" != "Afternoon Return" ]; then
  cv_fail "Expected second preset name 'Afternoon Return' got ${SECOND_PRESET_NAME}" $LINENO
fi
if [ "$SECOND_PRESET_DIRECTION" != "NE" ]; then
  cv_fail "Expected second preset primaryDirection 'NE' got ${SECOND_PRESET_DIRECTION}" $LINENO
fi
if [ "$SECOND_PRESET_PERIOD" != "afternoon" ]; then
  cv_fail "Expected second preset periodTag 'afternoon' got ${SECOND_PRESET_PERIOD}" $LINENO
fi
if [ "$SECOND_PRESET_TIME" != "17:35" ]; then
  cv_fail "Expected second preset exactStartTimeLocal '17:35' got ${SECOND_PRESET_TIME}" $LINENO
fi
if [ "$SECOND_PRESET_DURATION" != "32" ]; then
  cv_fail "Expected second preset durationMinutes 32 got ${SECOND_PRESET_DURATION}" $LINENO
fi
if [ "$SECOND_PRESET_MILES" != "8.1" ]; then
  cv_fail "Expected second preset miles 8.1 got ${SECOND_PRESET_MILES}" $LINENO
fi
if [ "$SECOND_PRESET_LAST_USED" != "null" ]; then
  cv_fail "Expected second preset lastUsedAtUtc to remain null when unused in rides got ${SECOND_PRESET_LAST_USED}" $LINENO
fi
if [ "$SECOND_PRESET_UPDATED_AT" = "null" ]; then
  cv_fail "Expected second preset updatedAtUtc to be non-null" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit teardown; SQLite DB is per-run and presets remain for MRU/preset behavior tests" $LINENO
# The test database is an app-local SQLite file; no additional cleanup is required here.
# Subsequent tests run with a fresh DB file according to docker-compose and infra configuration.

# Success marker required by runner
echo "CODEVALID_TEST_ASSERTION_OK:create_multiple_presets_support_mru_and_legacy_quick_entry_hand_off"
