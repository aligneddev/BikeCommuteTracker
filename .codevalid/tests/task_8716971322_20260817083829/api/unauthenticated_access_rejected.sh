#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step "Given" "Import case-specific WireMock mappings (none needed for unauthenticated gate test) and reset journal" $LINENO
cv_prereq "Reset WireMock request journal so only this case's vendor calls are visible" $LINENO

# No per-case mappings are required because the handler must not reach the vendor at all for unauthenticated access.
# Reset WireMock 3.x request journal.
REQUEST_HEADERS_FILE="$(mktemp)"
REQUEST_BODY_FILE="$(mktemp)"

# There is no request body for this DELETE, but keep files for consistency.
: >"${REQUEST_HEADERS_FILE}"
: >"${REQUEST_BODY_FILE}"

echo "REQUEST_HEADERS:"
cat "${REQUEST_HEADERS_FILE}"
echo "REQUEST_BODY:"
cat "${REQUEST_BODY_FILE}"

WIREMOCK_DELETE_HDRS_FILE="$(mktemp)"
curl -sS -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" -D "${WIREMOCK_DELETE_HDRS_FILE}" -o /dev/null
cv_http "DELETE" "${WIREMOCK_ADMIN_URL}/__admin/requests" "200"

echo "RESPONSE_HEADERS:"
cat "${WIREMOCK_DELETE_HDRS_FILE}"
echo "RESPONSE_BODY: (empty for DELETE journal reset)"

cv_prereq "Confirm API health before unauthenticated request" $LINENO
cv_prereq "API container healthcheck on /health" $LINENO

API_HEALTH_HEADERS_FILE="$(mktemp)"
API_HEALTH_STATUS="$(curl -sS -D "${API_HEALTH_HEADERS_FILE}" -o /dev/null -w '%{http_code}' "http://app:${PORT}/health")" || API_HEALTH_STATUS="000"
cv_http "GET" "http://app:${PORT}/health" "${API_HEALTH_STATUS}"

echo "REQUEST_HEADERS: (implicit, from curl defaults)"
echo "REQUEST_BODY: (none for healthcheck)"
echo "RESPONSE_HEADERS:"
cat "${API_HEALTH_HEADERS_FILE}"
echo "RESPONSE_BODY: (none, healthcheck wrote to /dev/null)"

if [ "${API_HEALTH_STATUS}" -ne 200 ]; then
  cv_fail "Expected API healthcheck 200, got ${API_HEALTH_STATUS}" $LINENO
fi

cv_step "When" "Call GET /api/rides/weather without authentication" $LINENO

WEATHER_RESP_FILE="$(mktemp)"
WEATHER_HEADERS_FILE="$(mktemp)"
WEATHER_STATUS="$(curl -sS -D "${WEATHER_HEADERS_FILE}" -o "${WEATHER_RESP_FILE}" -w '%{http_code}' \
  "http://app:${PORT}/api/rides/weather?rideDateTimeLocal=2026-03-20T10:30:00")" || WEATHER_STATUS="000"
cv_http "GET" "http://app:${PORT}/api/rides/weather?rideDateTimeLocal=2026-03-20T10:30:00" "${WEATHER_STATUS}"

echo "REQUEST_HEADERS: (implicit, from curl defaults)"
echo "REQUEST_BODY: (none for GET weather)"
echo "RESPONSE_HEADERS:"
cat "${WEATHER_HEADERS_FILE}"
echo "RESPONSE_BODY:"
cat "${WEATHER_RESP_FILE}"

cv_step "Then" "Assert 401 Unauthorized and no vendor calls to Open-Meteo" $LINENO

# Assert HTTP status is 401 Unauthorized.
if [ "${WEATHER_STATUS}" -ne 401 ]; then
  BODY="$(cat "${WEATHER_RESP_FILE}")"
  cv_fail "Expected 401 from unauthenticated GET /api/rides/weather, got ${WEATHER_STATUS} with body: ${BODY}" $LINENO
fi

# Per learning, ASP.NET Core auth challenge for this scheme returns an empty body.
WEATHER_BODY="$(cat "${WEATHER_RESP_FILE}")"
if [ -n "${WEATHER_BODY}" ]; then
  cv_fail "Expected empty body for 401 Unauthorized, got: ${WEATHER_BODY}" $LINENO
fi

# Inspect WireMock journal to ensure no Open-Meteo calls were made.
WIREMOCK_REQS_FILE="$(mktemp)"
WIREMOCK_REQS_HEADERS_FILE="$(mktemp)"
WIREMOCK_STATUS="$(curl -sS -D "${WIREMOCK_REQS_HEADERS_FILE}" -o "${WIREMOCK_REQS_FILE}" -w '%{http_code}' \
  "${WIREMOCK_ADMIN_URL}/__admin/requests")" || WIREMOCK_STATUS="000"
cv_http "GET" "${WIREMOCK_ADMIN_URL}/__admin/requests" "${WIREMOCK_STATUS}"

echo "REQUEST_HEADERS: (implicit, from curl defaults)"
echo "REQUEST_BODY: (none for journal GET)"
echo "RESPONSE_HEADERS:"
cat "${WIREMOCK_REQS_HEADERS_FILE}"
echo "RESPONSE_BODY:"
cat "${WIREMOCK_REQS_FILE}"

if [ "${WIREMOCK_STATUS}" -ne 200 ]; then
  cv_fail "Expected 200 from WireMock requests journal, got ${WIREMOCK_STATUS}" $LINENO
fi

# Check that no requests hit /v1/forecast or /v1/archive (Open-Meteo endpoints).
FORECAST_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v1/forecast"))] | length' "${WIREMOCK_REQS_FILE}")"
ARCHIVE_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length' "${WIREMOCK_REQS_FILE}")"

if [ "${FORECAST_COUNT}" -ne 0 ] || [ "${ARCHIVE_COUNT}" -ne 0 ]; then
  cv_fail "Unauthenticated weather request should not call Open-Meteo; forecast_count=${FORECAST_COUNT}, archive_count=${ARCHIVE_COUNT}" $LINENO
fi

# All assertions passed
echo "CODEVALID_TEST_ASSERTION_OK:unauthenticated_access_rejected"

cv_step "Cleanup" "Remove temporary files created during test" $LINENO

rm -f "${WEATHER_RESP_FILE:-}" "${WIREMOCK_REQS_FILE:-}" \
      "${REQUEST_HEADERS_FILE:-}" "${REQUEST_BODY_FILE:-}" \
      "${WIREMOCK_DELETE_HDRS_FILE:-}" "${API_HEALTH_HEADERS_FILE:-}" \
      "${WEATHER_HEADERS_FILE:-}" "${WIREMOCK_REQS_HEADERS_FILE:-}"
