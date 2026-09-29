#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step Given "Signup rider and configure settings for weather lookup failure scenario" $LINENO
# Sign up a new rider via POST /api/users/signup
SIGNUP_BODY='{"name":"Weather Vendor Failure Rider","pin":"1234"}'
SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"
REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$SIGNUP_BODY"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_RESP_FILE" -w '%{http_code}' \
  -X POST "http://app:${PORT}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary "$SIGNUP_BODY" >"$SIGNUP_STATUS_FILE"
SIGNUP_STATUS="$(cat "$SIGNUP_STATUS_FILE")"
echo "RESPONSE_HEADERS="
cat "$SIGNUP_HDR_FILE"
echo "RESPONSE_BODY="
cat "$SIGNUP_RESP_FILE"
cv_http POST "/api/users/signup" "$SIGNUP_STATUS"
if [ "$SIGNUP_STATUS" -ne 201 ]; then
  cv_fail "Expected 201 from signup, got $SIGNUP_STATUS" $LINENO
fi
USER_ID="$(jq -r '.userId' <"$SIGNUP_RESP_FILE")"
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  cv_fail "Signup response missing userId" $LINENO
fi

# Configure UserSettings with latitude/longitude and required fields via PUT /api/users/me/settings
SETTINGS_BODY="$(cat <<JSON
{
  "averageCarMpg": null,
  "yearlyGoalMiles": null,
  "oilChangePrice": null,
  "mileageRateCents": null,
  "locationLabel": "NYC",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "weatherApiKey": "",
  "eiaGasApiKey": "",
  "updatedAtUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
JSON
)"
SETTINGS_STATUS="$(mktemp)"
SETTINGS_HDR_FILE="$(mktemp)"
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${USER_ID}"
REQUEST_BODY="$SETTINGS_BODY"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$SETTINGS_HDR_FILE" -o /dev/null -w '%{http_code}' \
  -X PUT "http://app:${PORT}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary "$SETTINGS_BODY" >"$SETTINGS_STATUS"
echo "RESPONSE_HEADERS="
cat "$SETTINGS_HDR_FILE"
echo "RESPONSE_BODY="
echo "(no body captured for settings update)"
cv_http PUT "/api/users/me/settings" "$(cat "$SETTINGS_STATUS")"
if [ "$(cat "$SETTINGS_STATUS")" -ne 200 ]; then
  cv_fail "Expected 200 from settings update, got $(cat "$SETTINGS_STATUS")" $LINENO
fi

# Choose a rideDateTimeLocal more than 92 days before current UTC date so service uses /v1/archive
# Use 2026-03-20T10:30:00 which is in the past relative to current test clocks
RIDE_LOCAL_DATETIME="2026-03-20T10:30:00"
cv_prereq "Rider created with userId=${USER_ID}, settings set with lat=40.71 lon=-74.01" $LINENO

# Case: authenticated_vendor_failure_no_cache_available

### Mocks

cv_prereq "Import WireMock stub for Open-Meteo archive vendor failure" $LINENO
CASE_DIR=".codevalid/wiremock/mappings/cases/authenticated_vendor_failure_no_cache_available"
mkdir -p "$CASE_DIR"
cat > "$CASE_DIR/open-meteo-archive-failure.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v1/archive",
    "queryParameters": {
      "latitude": {
        "matches": "40\\.71.*"
      },
      "longitude": {
        "matches": "-74\\.01.*"
      },
      "start_date": {
        "equalTo": "2026-03-20"
      },
      "end_date": {
        "equalTo": "2026-03-20"
      },
      "hourly": {
        "contains": "temperature_2m"
      },
      "temperature_unit": {
        "equalTo": "fahrenheit"
      },
      "wind_speed_unit": {
        "equalTo": "mph"
      },
      "timezone": {
        "equalTo": "auto"
      }
    }
  },
  "response": {
    "status": 500,
    "jsonBody": {
      "error": "authenticated_vendor_failure_no_cache_available-open-meteo-archive-failure"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

# Clear WireMock request journal so only this case's outbound calls are recorded
WIREMOCK_RESET_HDR_FILE="$(mktemp)"
REQUEST_HEADERS="(none)"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$WIREMOCK_RESET_HDR_FILE" -o /dev/null -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" || {
  echo "RESPONSE_HEADERS="
  cat "$WIREMOCK_RESET_HDR_FILE"
  echo "RESPONSE_BODY="
  echo "(no body captured for WireMock reset)"
  cv_fail "Failed to reset WireMock request journal" $LINENO
}
echo "RESPONSE_HEADERS="
cat "$WIREMOCK_RESET_HDR_FILE"
echo "RESPONSE_BODY="
echo "(no body captured for WireMock reset)"
cv_http DELETE "/__admin/requests" "200"

### Preconditions

cv_prereq "Verify rider auth and settings before calling weather endpoint" $LINENO
# Simple auth check: call gas-price endpoint which is also protected, expecting 200 or 200 with nulls
GP_STATUS_FILE="$(mktemp)"
GP_HDR_FILE="$(mktemp)"
REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$GP_HDR_FILE" -o /dev/null -w '%{http_code}' \
  -X GET "http://app:${PORT}/api/rides/gas-price?date=2026-03-31" \
  -H "X-User-Id: ${USER_ID}" >"$GP_STATUS_FILE"
GP_STATUS="$(cat "$GP_STATUS_FILE")"
echo "RESPONSE_HEADERS="
cat "$GP_HDR_FILE"
echo "RESPONSE_BODY="
echo "(no body captured for gas-price precondition)"
cv_http GET "/api/rides/gas-price?date=2026-03-31" "$GP_STATUS"
if [ "$GP_STATUS" -ne 200 ]; then
  cv_fail "Protected gas-price endpoint did not accept auth header, status=$GP_STATUS" $LINENO
fi

cv_prereq "UserIdHeader auth and UserSettings lat/lon ready for weather lookup" $LINENO

### When

cv_step When "Call GET /api/rides/weather with vendor failure and capture response" $LINENO
WEATHER_RESP_FILE="$(mktemp)"
WEATHER_STATUS_FILE="$(mktemp)"
WEATHER_HDR_FILE="$(mktemp)"
REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$WEATHER_HDR_FILE" -o "$WEATHER_RESP_FILE" -w '%{http_code}' \
  -X GET "http://app:${PORT}/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL_DATETIME}" \
  -H "X-User-Id: ${USER_ID}" >"$WEATHER_STATUS_FILE"
WEATHER_STATUS="$(cat "$WEATHER_STATUS_FILE")"
echo "RESPONSE_HEADERS="
cat "$WEATHER_HDR_FILE"
echo "RESPONSE_BODY="
cat "$WEATHER_RESP_FILE"
cv_http GET "/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL_DATETIME}" "$WEATHER_STATUS"

if [ "$WEATHER_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from first weather preview, got ${WEATHER_STATUS}" $LINENO
fi

### Then

cv_step Then "Assert weather response indicates no data and matches request datetime" $LINENO
# Normalize rideDateTimeLocal without timezone suffix (Z or ±HH:MM) for comparison
RESP_RIDE_DT_RAW="$(jq -r '.rideDateTimeLocal' <"$WEATHER_RESP_FILE")"
RESP_RIDE_DT_NORM="$(printf '%s
' "$RESP_RIDE_DT_RAW" | sed -E 's/(Z|[+-][0-9]{2}:[0-9]{2})$//')"
REQ_RIDE_DT_NORM="$(printf '%s
' "$RIDE_LOCAL_DATETIME" | sed -E 's/(Z|[+-][0-9]{2}:[0-9]{2})$//')"
if [ "$RESP_RIDE_DT_NORM" != "$REQ_RIDE_DT_NORM" ]; then
  cv_fail "rideDateTimeLocal mismatch: expected ${REQ_RIDE_DT_NORM}, got ${RESP_RIDE_DT_NORM}" $LINENO
fi

IS_AVAILABLE="$(jq -r '.isAvailable' <"$WEATHER_RESP_FILE")"
if [ "$IS_AVAILABLE" != "false" ]; then
  cv_fail "Expected isAvailable=false when vendor fails, got ${IS_AVAILABLE}" $LINENO
fi

# All weather fields must be null when data is unavailable
for field in temperature windSpeedMph windDirectionDeg relativeHumidityPercent cloudCoverPercent precipitationType; do
  val="$(jq -r ".[\"${field}\"]" <"$WEATHER_RESP_FILE")"
  if [ "$val" != "null" ]; then
    cv_fail "Expected ${field}=null when vendor fails, got ${val}" $LINENO
  fi
done

# Inspect WireMock journal to confirm at least one /v1/archive call occurred
REQUESTS_FILE="$(mktemp)"
REQUESTS_HDR_FILE="$(mktemp)"
REQUEST_HEADERS="(none)"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$REQUESTS_HDR_FILE" "${WIREMOCK_ADMIN_URL}/__admin/requests" -o "$REQUESTS_FILE"
echo "RESPONSE_HEADERS="
cat "$REQUESTS_HDR_FILE"
echo "RESPONSE_BODY="
cat "$REQUESTS_FILE"
cv_http GET "/__admin/requests" "200"
ARCHIVE_CALL_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length' <"$REQUESTS_FILE")"
if [ "$ARCHIVE_CALL_COUNT" -lt 1 ]; then
  cv_fail "Expected at least one Open-Meteo /v1/archive call, got ${ARCHIVE_CALL_COUNT}" $LINENO
fi

cv_prereq "Call weather endpoint again for same hour/location to confirm consistent no-data behavior" $LINENO
WEATHER_RESP_FILE2="$(mktemp)"
WEATHER_STATUS_FILE2="$(mktemp)"
WEATHER_HDR_FILE2="$(mktemp)"
REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"
curl -sS -D "$WEATHER_HDR_FILE2" -o "$WEATHER_RESP_FILE2" -w '%{http_code}' \
  -X GET "http://app:${PORT}/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL_DATETIME}" \
  -H "X-User-Id: ${USER_ID}" >"$WEATHER_STATUS_FILE2"
WEATHER_STATUS2="$(cat "$WEATHER_STATUS_FILE2")"
echo "RESPONSE_HEADERS="
cat "$WEATHER_HDR_FILE2"
echo "RESPONSE_BODY="
cat "$WEATHER_RESP_FILE2"
cv_http GET "/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL_DATETIME}" "$WEATHER_STATUS2"

if [ "$WEATHER_STATUS2" -ne 200 ]; then
  cv_fail "Expected 200 from second weather preview, got ${WEATHER_STATUS2}" $LINENO
fi

IS_AVAILABLE2="$(jq -r '.isAvailable' <"$WEATHER_RESP_FILE2")"
if [ "$IS_AVAILABLE2" != "false" ]; then
  cv_fail "Second call expected isAvailable=false after vendor failure/cache, got ${IS_AVAILABLE2}" $LINENO
fi

for field in temperature windSpeedMph windDirectionDeg relativeHumidityPercent cloudCoverPercent precipitationType; do
  val2="$(jq -r ".[\"${field}\"]" <"$WEATHER_RESP_FILE2")"
  if [ "$val2" != "null" ]; then
    cv_fail "Second call expected ${field}=null when vendor fails, got ${val2}" $LINENO
  fi
done

# If all assertions passed, emit success marker for this case
echo "CODEVALID_TEST_ASSERTION_OK:authenticated_vendor_failure_no_cache_available"

### Teardown

cv_step Cleanup "Teardown case-specific resources (temporary files only)" $LINENO
# No explicit server-side teardown is required; temp files will be cleaned up by container lifecycle.
# (Optionally remove temp files created during the test run.)
rm -f "$SIGNUP_RESP_FILE" "$SIGNUP_STATUS_FILE" "$SIGNUP_HDR_FILE" \
      "$SETTINGS_STATUS" "$SETTINGS_HDR_FILE" \
      "$WEATHER_RESP_FILE" "$WEATHER_STATUS_FILE" "$WEATHER_HDR_FILE" \
      "$REQUESTS_FILE" "$REQUESTS_HDR_FILE" \
      "$WEATHER_RESP_FILE2" "$WEATHER_STATUS_FILE2" "$WEATHER_HDR_FILE2" \
      "$GP_STATUS_FILE" "$GP_HDR_FILE" "$WIREMOCK_RESET_HDR_FILE"
