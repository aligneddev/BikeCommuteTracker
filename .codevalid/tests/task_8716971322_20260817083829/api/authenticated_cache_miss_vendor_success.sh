#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Setup: wait for app health
cv_step "Given" "wait for app health before testing GET /api/rides/weather" $LINENO
REQUEST_HEADERS_FILE="/tmp/health_headers.$$"
REQUEST_BODY_FILE="/tmp/health_body.$$"
RESPONSE_HEADERS_FILE="/tmp/health_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/health_resp_body.$$"

# No request body for health; just echo headers placeholder
echo "REQUEST_HEADERS: GET http://app:${PORT}/health" >"${REQUEST_HEADERS_FILE}"
: >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS -f -D "${RESPONSE_HEADERS_FILE}" "http://app:${PORT}/health" >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 200 from /health, got curl exit code ${code}" $LINENO
fi
cv_http "GET" "/health" "200"

# Mocks: configure WireMock stub and reset journal
cv_step "Given" "configure WireMock stub for Open-Meteo archive weather lookup" $LINENO

CASE_DIR=".codevalid/wiremock/mappings/cases/authenticated_cache_miss_vendor_success"
mkdir -p "$CASE_DIR"

cat > "$CASE_DIR/open-meteo-archive.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v1/archive",
    "queryParameters": {
      "latitude": {
        "matches": "40\\.71"
      },
      "longitude": {
        "matches": "-74\\.01"
      },
      "start_date": {
        "equalTo": "2024-01-15"
      },
      "end_date": {
        "equalTo": "2024-01-15"
      }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "hourly": {
        "time": [
          "2024-01-15T00:00",
          "2024-01-15T10:00",
          "2024-01-15T23:00"
        ],
        "temperature_2m": [
          30.5,
          72.5,
          40.0
        ],
        "wind_speed_10m": [
          5.0,
          10.3,
          3.0
        ],
        "wind_direction_10m": [
          180,
          250,
          90
        ],
        "relative_humidity_2m": [
          50,
          65,
          80
        ],
        "cloud_cover": [
          10,
          30,
          90
        ],
        "weather_code": [
          0,
          80,
          0
        ],
        "precipitation": [
          0.0,
          0.2,
          0.0
        ],
        "snowfall": [
          0.0,
          0.0,
          0.0
        ]
      }
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

cv_step "Given" "reset WireMock request journal before vendor call count assertions" $LINENO
REQUEST_HEADERS_FILE="/tmp/wm_reset_headers.$$"
REQUEST_BODY_FILE="/tmp/wm_reset_body.$$"
RESPONSE_HEADERS_FILE="/tmp/wm_reset_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/wm_reset_resp_body.$$"

echo "REQUEST_HEADERS: DELETE ${WIREMOCK_ADMIN_URL}/__admin/requests" >"${REQUEST_HEADERS_FILE}"
: >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS -X DELETE -D "${RESPONSE_HEADERS_FILE}" "${WIREMOCK_ADMIN_URL}/__admin/requests" >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 200 from WireMock requests delete, got curl exit code ${code}" $LINENO
fi
cv_http "DELETE" "/__admin/requests" "200"

# Preconditions: sign up rider
cv_step "Given" "sign up a new rider and capture userId for authenticated requests" $LINENO

SIGNUP_BODY='{"name":"Weather Cache Rider","pin":"1234"}'
REQUEST_HEADERS_FILE="/tmp/signup_headers.$$"
REQUEST_BODY_FILE="/tmp/signup_body.$$"
RESPONSE_HEADERS_FILE="/tmp/signup_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/signup_resp_body.$$"

echo "REQUEST_HEADERS: POST http://app:${PORT}/api/users/signup" >"${REQUEST_HEADERS_FILE}"
echo "Content-Type: application/json" >>"${REQUEST_HEADERS_FILE}"
printf '%s
' "$SIGNUP_BODY" >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS -X POST "http://app:${PORT}/api/users/signup" \
  -H 'Content-Type: application/json' \
  -D "${RESPONSE_HEADERS_FILE}" \
  --data-binary "${SIGNUP_BODY}" >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
SIGNUP_RESP=$(cat "${RESPONSE_BODY_FILE}")
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 201 from /api/users/signup, got curl exit code ${code}" $LINENO
fi
cv_http "POST" "/api/users/signup" "201"

USER_ID="$(printf '%s
' "$SIGNUP_RESP" | jq -r '.userId')"
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  cv_fail "expected signup response to contain userId, got: ${SIGNUP_RESP}" $LINENO
fi

# Preconditions: configure UserSettings
cv_step "Given" "configure rider UserSettings with latitude/longitude for weather lookup" $LINENO

SETTINGS_BODY="$(jq -n \
  --argjson latitude 40.71 \
  --argjson longitude -74.01 \
  --arg dashboardGallonsAvoidedEnabled true \
  --arg dashboardGoalProgressEnabled true \
  '{ latitude: $latitude,
     longitude: $longitude,
     locationLabel: "NYC",
     averageCarMpg: 25,
     yearlyGoalMiles: 1000,
     oilChangePrice: 50,
     mileageRateCents: 65,
     dashboardGallonsAvoidedEnabled: ($dashboardGallonsAvoidedEnabled|test("true")),
     dashboardGoalProgressEnabled: ($dashboardGoalProgressEnabled|test("true")),
     weatherApiKey: null,
     eiaGasApiKey: null }'
)"

REQUEST_HEADERS_FILE="/tmp/settings_headers.$$"
REQUEST_BODY_FILE="/tmp/settings_body.$$"
RESPONSE_HEADERS_FILE="/tmp/settings_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/settings_resp_body.$$"

echo "REQUEST_HEADERS: PUT http://app:${PORT}/api/users/me/settings" >"${REQUEST_HEADERS_FILE}"
echo "Content-Type: application/json" >>"${REQUEST_HEADERS_FILE}"
echo "X-User-Id: ${USER_ID}" >>"${REQUEST_HEADERS_FILE}"
printf '%s
' "$SETTINGS_BODY" >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS -X PUT "http://app:${PORT}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  -D "${RESPONSE_HEADERS_FILE}" \
  --data-binary "${SETTINGS_BODY}" >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
SETTINGS_RESP=$(cat "${RESPONSE_BODY_FILE}")
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 200 from /api/users/me/settings, got curl exit code ${code}" $LINENO
fi
cv_http "PUT" "/api/users/me/settings" "200"

# Choose a local ride datetime that maps to 2024-01-15T10:00Z when converted to UTC.
RIDE_LOCAL="2024-01-15T10:00:00"

# When: first weather call (cache miss)
cv_step "When" "call GET /api/rides/weather for the configured rider and ride timestamp (first call, cache miss hitting vendor)" $LINENO

WEATHER_URL_FIRST="http://app:${PORT}/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL}"
REQUEST_HEADERS_FILE="/tmp/weather1_headers.$$"
REQUEST_BODY_FILE="/tmp/weather1_body.$$"
RESPONSE_HEADERS_FILE="/tmp/weather1_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/weather1_resp_body.$$"

echo "REQUEST_HEADERS: GET ${WEATHER_URL_FIRST}" >"${REQUEST_HEADERS_FILE}"
echo "X-User-Id: ${USER_ID}" >>"${REQUEST_HEADERS_FILE}"
: >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS -X GET "$WEATHER_URL_FIRST" \
  -H "X-User-Id: ${USER_ID}" \
  -D "${RESPONSE_HEADERS_FILE}" \
  >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
FIRST_RESP=$(cat "${RESPONSE_BODY_FILE}")
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 200 from first /api/rides/weather, got curl exit code ${code}" $LINENO
fi
cv_http "GET" "/api/rides/weather" "200"

# When: second weather call (cache hit)
cv_step "When" "call GET /api/rides/weather again for same rider and timestamp (second call, cache hit without new vendor call)" $LINENO

WEATHER_URL_SECOND="$WEATHER_URL_FIRST"
REQUEST_HEADERS_FILE="/tmp/weather2_headers.$$"
REQUEST_BODY_FILE="/tmp/weather2_body.$$"
RESPONSE_HEADERS_FILE="/tmp/weather2_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/weather2_resp_body.$$"

echo "REQUEST_HEADERS: GET ${WEATHER_URL_SECOND}" >"${REQUEST_HEADERS_FILE}"
echo "X-User-Id: ${USER_ID}" >>"${REQUEST_HEADERS_FILE}"
: >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS -X GET "$WEATHER_URL_SECOND" \
  -H "X-User-Id: ${USER_ID}" \
  -D "${RESPONSE_HEADERS_FILE}" \
  >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
SECOND_RESP=$(cat "${RESPONSE_BODY_FILE}")
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 200 from second /api/rides/weather, got curl exit code ${code}" $LINENO
fi
cv_http "GET" "/api/rides/weather" "200"

# Then: assert first response fields
cv_step "Then" "assert first weather response fields populated from Open-Meteo stub and IsAvailable true" $LINENO

RIDEDT_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.rideDateTimeLocal')"
TEMP_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.temperature')"
WIND_SPEED_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.windSpeedMph')"
WIND_DIR_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.windDirectionDeg')"
HUMIDITY_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.relativeHumidityPercent')"
CLOUD_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.cloudCoverPercent')"
PRECIP_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.precipitationType')"
AVAILABLE_FIRST="$(printf '%s
' "$FIRST_RESP" | jq -r '.isAvailable')"

if [ "$RIDEDT_FIRST" = "null" ] || [ -z "$RIDEDT_FIRST" ]; then
  cv_fail "expected rideDateTimeLocal to be present in first response, got: ${RIDEDT_FIRST}" $LINENO
fi

if [ "$AVAILABLE_FIRST" != "true" ]; then
  cv_fail "expected isAvailable=true in first response, got: ${AVAILABLE_FIRST}" $LINENO
fi

[ "$TEMP_FIRST" = "72.5" ] || cv_fail "expected temperature 72.5 from stub, got: ${TEMP_FIRST}" $LINENO
[ "$WIND_SPEED_FIRST" = "10.3" ] || cv_fail "expected windSpeedMph 10.3 from stub, got: ${WIND_SPEED_FIRST}" $LINENO
[ "$WIND_DIR_FIRST" = "250" ] || cv_fail "expected windDirectionDeg 250 from stub, got: ${WIND_DIR_FIRST}" $LINENO
[ "$HUMIDITY_FIRST" = "65" ] || cv_fail "expected relativeHumidityPercent 65 from stub, got: ${HUMIDITY_FIRST}" $LINENO
[ "$CLOUD_FIRST" = "30" ] || cv_fail "expected cloudCoverPercent 30 from stub, got: ${CLOUD_FIRST}" $LINENO
[ "$PRECIP_FIRST" = "rain" ] || cv_fail "expected precipitationType \"rain\" from stub, got: ${PRECIP_FIRST}" $LINENO

# Then: assert second response matches first
cv_step "Then" "assert second weather response matches first and reuses cached snapshot" $LINENO

TEMP_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.temperature')"
WIND_SPEED_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.windSpeedMph')"
WIND_DIR_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.windDirectionDeg')"
HUMIDITY_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.relativeHumidityPercent')"
CLOUD_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.cloudCoverPercent')"
PRECIP_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.precipitationType')"
AVAILABLE_SECOND="$(printf '%s
' "$SECOND_RESP" | jq -r '.isAvailable')"

[ "$AVAILABLE_SECOND" = "true" ] || cv_fail "expected isAvailable=true in second response, got: ${AVAILABLE_SECOND}" $LINENO
[ "$TEMP_SECOND" = "$TEMP_FIRST" ] || cv_fail "expected second temperature ${TEMP_FIRST}, got: ${TEMP_SECOND}" $LINENO
[ "$WIND_SPEED_SECOND" = "$WIND_SPEED_FIRST" ] || cv_fail "expected second windSpeedMph ${WIND_SPEED_FIRST}, got: ${WIND_SPEED_SECOND}" $LINENO
[ "$WIND_DIR_SECOND" = "$WIND_DIR_FIRST" ] || cv_fail "expected second windDirectionDeg ${WIND_DIR_FIRST}, got: ${WIND_DIR_SECOND}" $LINENO
[ "$HUMIDITY_SECOND" = "$HUMIDITY_FIRST" ] || cv_fail "expected second relativeHumidityPercent ${HUMIDITY_FIRST}, got: ${HUMIDITY_SECOND}" $LINENO
[ "$CLOUD_SECOND" = "$CLOUD_FIRST" ] || cv_fail "expected second cloudCoverPercent ${CLOUD_FIRST}, got: ${CLOUD_SECOND}" $LINENO
[ "$PRECIP_SECOND" = "$PRECIP_FIRST" ] || cv_fail "expected second precipitationType ${PRECIP_FIRST}, got: ${PRECIP_SECOND}" $LINENO

# Then: assert WireMock archive called exactly once
cv_step "Then" "assert Open-Meteo archive was called exactly once across both weather requests" $LINENO

REQUEST_HEADERS_FILE="/tmp/wm_getreq_headers.$$"
REQUEST_BODY_FILE="/tmp/wm_getreq_body.$$"
RESPONSE_HEADERS_FILE="/tmp/wm_getreq_resp_headers.$$"
RESPONSE_BODY_FILE="/tmp/wm_getreq_resp_body.$$"

echo "REQUEST_HEADERS: GET ${WIREMOCK_ADMIN_URL}/__admin/requests" >"${REQUEST_HEADERS_FILE}"
: >"${REQUEST_BODY_FILE}"
cat "${REQUEST_HEADERS_FILE}"
cat "${REQUEST_BODY_FILE}"

curl -sS "${WIREMOCK_ADMIN_URL}/__admin/requests" -D "${RESPONSE_HEADERS_FILE}" >"${RESPONSE_BODY_FILE}"
code=$?
cat "${RESPONSE_HEADERS_FILE}"
cat "${RESPONSE_BODY_FILE}"
REQUESTS_JSON=$(cat "${RESPONSE_BODY_FILE}")
if [ "$code" -ne 0 ]; then
  cv_fail "expected HTTP 200 from WireMock /__admin/requests, got curl exit code ${code}" $LINENO
fi
cv_http "GET" "/__admin/requests" "200"

CALL_COUNT="$(printf '%s
' "$REQUESTS_JSON" | jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length')"
if [ "$CALL_COUNT" -ne 1 ]; then
  cv_fail "expected exactly 1 Open-Meteo archive call for cache-miss then cache-hit, got: ${CALL_COUNT}" $LINENO
fi

# Teardown
cv_step "Cleanup" "no explicit teardown needed; app and SQLite DB are ephemeral in test environment" $LINENO
# Containers and database file are destroyed after the test run by the harness.

echo "CODEVALID_TEST_ASSERTION_OK:authenticated_cache_miss_vendor_success"
