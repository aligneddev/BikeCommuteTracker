#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step "Given" "Import WireMock stubs for Open-Meteo archive success and failure" $LINENO
CASE_DIR=".codevalid/wiremock/mappings/cases/authenticated_vendor_unreachable_but_cache_exists"
mkdir -p "$CASE_DIR"

# Successful Open-Meteo archive response stub: used on first weather call to populate cache.
cat > "$CASE_DIR/open-meteo-archive-success.json" <<'JSON'
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
      }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "hourly": {
        "time": [
          "2026-03-20T09:00",
          "2026-03-20T10:00",
          "2026-03-20T11:00"
        ],
        "temperature_2m": [
          70.0,
          72.5,
          71.0
        ],
        "wind_speed_10m": [
          9.0,
          10.3,
          8.5
        ],
        "wind_direction_10m": [
          240,
          250,
          260
        ],
        "relative_humidity_2m": [
          60,
          65,
          63
        ],
        "cloud_cover": [
          25,
          30,
          35
        ],
        "precipitation": [
          0.0,
          0.0,
          0.0
        ],
        "snowfall": [
          0.0,
          0.0,
          0.0
        ],
        "weather_code": [
          0,
          0,
          0
        ]
      }
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

# Failure Open-Meteo archive response stub: imported later to simulate vendor outage.
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
      }
    }
  },
  "response": {
    "status": 500,
    "jsonBody": {
      "error": "Simulated vendor outage for cache-hit scenario"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

cv_prereq "Sign up rider, configure settings with lat/lon, and perform initial weather call to populate cache" $LINENO

API_BASE="http://app:${PORT}"

# 1. Sign up a new rider to obtain a userId.
cv_prereq "Sign up new rider for authenticated weather preview" $LINENO
SIGNUP_BODY='{"name":"Weather Cache Rider","pin":"1234"}'
SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type: application/json" >&2
echo "REQUEST_BODY: $SIGNUP_BODY" >&2
curl -sS -f -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_RESP_FILE" -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary "$SIGNUP_BODY" || cv_fail "Signup request failed" $LINENO
cv_http "POST" "/api/users/signup" "201"
echo "RESPONSE_HEADERS (signup):" >&2
cat "$SIGNUP_HDR_FILE" >&2
echo "RESPONSE_BODY (signup):" >&2
cat "$SIGNUP_RESP_FILE" >&2

USER_ID="$(jq -r '.userId' < "$SIGNUP_RESP_FILE")"
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  cv_fail "Failed to read userId from signup response" $LINENO
fi

# 2. Configure user settings with location so weather lookup can run.
cv_prereq "Configure user settings with latitude/longitude" $LINENO
SETTINGS_BODY=$(cat <<JSON
{
  "averageCarMpg": null,
  "yearlyGoalMiles": null,
  "oilChangePrice": null,
  "mileageRateCents": null,
  "locationLabel": "NYC",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": false,
  "dashboardGoalProgressEnabled": false,
  "weatherApiKey": null,
  "eiaGasApiKey": null
}
JSON
)
SETTINGS_RESP_FILE="$(mktemp)"
SETTINGS_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type: application/json; X-User-Id: ${USER_ID}" >&2
echo "REQUEST_BODY: $SETTINGS_BODY" >&2
curl -sS -f -D "$SETTINGS_HDR_FILE" -o "$SETTINGS_RESP_FILE" -X PUT "${API_BASE}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary "$SETTINGS_BODY" || cv_fail "Settings update failed" $LINENO
cv_http "PUT" "/api/users/me/settings" "200"
echo "RESPONSE_HEADERS (settings):" >&2
cat "$SETTINGS_HDR_FILE" >&2
echo "RESPONSE_BODY (settings):" >&2
cat "$SETTINGS_RESP_FILE" >&2

# 3. Perform initial weather request for a past date (archive path) to populate WeatherLookups cache.
# Choose 2026-03-20T10:30:00 local; service will round to 10:00 UTC hour and call /v1/archive.
INITIAL_WEATHER_URL="/api/rides/weather?rideDateTimeLocal=2026-03-20T10:30:00"
INITIAL_RESP_FILE="$(mktemp)"
INITIAL_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id: ${USER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
curl -sS -f -D "$INITIAL_HDR_FILE" -o "$INITIAL_RESP_FILE" -X GET "${API_BASE}${INITIAL_WEATHER_URL}" \
  -H "X-User-Id: ${USER_ID}" || cv_fail "Initial weather request failed" $LINENO
cv_http "GET" "$INITIAL_WEATHER_URL" "200"
echo "RESPONSE_HEADERS (initial weather):" >&2
cat "$INITIAL_HDR_FILE" >&2
echo "RESPONSE_BODY (initial weather):" >&2
cat "$INITIAL_RESP_FILE" >&2

# Assert initial response has IsAvailable=true and matches stubbed values.
INITIAL_IS_AVAILABLE="$(jq -r '.isAvailable' < "$INITIAL_RESP_FILE")"
if [ "$INITIAL_IS_AVAILABLE" != "true" ]; then
  cv_fail "Expected initial weather isAvailable=true, got ${INITIAL_IS_AVAILABLE}" $LINENO
fi

TEMP_VAL="$(jq -r '.temperature' < "$INITIAL_RESP_FILE")"
WIND_SPEED_VAL="$(jq -r '.windSpeedMph' < "$INITIAL_RESP_FILE")"
WIND_DIR_VAL="$(jq -r '.windDirectionDeg' < "$INITIAL_RESP_FILE")"
HUMIDITY_VAL="$(jq -r '.relativeHumidityPercent' < "$INITIAL_RESP_FILE")"
CLOUD_VAL="$(jq -r '.cloudCoverPercent' < "$INITIAL_RESP_FILE")"

[ "$TEMP_VAL" = "72.5" ] || cv_fail "Expected temperature 72.5 from stub, got ${TEMP_VAL}" $LINENO
[ "$WIND_SPEED_VAL" = "10.3" ] || cv_fail "Expected windSpeedMph 10.3 from stub, got ${WIND_SPEED_VAL}" $LINENO
[ "$WIND_DIR_VAL" = "250" ] || cv_fail "Expected windDirectionDeg 250 from stub, got ${WIND_DIR_VAL}" $LINENO
[ "$HUMIDITY_VAL" = "65" ] || cv_fail "Expected relativeHumidityPercent 65 from stub, got ${HUMIDITY_VAL}" $LINENO
[ "$CLOUD_VAL" = "30" ] || cv_fail "Expected cloudCoverPercent 30 from stub, got ${CLOUD_VAL}" $LINENO

# 4. Reset WireMock request journal and import failure stub to simulate vendor outage for subsequent calls.
cv_prereq "Reset WireMock journal and switch Open-Meteo archive stub to failure" $LINENO
RESET_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: (none)" >&2
echo "REQUEST_BODY: (none)" >&2
curl -sS -f -D "$RESET_HDR_FILE" -o /dev/null -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" \
  || cv_fail "Failed to reset WireMock request journal" $LINENO
cv_http "DELETE" "/__admin/requests" "200"
echo "RESPONSE_HEADERS (wiremock reset):" >&2
cat "$RESET_HDR_FILE" >&2
echo "RESPONSE_BODY (wiremock reset): (none)" >&2

wiremock_admin_import_mappings "$CASE_DIR"

cv_step "When" "Call GET /api/rides/weather again while vendor archive endpoint returns 500" $LINENO

SECOND_WEATHER_URL="/api/rides/weather?rideDateTimeLocal=2026-03-20T10:30:00"
SECOND_RESP_FILE="$(mktemp)"
SECOND_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id: ${USER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
curl -sS -f -D "$SECOND_HDR_FILE" -o "$SECOND_RESP_FILE" -X GET "${API_BASE}${SECOND_WEATHER_URL}" \
  -H "X-User-Id: ${USER_ID}" || cv_fail "Second weather request failed" $LINENO
cv_http "GET" "$SECOND_WEATHER_URL" "200"
echo "RESPONSE_HEADERS (second weather):" >&2
cat "$SECOND_HDR_FILE" >&2
echo "RESPONSE_BODY (second weather):" >&2
cat "$SECOND_RESP_FILE" >&2

cv_step "Then" "Assert second response reuses cached snapshot despite vendor outage" $LINENO

SECOND_IS_AVAILABLE="$(jq -r '.isAvailable' < "$SECOND_RESP_FILE")"
if [ "$SECOND_IS_AVAILABLE" != "true" ]; then
  cv_fail "Expected second weather isAvailable=true from cache, got ${SECOND_IS_AVAILABLE}" $LINENO
fi

SECOND_TEMP_VAL="$(jq -r '.temperature' < "$SECOND_RESP_FILE")"
SECOND_WIND_SPEED_VAL="$(jq -r '.windSpeedMph' < "$SECOND_RESP_FILE")"
SECOND_WIND_DIR_VAL="$(jq -r '.windDirectionDeg' < "$SECOND_RESP_FILE")"
SECOND_HUMIDITY_VAL="$(jq -r '.relativeHumidityPercent' < "$SECOND_RESP_FILE")"
SECOND_CLOUD_VAL="$(jq -r '.cloudCoverPercent' < "$SECOND_RESP_FILE")"
SECOND_PRECIP_VAL="$(jq -r '.precipitationType' < "$SECOND_RESP_FILE")"

# Assert weather fields match the cached successful snapshot.
[ "$SECOND_TEMP_VAL" = "72.5" ] || cv_fail "Expected cached temperature 72.5, got ${SECOND_TEMP_VAL}" $LINENO
[ "$SECOND_WIND_SPEED_VAL" = "10.3" ] || cv_fail "Expected cached windSpeedMph 10.3, got ${SECOND_WIND_SPEED_VAL}" $LINENO
[ "$SECOND_WIND_DIR_VAL" = "250" ] || cv_fail "Expected cached windDirectionDeg 250, got ${SECOND_WIND_DIR_VAL}" $LINENO
[ "$SECOND_HUMIDITY_VAL" = "65" ] || cv_fail "Expected cached relativeHumidityPercent 65, got ${SECOND_HUMIDITY_VAL}" $LINENO
[ "$SECOND_CLOUD_VAL" = "30" ] || cv_fail "Expected cached cloudCoverPercent 30, got ${SECOND_CLOUD_VAL}" $LINENO
# PrecipitationType is null in stub and should remain null.
[ "$SECOND_PRECIP_VAL" = "null" ] || cv_fail "Expected cached precipitationType null, got ${SECOND_PRECIP_VAL}" $LINENO

# Inspect WireMock journal to confirm that vendor calls during second request were failures and did not overwrite cache.
cv_prereq "Inspect WireMock journal for /v1/archive calls during second request" $LINENO
JOURNAL_FILE="$(mktemp)"
JOURNAL_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: (none)" >&2
echo "REQUEST_BODY: (none)" >&2
curl -sS -f -D "$JOURNAL_HDR_FILE" -o "$JOURNAL_FILE" "${WIREMOCK_ADMIN_URL}/__admin/requests" \
  || cv_fail "Failed to read WireMock request journal" $LINENO
cv_http "GET" "/__admin/requests" "200"
echo "RESPONSE_HEADERS (wiremock journal):" >&2
cat "$JOURNAL_HDR_FILE" >&2
echo "RESPONSE_BODY (wiremock journal):" >&2
cat "$JOURNAL_FILE" >&2

# Count archive calls; due to Polly retries we expect at least one call when cache miss, but for cache hit on success
# branch, GetOrFetchAsync returns before hitting vendor and archive should not be called.
ARCHIVE_CALL_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length' < "$JOURNAL_FILE")"
if [ "$ARCHIVE_CALL_COUNT" -ne 0 ]; then
  cv_fail "Expected no /v1/archive calls for cached second request, got ${ARCHIVE_CALL_COUNT}" $LINENO
fi

cv_step "Cleanup" "Remove temporary files" $LINENO
rm -f "$SIGNUP_RESP_FILE" "$SETTINGS_RESP_FILE" "$INITIAL_RESP_FILE" "$SECOND_RESP_FILE" "$JOURNAL_FILE" \
      "$SIGNUP_HDR_FILE" "$SETTINGS_HDR_FILE" "$INITIAL_HDR_FILE" "$SECOND_HDR_FILE" \
      "$RESET_HDR_FILE" "$JOURNAL_HDR_FILE"

echo "CODEVALID_TEST_ASSERTION_OK:authenticated_vendor_unreachable_but_cache_exists"
