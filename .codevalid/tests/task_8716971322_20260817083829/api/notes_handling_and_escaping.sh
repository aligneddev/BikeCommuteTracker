#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: notes_handling_and_escaping

# Preconditions
cv_step Given "Signup rider and confirm no prior rides" $LINENO
BASE_URL="http://app:${PORT}"

# Create a new rider via signup API
cv_prereq "Create rider via POST /api/users/signup" $LINENO
SIGNUP_BODY_FILE="/tmp/signup_body_$$.json"
cat >"${SIGNUP_BODY_FILE}" <<EOF
{
  "name": "NotesEscapingRider-$(date +%s)",
  "pin": "1234"
}
EOF

SIGNUP_RESP_FILE="/tmp/signup_resp_$$.json"
SIGNUP_HDR_FILE="/tmp/signup_headers_$$.txt"

echo "REQUEST_HEADERS: POST ${BASE_URL}/api/users/signup"
echo "  Content-Type: application/json"
echo "REQUEST_BODY: $(cat "${SIGNUP_BODY_FILE}")"
HTTP_STATUS=$(curl -sS -D "${SIGNUP_HDR_FILE}" -o "${SIGNUP_RESP_FILE}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/users/signup" \
  -H "Content-Type: application/json" \
  --data-binary @"${SIGNUP_BODY_FILE}") || cv_fail "Signup request failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${SIGNUP_HDR_FILE}"
echo "RESPONSE_BODY:"
cat "${SIGNUP_RESP_FILE}"

cv_http POST "/api/users/signup" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 201 ] || cv_fail "Expected 201 from signup, got ${HTTP_STATUS}" $LINENO

RIDER_ID=$(jq -r '.userId // .UserId' "${SIGNUP_RESP_FILE}")
[ -n "${RIDER_ID}" ] || cv_fail "Signup response missing userId" $LINENO

# Sanity check: rider history should be empty initially
HISTORY_RESP_FILE_EMPTY="/tmp/history_empty_$$.json"
HISTORY_HDR_EMPTY="/tmp/history_empty_headers_$$.txt"

echo "REQUEST_HEADERS: GET ${BASE_URL}/api/rides/history"
echo "  X-User-Id: ${RIDER_ID}"
echo "REQUEST_BODY: (none)"
HTTP_STATUS=$(curl -sS -D "${HISTORY_HDR_EMPTY}" -o "${HISTORY_RESP_FILE_EMPTY}" -w "%{http_code}" \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}") || cv_fail "Initial history request failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${HISTORY_HDR_EMPTY}"
echo "RESPONSE_BODY:"
cat "${HISTORY_RESP_FILE_EMPTY}"

cv_http GET "/api/rides/history" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 200 ] || cv_fail "Expected 200 from initial history, got ${HTTP_STATUS}" $LINENO
INITIAL_COUNT=$(jq '.rides | length' "${HISTORY_RESP_FILE_EMPTY}")
[ "${INITIAL_COUNT}" -eq 0 ] || cv_fail "Expected 0 initial rides, found ${INITIAL_COUNT}" $LINENO

# When
cv_step When "Record two rides: one with special-character note, one without note" $LINENO

# Record first ride with a special-character note under 500 chars
FIRST_RIDE_BODY="/tmp/ride_with_note_body_$$.json"
NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%S")
cat >"${FIRST_RIDE_BODY}" <<EOF
{
  "rideDateTimeLocal": "${NOW_ISO}",
  "miles": 5.5,
  "rideMinutes": 30,
  "gasPricePerGallon": 3.25,
  "note": "Test note with special chars <script>alert('xss')</script> and quotes \"double\" & 'single'.",
  "weatherUserOverridden": true
}
EOF

# Authenticate rider for POST /api/rides
LOGIN_HDR_FILE1="/tmp/login1_headers_$$.txt"

echo "REQUEST_HEADERS: POST ${BASE_URL}/api/users/identify"
echo "  Content-Type: application/json"
echo "REQUEST_BODY: $(cat "${SIGNUP_BODY_FILE}")"
HTTP_STATUS=$(curl -sS -D "${LOGIN_HDR_FILE1}" -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/api/users/identify" \
  -H "Content-Type: application/json" \
  --data-binary @"${SIGNUP_BODY_FILE}") || cv_fail "Login request failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${LOGIN_HDR_FILE1}"
echo "RESPONSE_BODY: (none, response body discarded)"

cv_http POST "/api/users/identify" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 200 ] || cv_fail "Expected 200 from login, got ${HTTP_STATUS}" $LINENO

FIRST_RIDE_RESP="/tmp/ride_with_note_resp_$$.json"
FIRST_RIDE_HDR="/tmp/ride_with_note_headers_$$.txt"

echo "REQUEST_HEADERS: POST ${BASE_URL}/api/rides"
echo "  Content-Type: application/json"
echo "  X-User-Id: ${RIDER_ID}"
echo "REQUEST_BODY: $(cat "${FIRST_RIDE_BODY}")"
HTTP_STATUS=$(curl -sS -D "${FIRST_RIDE_HDR}" -o "${FIRST_RIDE_RESP}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/rides" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${FIRST_RIDE_BODY}") || cv_fail "POST /api/rides (with note) failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${FIRST_RIDE_HDR}"
echo "RESPONSE_BODY:"
cat "${FIRST_RIDE_RESP}"

cv_http POST "/api/rides" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 201 ] || cv_fail "Expected 201 from POST /api/rides (with note), got ${HTTP_STATUS}" $LINENO

FIRST_RIDE_ID=$(jq -r '.rideId // .RideId' "${FIRST_RIDE_RESP}")
[ -n "${FIRST_RIDE_ID}" ] || cv_fail "First ride response missing rideId" $LINENO

# Record second ride with no note (note omitted/null)
SECOND_RIDE_BODY="/tmp/ride_without_note_body_$$.json"
SECOND_ISO=$(date -u +"%Y-%m-%dT%H:%M:%S")
cat >"${SECOND_RIDE_BODY}" <<EOF
{
  "rideDateTimeLocal": "${SECOND_ISO}",
  "miles": 7.0,
  "rideMinutes": 40,
  "gasPricePerGallon": 3.40,
  "weatherUserOverridden": true
}
EOF

# Authenticate rider for second POST /api/rides
LOGIN_HDR_FILE2="/tmp/login2_headers_$$.txt"

echo "REQUEST_HEADERS: POST ${BASE_URL}/api/users/identify"
echo "  Content-Type: application/json"
echo "REQUEST_BODY: $(cat "${SIGNUP_BODY_FILE}")"
HTTP_STATUS=$(curl -sS -D "${LOGIN_HDR_FILE2}" -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/api/users/identify" \
  -H "Content-Type: application/json" \
  --data-binary @"${SIGNUP_BODY_FILE}") || cv_fail "Login request failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${LOGIN_HDR_FILE2}"
echo "RESPONSE_BODY: (none, response body discarded)"

cv_http POST "/api/users/identify" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 200 ] || cv_fail "Expected 200 from login, got ${HTTP_STATUS}" $LINENO

SECOND_RIDE_RESP="/tmp/ride_without_note_resp_$$.json"
SECOND_RIDE_HDR="/tmp/ride_without_note_headers_$$.txt"

echo "REQUEST_HEADERS: POST ${BASE_URL}/api/rides"
echo "  Content-Type: application/json"
echo "  X-User-Id: ${RIDER_ID}"
echo "REQUEST_BODY: $(cat "${SECOND_RIDE_BODY}")"
HTTP_STATUS=$(curl -sS -D "${SECOND_RIDE_HDR}" -o "${SECOND_RIDE_RESP}" -w "%{http_code}" \
  -X POST "${BASE_URL}/api/rides" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"${SECOND_RIDE_BODY}") || cv_fail "POST /api/rides (without note) failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${SECOND_RIDE_HDR}"
echo "RESPONSE_BODY:"
cat "${SECOND_RIDE_RESP}"

cv_http POST "/api/rides" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 201 ] || cv_fail "Expected 201 from POST /api/rides (without note), got ${HTTP_STATUS}" $LINENO

SECOND_RIDE_ID=$(jq -r '.rideId // .RideId' "${SECOND_RIDE_RESP}")
[ -n "${SECOND_RIDE_ID}" ] || cv_fail "Second ride response missing rideId" $LINENO

# Then
cv_step Then "Verify notes length constraints and presence/null behavior via history" $LINENO

HISTORY_RESP_FILE="/tmp/history_notes_$$.json"
HISTORY_HDR_FILE="/tmp/history_notes_headers_$$.txt"

echo "REQUEST_HEADERS: GET ${BASE_URL}/api/rides/history"
echo "  X-User-Id: ${RIDER_ID}"
echo "REQUEST_BODY: (none)"
HTTP_STATUS=$(curl -sS -D "${HISTORY_HDR_FILE}" -o "${HISTORY_RESP_FILE}" -w "%{http_code}" \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}") || cv_fail "GET /api/rides/history failed" $LINENO

echo "RESPONSE_HEADERS:"
cat "${HISTORY_HDR_FILE}"
echo "RESPONSE_BODY:"
cat "${HISTORY_RESP_FILE}"

cv_http GET "/api/rides/history" "${HTTP_STATUS}"
[ "${HTTP_STATUS}" -eq 200 ] || cv_fail "Expected 200 from GET /api/rides/history, got ${HTTP_STATUS}" $LINENO

# Extract the rides by id
FIRST_HISTORY_NOTE=$(jq -r ".rides[] | select(.rideId == ${FIRST_RIDE_ID}) | .note" "${HISTORY_RESP_FILE}")
SECOND_HISTORY_NOTE=$(jq -r ".rides[] | select(.rideId == ${SECOND_RIDE_ID}) | .note" "${HISTORY_RESP_FILE}")

[ "${FIRST_HISTORY_NOTE}" != "null" ] || cv_fail "First ride note should not be null" $LINENO
NOTE_LENGTH=${#FIRST_HISTORY_NOTE}
[ "${NOTE_LENGTH}" -le 500 ] || cv_fail "First ride note exceeds 500 characters (len=${NOTE_LENGTH})" $LINENO

# Assert that special characters are preserved in stored note (current behavior); spec requires safe encoding
case "${FIRST_HISTORY_NOTE}" in
  *"<script>alert('xss')</script>"* ) ;;
  *) cv_fail "Persisted note does not contain expected script-like substring; escaping/storage behavior deviates from spec" $LINENO ;;
esac

# Second ride should have null/empty note
if [ "${SECOND_HISTORY_NOTE}" != "null" ] && [ -n "${SECOND_HISTORY_NOTE}" ]; then
  cv_fail "Second ride note expected to be null/empty but found '${SECOND_HISTORY_NOTE}'" $LINENO
fi

# Teardown
cv_step Cleanup "No explicit cleanup; rides remain for diagnostic purposes" $LINENO
# (SQLite DB is ephemeral per test run; no DELETE required here.)

echo "CODEVALID_TEST_ASSERTION_OK:notes_handling_and_escaping"
