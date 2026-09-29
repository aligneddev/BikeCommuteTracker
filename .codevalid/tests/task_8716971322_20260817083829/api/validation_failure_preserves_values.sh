#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step "Given" "No vendor mocks required; ride validation fails before external calls" $LINENO

cv_prereq "Create a rider via signup and verify no existing rides" $LINENO

BASE_URL="http://app:${PORT}"

# 1) Signup a new user to obtain a real userId for X-User-Id authentication
cv_prereq "Signup rider via POST /api/users/signup" $LINENO
SIGNUP_BODY_FILE="$(mktemp)"
cat > "${SIGNUP_BODY_FILE}" <<'JSON'
{
  "name": "ValidationFailureRider",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "${SIGNUP_BODY_FILE}")"
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

curl -sS -D "${SIGNUP_HDR_FILE}" -o "${SIGNUP_RESP_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_BODY_FILE}" >"${SIGNUP_STATUS_FILE}"

SIGNUP_STATUS="$(cat "${SIGNUP_STATUS_FILE}")"
cv_http "POST" "/api/users/signup" "${SIGNUP_STATUS}"

printf 'RESPONSE_HEADERS
'
cat "${SIGNUP_HDR_FILE}"
printf 'RESPONSE_BODY
'
cat "${SIGNUP_RESP_FILE}"

if [ "${SIGNUP_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from signup but got ${SIGNUP_STATUS}" $LINENO
fi

RIDER_ID="$(jq -r '.userId // .UserId' < "${SIGNUP_RESP_FILE}")"
if [ -z "${RIDER_ID}" ] || [ "${RIDER_ID}" = "null" ]; then
  cv_fail "Signup response did not contain userId" $LINENO
fi

# 2) Confirm initial ride history is empty for this rider
cv_prereq "Ensure ride history is empty before invalid POST" $LINENO
HIST_RESP_FILE_BEFORE="$(mktemp)"
HIST_STATUS_FILE_BEFORE="$(mktemp)"
HIST_HDR_FILE_BEFORE="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

curl -sS -D "${HIST_HDR_FILE_BEFORE}" -o "${HIST_RESP_FILE_BEFORE}" -w '%{http_code}' \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}" >"${HIST_STATUS_FILE_BEFORE}"

HIST_STATUS_BEFORE="$(cat "${HIST_STATUS_FILE_BEFORE}")"
cv_http "GET" "/api/rides/history" "${HIST_STATUS_BEFORE}"

printf 'RESPONSE_HEADERS
'
cat "${HIST_HDR_FILE_BEFORE}"
printf 'RESPONSE_BODY
'
cat "${HIST_RESP_FILE_BEFORE}"

if [ "${HIST_STATUS_BEFORE}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/history before test but got ${HIST_STATUS_BEFORE}" $LINENO
fi

RIDES_COUNT_BEFORE="$(jq '.rides | length' < "${HIST_RESP_FILE_BEFORE}")"
if [ "${RIDES_COUNT_BEFORE}" -ne 0 ]; then
  cv_fail "Expected 0 rides before validation test but found ${RIDES_COUNT_BEFORE}" $LINENO
fi

cv_step "When" "POST /api/rides with multiple invalid fields" $LINENO

# Build a RecordRideRequest with:
# - RideDateTimeLocal: valid current timestamp
# - Miles: 0 (invalid: must be > 0)
# - RideMinutes: 0 (invalid: must be > 0 when provided)
# - GasPricePerGallon: negative value (invalid range)
# - Note: 501-character string (invalid: max 500)
NOW_ISO="$(date -u +'%Y-%m-%dT%H:%M:%S')"

INVALID_NOTE="$(printf 'x%.0s' $(seq 1 501))"

REQUEST_BODY_FILE="$(mktemp)"
cat > "${REQUEST_BODY_FILE}" <<JSON
{
  "rideDateTimeLocal": "${NOW_ISO}",
  "miles": 0,
  "rideMinutes": 0,
  "temperature": null,
  "gasPricePerGallon": -1.2345,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": "rain",
  "note": "${INVALID_NOTE}",
  "weatherUserOverridden": true,
  "difficulty": 0,
  "primaryTravelDirection": "InvalidDir",
  "selectedPresetId": -5,
  "importSource": "validation-test"
}
JSON

RESP_BODY_FILE="$(mktemp)"
RESP_STATUS_FILE="$(mktemp)"
RESP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS=$(printf 'Content-Type: application/json
X-User-Id: %s' "${RIDER_ID}")
REQUEST_BODY="$(cat "${REQUEST_BODY_FILE}")"
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

curl -sS -D "${RESP_HDR_FILE}" -o "${RESP_BODY_FILE}" -w '%{http_code}' \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${REQUEST_BODY_FILE}" >"${RESP_STATUS_FILE}"

RESP_STATUS="$(cat "${RESP_STATUS_FILE}")"
cv_http "POST" "/api/rides" "${RESP_STATUS}"

printf 'RESPONSE_HEADERS
'
cat "${RESP_HDR_FILE}"
printf 'RESPONSE_BODY
'
cat "${RESP_BODY_FILE}"

cv_step "Then" "Assert POST /api/rides failed with 400 and no ride persisted" $LINENO

# 1) Assert HTTP status 400 Bad Request
if [ "${RESP_STATUS}" != "400" ]; then
  cv_fail "Expected 400 from POST /api/rides for invalid input but got ${RESP_STATUS}" $LINENO
fi

# 2) Assert ErrorResponse shape and that message mentions validation failures
ERROR_CODE="$(jq -r '.code // .Code // empty' < "${RESP_BODY_FILE}")"
ERROR_MESSAGE="$(jq -r '.message // .Message // empty' < "${RESP_BODY_FILE}")"

if [ -z "${ERROR_CODE}" ]; then
  cv_fail "Expected ErrorResponse.code in 400 body but found none" $LINENO
fi

if [ -z "${ERROR_MESSAGE}" ]; then
  cv_fail "Expected ErrorResponse.message in 400 body but found none" $LINENO
fi

# The app uses sequential service-layer guards (first-error-only): only the first
# failing check is returned in the 400 response. With miles=0, the miles guard fires
# first, so only the miles error is present. Assert that the message mentions miles.
if ! grep -q "Miles must be greater than 0" <<< "${ERROR_MESSAGE}" && ! grep -q "Miles must be greater than 0 and less than or equal to 200" <<< "${ERROR_MESSAGE}"; then
  cv_fail "Error message did not mention miles > 0 validation" $LINENO
fi

# 3) Confirm that no ride was persisted: history should still have zero rides
HIST_RESP_FILE_AFTER="$(mktemp)"
HIST_STATUS_FILE_AFTER="$(mktemp)"
HIST_HDR_FILE_AFTER="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${RIDER_ID}"
REQUEST_BODY=""
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

curl -sS -D "${HIST_HDR_FILE_AFTER}" -o "${HIST_RESP_FILE_AFTER}" -w '%{http_code}' \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}" >"${HIST_STATUS_FILE_AFTER}"

HIST_STATUS_AFTER="$(cat "${HIST_STATUS_FILE_AFTER}")"
cv_http "GET" "/api/rides/history" "${HIST_STATUS_AFTER}"

printf 'RESPONSE_HEADERS
'
cat "${HIST_HDR_FILE_AFTER}"
printf 'RESPONSE_BODY
'
cat "${HIST_RESP_FILE_AFTER}"

if [ "${HIST_STATUS_AFTER}" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/history after invalid POST but got ${HIST_STATUS_AFTER}" $LINENO
fi

RIDES_COUNT_AFTER="$(jq '.rides | length' < "${HIST_RESP_FILE_AFTER}")"
if [ "${RIDES_COUNT_AFTER}" -ne 0 ]; then
  cv_fail "Expected 0 rides after validation failure but found ${RIDES_COUNT_AFTER}" $LINENO
fi

cv_step "Cleanup" "No teardown required; no rides were created" $LINENO

# No resources were created, so nothing to delete. Temporary files will be removed when container exits.

echo "CODEVALID_TEST_ASSERTION_OK:validation_failure_preserves_values"
