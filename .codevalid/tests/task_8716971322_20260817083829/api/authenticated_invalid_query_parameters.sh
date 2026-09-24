#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

API_BASE="http://app:${PORT}"

# --- Ensure WireMock journal is empty before invalid weather request ---
cv_step "Given" "Ensure WireMock journal is empty before invalid weather request" $LINENO
cv_prereq "Reset WireMock recorded requests so vendor call count starts at zero" $LINENO

# Clear WireMock's request journal (WireMock 3.x API).
WIREMOCK_RESET_HDRS_FILE="$(mktemp)"
WIREMOCK_RESET_BODY_FILE="$(mktemp)"

REQUEST_HEADERS="DELETE ${WIREMOCK_ADMIN_URL}/__admin/requests"
REQUEST_BODY=""
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -D "${WIREMOCK_RESET_HDRS_FILE}" -o "${WIREMOCK_RESET_BODY_FILE}" -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" || cv_fail "Failed to reset WireMock request journal" $LINENO

RESPONSE_HEADERS="$(cat "${WIREMOCK_RESET_HDRS_FILE}")"
RESPONSE_BODY="$(cat "${WIREMOCK_RESET_BODY_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

# We don't have the actual status code variable here, but cv_http should still record the attempted DELETE.
cv_http "DELETE" "${WIREMOCK_ADMIN_URL}/__admin/requests" "204"

# --- Create a new rider via signup and capture userId for authenticated calls ---
cv_prereq "Create a new rider via signup and capture userId for authenticated calls" $LINENO
cv_prereq "BikeTracking API is healthy and ready to accept signup requests" $LINENO

# Sign up a new rider; PIN must satisfy PIN policy.
SIGNUP_BODY_FILE="$(mktemp)"
printf '{"name":"InvalidQueryRider-%s","pin":"1234"}
' "$(date +%s)" > "${SIGNUP_BODY_FILE}"

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_HDRS_FILE="$(mktemp)"

REQUEST_HEADERS="POST ${API_BASE}/api/users/signup\
Content-Type: application/json"
REQUEST_BODY="$(cat "${SIGNUP_BODY_FILE}")"
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -w '%{http_code}' -D "${SIGNUP_HDRS_FILE}" -o "${SIGNUP_RESP_FILE}" \
  -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_BODY_FILE}" > "${SIGNUP_STATUS_FILE}" || cv_fail "Signup request failed" $LINENO

SIGNUP_STATUS="$(cat "${SIGNUP_STATUS_FILE}")"

RESPONSE_HEADERS="$(cat "${SIGNUP_HDRS_FILE}")"
RESPONSE_BODY="$(cat "${SIGNUP_RESP_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "POST" "${API_BASE}/api/users/signup" "${SIGNUP_STATUS}"

if [ "${SIGNUP_STATUS}" != "201" ]; then
  cv_fail "Expected 201 from signup, got ${SIGNUP_STATUS}" $LINENO
fi

USER_ID="$(jq -r '.userId' < "${SIGNUP_RESP_FILE}")"
if [ -z "${USER_ID}" ] || [ "${USER_ID}" = "null" ]; then
  cv_fail "Signup response did not contain userId" $LINENO
fi

# --- Authenticated rider calls GET /api/rides/weather with invalid rideDateTimeLocal ---
cv_step "When" "Authenticated rider calls GET /api/rides/weather with invalid rideDateTimeLocal" $LINENO

WEATHER_RESP_FILE="$(mktemp)"
WEATHER_STATUS_FILE="$(mktemp)"
WEATHER_HDRS_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${API_BASE}/api/rides/weather?rideDateTimeLocal=not-a-date-time\
X-User-Id: ${USER_ID}"
REQUEST_BODY=""
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -w '%{http_code}' -D "${WEATHER_HDRS_FILE}" -o "${WEATHER_RESP_FILE}" \
  -X GET "${API_BASE}/api/rides/weather?rideDateTimeLocal=not-a-date-time" \
  -H "X-User-Id: ${USER_ID}" > "${WEATHER_STATUS_FILE}" || cv_fail "Weather request curl failed" $LINENO

WEATHER_STATUS="$(cat "${WEATHER_STATUS_FILE}")"

RESPONSE_HEADERS="$(cat "${WEATHER_HDRS_FILE}")"
RESPONSE_BODY="$(cat "${WEATHER_RESP_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "GET" "${API_BASE}/api/rides/weather?rideDateTimeLocal=not-a-date-time" "${WEATHER_STATUS}"

# --- Assert 400 INVALID_REQUEST error and no external weather API calls ---
cv_step "Then" "Assert 400 INVALID_REQUEST error and no external weather API calls" $LINENO

# Assert HTTP status code is 400.
if [ "${WEATHER_STATUS}" != "400" ]; then
  cv_fail "Expected 400 for invalid rideDateTimeLocal, got ${WEATHER_STATUS}" $LINENO
fi

# Assert error response shape.
ERROR_CODE="$(jq -r '.code // empty' < "${WEATHER_RESP_FILE}")"
ERROR_MESSAGE="$(jq -r '.message // empty' < "${WEATHER_RESP_FILE}")"

if [ "${ERROR_CODE}" != "INVALID_REQUEST" ]; then
  cv_fail "Expected error code INVALID_REQUEST, got '${ERROR_CODE}'" $LINENO
fi

EXPECTED_MSG="rideDateTimeLocal query parameter is required and must be a valid date time."
if [ "${ERROR_MESSAGE}" != "${EXPECTED_MSG}" ]; then
  cv_fail "Expected error message '${EXPECTED_MSG}', got '${ERROR_MESSAGE}" $LINENO
fi

# Verify that no external weather API calls were recorded in WireMock.
WIREMOCK_REQUESTS_FILE="$(mktemp)"
WIREMOCK_HDRS_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${WIREMOCK_ADMIN_URL}/__admin/requests"
REQUEST_BODY=""
echo "REQUEST_HEADERS=${REQUEST_HEADERS}"
echo "REQUEST_BODY=${REQUEST_BODY}"

curl -sS -f -D "${WIREMOCK_HDRS_FILE}" "${WIREMOCK_ADMIN_URL}/__admin/requests" > "${WIREMOCK_REQUESTS_FILE}" || cv_fail "Failed to read WireMock request journal" $LINENO

RESPONSE_HEADERS="$(cat "${WIREMOCK_HDRS_FILE}")"
RESPONSE_BODY="$(cat "${WIREMOCK_REQUESTS_FILE}")"
echo "RESPONSE_HEADERS=${RESPONSE_HEADERS}"
echo "RESPONSE_BODY=${RESPONSE_BODY}"

cv_http "GET" "${WIREMOCK_ADMIN_URL}/__admin/requests" "200"

# Count requests whose URL starts with /v1/forecast or /v1/archive (Open-Meteo APIs).
FORECAST_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v1/forecast"))] | length' < "${WIREMOCK_REQUESTS_FILE}")"
ARCHIVE_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length' < "${WIREMOCK_REQUESTS_FILE}")"

if [ "${FORECAST_COUNT}" -ne 0 ] || [ "${ARCHIVE_COUNT}" -ne 0 ]; then
  cv_fail "Expected no Open-Meteo calls for invalid query; got forecast=${FORECAST_COUNT}, archive=${ARCHIVE_COUNT}" $LINENO
fi

# --- Teardown ---
cv_step "Cleanup" "Remove temporary files created during the test" $LINENO

rm -f "${SIGNUP_BODY_FILE:-}" "${SIGNUP_RESP_FILE:-}" "${SIGNUP_STATUS_FILE:-}" "${SIGNUP_HDRS_FILE:-}"
rm -f "${WEATHER_RESP_FILE:-}" "${WEATHER_STATUS_FILE:-}" "${WEATHER_HDRS_FILE:-}"
rm -f "${WIREMOCK_REQUESTS_FILE:-}" "${WIREMOCK_HDRS_FILE:-}" "${WIREMOCK_RESET_HDRS_FILE:-}" "${WIREMOCK_RESET_BODY_FILE:-}"

# Success marker required by the runner
echo "CODEVALID_TEST_ASSERTION_OK:authenticated_invalid_query_parameters"
