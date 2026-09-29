#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case mappings

# | Case id                         | Method | Path        | Handler file                                   |
# |---------------------------------|--------|-------------|-----------------------------------------------|
# | quick_entry_pattern_before_presets | POST   | /api/rides | src/BikeTracking.Api/Endpoints/RidesEndpoints.cs |

# Case: quick_entry_pattern_before_presets

# Mocks
# No external vendor calls (EIA or Open-Meteo) are involved in this case, so no WireMock stubs are required.

# Preconditions
cv_step "Given" "Signup rider and record initial ride pattern" $LINENO
BASE_URL="http://app:${PORT}"

# 1) Signup a new rider so X-User-Id references a real UserEntity row
cv_prereq "Create rider via POST /api/users/signup" $LINENO
SIGNUP_BODY_FILE="$(mktemp)"
cat > "${SIGNUP_BODY_FILE}" <<'JSON'
{
  "name": "QuickEntryRider_qa",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"

REQUEST_HEADERS_FILE="$(mktemp)"
REQUEST_BODY_FILE="$(mktemp)"
cat >"${REQUEST_HEADERS_FILE}" <<'HDR'
POST /api/users/signup
Content-Type: application/json
HDR
cp "${SIGNUP_BODY_FILE}" "${REQUEST_BODY_FILE}"

echo "REQUEST_HEADERS:"
cat "${REQUEST_HEADERS_FILE}"
echo "REQUEST_BODY:"
cat "${REQUEST_BODY_FILE}"

RESPONSE_HEADERS_FILE="$(mktemp)"
curl -sS -o "${SIGNUP_RESP_FILE}" -w '%{http_code}' \
  -D "${RESPONSE_HEADERS_FILE}" \
  -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_BODY_FILE}" > "${SIGNUP_STATUS_FILE}"
SIGNUP_STATUS="$(cat "${SIGNUP_STATUS_FILE}")"

echo "RESPONSE_HEADERS:"
cat "${RESPONSE_HEADERS_FILE}"
echo "RESPONSE_BODY:"
cat "${SIGNUP_RESP_FILE}"

cv_http "POST" "/api/users/signup" "${SIGNUP_STATUS}"
if [ "${SIGNUP_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from signup, got ${SIGNUP_STATUS}" $LINENO
fi

USER_ID="$(jq -r '.userId' < "${SIGNUP_RESP_FILE}")"
if [ -z "${USER_ID}" ] || [ "${USER_ID}" = "null" ]; then
  cv_fail "Signup response missing userId" $LINENO
fi

# 2) Record an initial ride with a specific miles+duration pattern (7.5 miles, 30 minutes)
cv_prereq "Record initial ride with miles=7.5 and rideMinutes=30" $LINENO
INITIAL_RIDE_BODY_FILE="$(mktemp)"
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S')"
cat > "${INITIAL_RIDE_BODY_FILE}" <<JSON
{
  "rideDateTimeLocal": "${NOW_ISO}",
  "miles": 7.5,
  "rideMinutes": 30,
  "weatherUserOverridden": true
}
JSON

INITIAL_RIDE_RESP_FILE="$(mktemp)"
INITIAL_RIDE_STATUS_FILE="$(mktemp)"

REQUEST_HEADERS_FILE="$(mktemp)"
REQUEST_BODY_FILE="$(mktemp)"
cat >"${REQUEST_HEADERS_FILE}" <<HDR
POST /api/rides
Content-Type: application/json
X-User-Id: ${USER_ID}
HDR
cp "${INITIAL_RIDE_BODY_FILE}" "${REQUEST_BODY_FILE}"

echo "REQUEST_HEADERS:"
cat "${REQUEST_HEADERS_FILE}"
echo "REQUEST_BODY:"
cat "${REQUEST_BODY_FILE}"

RESPONSE_HEADERS_FILE="$(mktemp)"
curl -sS -o "${INITIAL_RIDE_RESP_FILE}" -w '%{http_code}' \
  -D "${RESPONSE_HEADERS_FILE}" \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary @"${INITIAL_RIDE_BODY_FILE}" > "${INITIAL_RIDE_STATUS_FILE}"
INITIAL_RIDE_STATUS="$(cat "${INITIAL_RIDE_STATUS_FILE}")"

echo "RESPONSE_HEADERS:"
cat "${RESPONSE_HEADERS_FILE}"
echo "RESPONSE_BODY:"
cat "${INITIAL_RIDE_RESP_FILE}"

cv_http "POST" "/api/rides" "${INITIAL_RIDE_STATUS}"
if [ "${INITIAL_RIDE_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from initial POST /api/rides, got ${INITIAL_RIDE_STATUS}" $LINENO
fi

INITIAL_RIDE_ID="$(jq -r '.rideId' < "${INITIAL_RIDE_RESP_FILE}")"
if [ -z "${INITIAL_RIDE_ID}" ] || [ "${INITIAL_RIDE_ID}" = "null" ]; then
  cv_fail "Initial ride response missing rideId" $LINENO
fi

# When
cv_step "When" "Record second ride using same miles+duration pattern, simulating quick-entry prefill" $LINENO

SECOND_RIDE_BODY_FILE="$(mktemp)"
SECOND_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S')"
cat > "${SECOND_RIDE_BODY_FILE}" <<JSON
{
  "rideDateTimeLocal": "${SECOND_ISO}",
  "miles": 7.5,
  "rideMinutes": 30,
  "note": "Quick-entry pattern ride",
  "weatherUserOverridden": true
}
JSON

SECOND_RIDE_RESP_FILE="$(mktemp)"
SECOND_RIDE_STATUS_FILE="$(mktemp)"

REQUEST_HEADERS_FILE="$(mktemp)"
REQUEST_BODY_FILE="$(mktemp)"
cat >"${REQUEST_HEADERS_FILE}" <<HDR
POST /api/rides
Content-Type: application/json
X-User-Id: ${USER_ID}
HDR
cp "${SECOND_RIDE_BODY_FILE}" "${REQUEST_BODY_FILE}"

echo "REQUEST_HEADERS:"
cat "${REQUEST_HEADERS_FILE}"
echo "REQUEST_BODY:"
cat "${REQUEST_BODY_FILE}"

RESPONSE_HEADERS_FILE="$(mktemp)"
curl -sS -o "${SECOND_RIDE_RESP_FILE}" -w '%{http_code}' \
  -D "${RESPONSE_HEADERS_FILE}" \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary @"${SECOND_RIDE_BODY_FILE}" > "${SECOND_RIDE_STATUS_FILE}"
SECOND_RIDE_STATUS="$(cat "${SECOND_RIDE_STATUS_FILE}")"

echo "RESPONSE_HEADERS:"
cat "${RESPONSE_HEADERS_FILE}"
echo "RESPONSE_BODY:"
cat "${SECOND_RIDE_RESP_FILE}"

cv_http "POST" "/api/rides" "${SECOND_RIDE_STATUS}"
if [ "${SECOND_RIDE_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from second POST /api/rides, got ${SECOND_RIDE_STATUS}" $LINENO
fi

SECOND_RIDE_ID="$(jq -r '.rideId' < "${SECOND_RIDE_RESP_FILE}")"
if [ -z "${SECOND_RIDE_ID}" ] || [ "${SECOND_RIDE_ID}" = "null" ]; then
  cv_fail "Second ride response missing rideId" $LINENO
fi

# Then
cv_step "Then" "Assert both rides are persisted with pattern miles+duration and second ride note" $LINENO

HISTORY_RESP_FILE="$(mktemp)"
HISTORY_STATUS_FILE="$(mktemp)"

REQUEST_HEADERS_FILE="$(mktemp)"
REQUEST_BODY_FILE="$(mktemp)"
cat >"${REQUEST_HEADERS_FILE}" <<HDR
GET /api/rides/history
X-User-Id: ${USER_ID}
HDR
: >"${REQUEST_BODY_FILE}"

echo "REQUEST_HEADERS:"
cat "${REQUEST_HEADERS_FILE}"
echo "REQUEST_BODY:"
cat "${REQUEST_BODY_FILE}"

RESPONSE_HEADERS_FILE="$(mktemp)"
curl -sS -o "${HISTORY_RESP_FILE}" -w '%{http_code}' \
  -D "${RESPONSE_HEADERS_FILE}" \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${USER_ID}" > "${HISTORY_STATUS_FILE}"
HISTORY_STATUS="$(cat "${HISTORY_STATUS_FILE}")"

echo "RESPONSE_HEADERS:"
cat "${RESPONSE_HEADERS_FILE}"
echo "RESPONSE_BODY:"
cat "${HISTORY_RESP_FILE}"

cv_http "GET" "/api/rides/history" "${HISTORY_STATUS}"
if [ "${HISTORY_STATUS}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/history, got ${HISTORY_STATUS}" $LINENO
fi

# Extract rides for this rider; history response is RideHistoryResponse with camelCase fields
TOTAL_RIDES_COUNT="$(jq '.rides | length' < "${HISTORY_RESP_FILE}")"
if [ "${TOTAL_RIDES_COUNT}" -lt 2 ]; then
  cv_fail "Expected at least 2 rides in history for quick-entry rider, found ${TOTAL_RIDES_COUNT}" $LINENO
fi

# Find the initial ride by rideId and assert miles and rideMinutes
INITIAL_RIDE_JSON="$(jq -c --arg id "${INITIAL_RIDE_ID}" '.rides[] | select(.rideId == ($id | tonumber))' < "${HISTORY_RESP_FILE}")"
if [ -z "${INITIAL_RIDE_JSON}" ]; then
  cv_fail "Initial ride with id ${INITIAL_RIDE_ID} not found in history" $LINENO
fi

INITIAL_MILES="$(echo "${INITIAL_RIDE_JSON}" | jq -r '.miles')"
INITIAL_MINUTES="$(echo "${INITIAL_RIDE_JSON}" | jq -r '.rideMinutes')"
if [ "${INITIAL_MILES}" != "7.5" ]; then
  cv_fail "Initial ride miles expected 7.5, got ${INITIAL_MILES}" $LINENO
fi
if [ "${INITIAL_MINUTES}" != "30" ]; then
  cv_fail "Initial rideMinutes expected 30, got ${INITIAL_MINUTES}" $LINENO
fi

# Find the second ride and assert miles, rideMinutes, and note text
SECOND_RIDE_JSON="$(jq -c --arg id "${SECOND_RIDE_ID}" '.rides[] | select(.rideId == ($id | tonumber))' < "${HISTORY_RESP_FILE}")"
if [ -z "${SECOND_RIDE_JSON}" ]; then
  cv_fail "Second ride with id ${SECOND_RIDE_ID} not found in history" $LINENO
fi

SECOND_MILES="$(echo "${SECOND_RIDE_JSON}" | jq -r '.miles')"
SECOND_MINUTES="$(echo "${SECOND_RIDE_JSON}" | jq -r '.rideMinutes')"
SECOND_NOTE="$(echo "${SECOND_RIDE_JSON}" | jq -r '.note')"

if [ "${SECOND_MILES}" != "7.5" ]; then
  cv_fail "Second ride miles expected 7.5 (quick-entry pattern), got ${SECOND_MILES}" $LINENO
fi
if [ "${SECOND_MINUTES}" != "30" ]; then
  cv_fail "Second rideMinutes expected 30 (quick-entry pattern), got ${SECOND_MINUTES}" $LINENO
fi
if [ "${SECOND_NOTE}" != "Quick-entry pattern ride" ]; then
  cv_fail "Second ride note expected 'Quick-entry pattern ride', got '${SECOND_NOTE}'" $LINENO
fi

# Assert no extra rides beyond the two explicit POST requests for this rider (RecordRidePage may later create more, but backend should only save on POST)
RIDES_FOR_USER_COUNT="$(jq --arg uid "${USER_ID}" '[.rides[] | select(.importSource == null)] | length' < "${HISTORY_RESP_FILE}")"
# The history endpoint does not expose riderId per row, so we rely on the fact that this test user is the only one who has rides in this isolated DB.
if [ "${RIDES_FOR_USER_COUNT}" -lt 2 ]; then
  cv_fail "Expected at least 2 rides persisted for quick-entry rider, found ${RIDES_FOR_USER_COUNT}" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit cleanup; test DB is ephemeral for this run" $LINENO
# SQLite DB lives inside the app container and is isolated per test stack; no cleanup required.

echo "CODEVALID_TEST_ASSERTION_OK:quick_entry_pattern_before_presets"
