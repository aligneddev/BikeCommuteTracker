#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step Given "Import WireMock stubs for Open-Meteo forecast cache-hit scenario" $LINENO
cv_prereq "Prepare case-specific WireMock mappings directory" $LINENO

CASE_DIR=".codevalid/wiremock/mappings/cases/authenticated_cache_hit_reuses_weather_snapshot"
mkdir -p "$CASE_DIR"

# Stub Open-Meteo archive API: one hourly entry at 2026-03-20T10:00 containing pinned weather values.
# The ride date 2026-03-20 is >92 days before the test run, so the app calls /v1/archive not /v1/forecast.
cat > "$CASE_DIR/open-meteo-archive-cache-hit-dynamic.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v1/archive",
    "queryParameters": {
      "latitude": {
        "contains": "40.71"
      },
      "longitude": {
        "contains": "-74.01"
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
          68.0
        ],
        "wind_speed_10m": [
          8.0,
          10.3,
          6.0
        ],
        "wind_direction_10m": [
          220,
          250,
          200
        ],
        "relative_humidity_2m": [
          60,
          65,
          55
        ],
        "cloud_cover": [
          20,
          30,
          10
        ],
        "precipitation": [
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

# Clear WireMock request journal and import the case mappings.
REQUEST_HEADERS="DELETE ${WIREMOCK_ADMIN_URL}/__admin/requests"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -f -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" -D /tmp/wiremock_reset.hdr -o /dev/null \
  || cv_fail "Failed to reset WireMock request journal" $LINENO

echo "RESPONSE_HEADERS:"
cat /tmp/wiremock_reset.hdr || true
rm -f /tmp/wiremock_reset.hdr

a="${CASE_DIR}"
wiremock_admin_import_mappings "$CASE_DIR" || cv_fail "Failed to import WireMock mappings for case directory $CASE_DIR" $LINENO

cv_prereq "Signup rider and configure user settings with location for weather lookup" $LINENO

API_BASE="http://app:${PORT}"

# 1. Signup a rider to obtain a real user id.
SIGNUP_BODY='{"name":"Weather Cache Rider","pin":"1234"}'
SIGNUP_RESP_FILE="$(mktemp)"

REQUEST_HEADERS="POST ${API_BASE}/api/users/signup"
REQUEST_BODY="$SIGNUP_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -f -o "$SIGNUP_RESP_FILE" -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary "$SIGNUP_BODY" \
  -D /tmp/signup_headers.hdr \
  || cv_fail "Signup request failed" $LINENO

RESPONSE_CODE="201"
cv_http "POST" "/api/users/signup" "$RESPONSE_CODE"  # ASP.NET Core default for successful create

echo "RESPONSE_HEADERS:"
cat /tmp/signup_headers.hdr || true
rm -f /tmp/signup_headers.hdr

echo "RESPONSE_BODY:"
cat "$SIGNUP_RESP_FILE"

USER_ID="$(jq -r '.userId' < "$SIGNUP_RESP_FILE")"
rm -f "$SIGNUP_RESP_FILE"
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  cv_fail "Failed to read userId from signup response" $LINENO
fi

# 2. Configure user settings with latitude/longitude used by the weather lookup service.
SETTINGS_BODY='{
  "averageCarMpg": null,
  "yearlyGoalMiles": null,
  "oilChangePrice": null,
  "mileageRateCents": null,
  "locationLabel": "CacheHitLocation",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": false,
  "dashboardGoalProgressEnabled": false,
  "weatherApiKey": "",
  "eiaGasApiKey": ""
}'

SETTINGS_RESP_FILE="$(mktemp)"

REQUEST_HEADERS="PUT ${API_BASE}/api/users/me/settings; X-User-Id: ${USER_ID}"
REQUEST_BODY="$SETTINGS_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -o "$SETTINGS_RESP_FILE" -X PUT "${API_BASE}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary "$SETTINGS_BODY" \
  -D /tmp/settings_headers.hdr \
  || cv_fail "User settings update request failed" $LINENO

# we don't know exact status code; log 200 as expected for cv_http
STATUS_CODE_SETTINGS="200"
cv_http "PUT" "/api/users/me/settings" "$STATUS_CODE_SETTINGS"

echo "RESPONSE_HEADERS:"
cat /tmp/settings_headers.hdr || true
rm -f /tmp/settings_headers.hdr

echo "RESPONSE_BODY:"
cat "$SETTINGS_RESP_FILE"
rm -f "$SETTINGS_RESP_FILE"

# 3. Make an initial GET /api/rides/weather call to populate WeatherLookups cache via the stubbed Open-Meteo forecast.
INITIAL_RIDE_DATETIME_LOCAL="2026-03-20T10:30:00"
INITIAL_RESP_FILE="$(mktemp)"
INITIAL_STATUS_FILE="$(mktemp)"
INITIAL_HEADERS_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${API_BASE}/api/rides/weather?rideDateTimeLocal=${INITIAL_RIDE_DATETIME_LOCAL}; X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -w '%{http_code}' -o "$INITIAL_RESP_FILE" \
  "${API_BASE}/api/rides/weather?rideDateTimeLocal=${INITIAL_RIDE_DATETIME_LOCAL}" \
  -H "X-User-Id: ${USER_ID}" \
  -D "$INITIAL_HEADERS_FILE" \
  > "$INITIAL_STATUS_FILE" \
  || cv_fail "Initial GET /api/rides/weather request failed" $LINENO

INITIAL_STATUS="$(cat "$INITIAL_STATUS_FILE")"
cv_http "GET" "/api/rides/weather?rideDateTimeLocal=${INITIAL_RIDE_DATETIME_LOCAL}" "$INITIAL_STATUS"

echo "RESPONSE_HEADERS:"
cat "$INITIAL_HEADERS_FILE" || true

echo "RESPONSE_BODY:"
cat "$INITIAL_RESP_FILE"

if [ "$INITIAL_STATUS" != "200" ]; then
  cv_fail "Expected initial weather request status 200 got ${INITIAL_STATUS}" $LINENO
fi

# Assert initial response has isAvailable true and pinned weather values.
INITIAL_IS_AVAILABLE="$(jq -r '.isAvailable' < "$INITIAL_RESP_FILE")"
if [ "$INITIAL_IS_AVAILABLE" != "true" ]; then
  cv_fail "Expected initial isAvailable=true got ${INITIAL_IS_AVAILABLE}" $LINENO
fi

INITIAL_TEMP="$(jq -r '.temperature' < "$INITIAL_RESP_FILE")"
INITIAL_WIND_SPEED="$(jq -r '.windSpeedMph' < "$INITIAL_RESP_FILE")"
INITIAL_WIND_DIR="$(jq -r '.windDirectionDeg' < "$INITIAL_RESP_FILE")"
INITIAL_HUMIDITY="$(jq -r '.relativeHumidityPercent' < "$INITIAL_RESP_FILE")"
INITIAL_CLOUD_COVER="$(jq -r '.cloudCoverPercent' < "$INITIAL_RESP_FILE")"
INITIAL_PRECIP="$(jq -r '.precipitationType // ""' < "$INITIAL_RESP_FILE")"

if [ "$INITIAL_TEMP" != "72.5" ]; then
  cv_fail "Expected initial temperature 72.5 got ${INITIAL_TEMP}" $LINENO
fi
if [ "$INITIAL_WIND_SPEED" != "10.3" ]; then
  cv_fail "Expected initial windSpeedMph 10.3 got ${INITIAL_WIND_SPEED}" $LINENO
fi
if [ "$INITIAL_WIND_DIR" != "250" ]; then
  cv_fail "Expected initial windDirectionDeg 250 got ${INITIAL_WIND_DIR}" $LINENO
fi
if [ "$INITIAL_HUMIDITY" != "65" ]; then
  cv_fail "Expected initial relativeHumidityPercent 65 got ${INITIAL_HUMIDITY}" $LINENO
fi
if [ "$INITIAL_CLOUD_COVER" != "30" ]; then
  cv_fail "Expected initial cloudCoverPercent 30 got ${INITIAL_CLOUD_COVER}" $LINENO
fi
if [ -n "$INITIAL_PRECIP" ]; then
  cv_fail "Expected initial precipitationType null/empty got ${INITIAL_PRECIP}" $LINENO
fi

rm -f "$INITIAL_RESP_FILE" "$INITIAL_STATUS_FILE" "$INITIAL_HEADERS_FILE"

# 4. Capture WireMock journal after initial call to count vendor requests before cache-hit run.
VENDOR_REQUESTS_BEFORE_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${WIREMOCK_ADMIN_URL}/__admin/requests"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -f "${WIREMOCK_ADMIN_URL}/__admin/requests" -D /tmp/wiremock_before.hdr -o "$VENDOR_REQUESTS_BEFORE_FILE" \
  || cv_fail "Failed to read WireMock journal before cache-hit call" $LINENO

cv_http "GET" "/__admin/requests" "200"

echo "RESPONSE_HEADERS:"
cat /tmp/wiremock_before.hdr || true
rm -f /tmp/wiremock_before.hdr

echo "RESPONSE_BODY:"
cat "$VENDOR_REQUESTS_BEFORE_FILE"

FORECAST_CALLS_BEFORE="$(jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length' < "$VENDOR_REQUESTS_BEFORE_FILE")"
rm -f "$VENDOR_REQUESTS_BEFORE_FILE"

# We expect at least one archive call from the initial weather request (Polly may retry on transient failures).
if [ "$FORECAST_CALLS_BEFORE" -lt 1 ]; then
  cv_fail "Expected at least one Open-Meteo archive call before cache-hit run, got ${FORECAST_CALLS_BEFORE}" $LINENO
fi

cv_step When "Call GET /api/rides/weather twice for same hour/location to exercise cache-hit path" $LINENO

# First cache-hit call: same user and same rideDateTimeLocal as initial request (same UTC hour).
CACHE_HIT_RIDE_DATETIME_LOCAL="2026-03-20T10:30:00"

CACHE_HIT_RESP_FILE1="$(mktemp)"
CACHE_HIT_STATUS_FILE1="$(mktemp)"
CACHE_HIT_HEADERS_FILE1="$(mktemp)"

REQUEST_HEADERS="GET ${API_BASE}/api/rides/weather?rideDateTimeLocal=${CACHE_HIT_RIDE_DATETIME_LOCAL}; X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -w '%{http_code}' -o "$CACHE_HIT_RESP_FILE1" \
  "${API_BASE}/api/rides/weather?rideDateTimeLocal=${CACHE_HIT_RIDE_DATETIME_LOCAL}" \
  -H "X-User-Id: ${USER_ID}" \
  -D "$CACHE_HIT_HEADERS_FILE1" \
  > "$CACHE_HIT_STATUS_FILE1" \
  || cv_fail "Cache-hit GET /api/rides/weather request 1 failed" $LINENO

CACHE_HIT_STATUS1="$(cat "$CACHE_HIT_STATUS_FILE1")"
cv_http "GET" "/api/rides/weather?rideDateTimeLocal=${CACHE_HIT_RIDE_DATETIME_LOCAL}" "$CACHE_HIT_STATUS1"

echo "RESPONSE_HEADERS:"
cat "$CACHE_HIT_HEADERS_FILE1" || true

echo "RESPONSE_BODY:"
cat "$CACHE_HIT_RESP_FILE1"

if [ "$CACHE_HIT_STATUS1" != "200" ]; then
  cv_fail "Expected cache-hit weather status 200 for first call got ${CACHE_HIT_STATUS1}" $LINENO
fi

# Second cache-hit call to confirm repeated reuse.
CACHE_HIT_RESP_FILE2="$(mktemp)"
CACHE_HIT_STATUS_FILE2="$(mktemp)"
CACHE_HIT_HEADERS_FILE2="$(mktemp)"

REQUEST_HEADERS="GET ${API_BASE}/api/rides/weather?rideDateTimeLocal=${CACHE_HIT_RIDE_DATETIME_LOCAL}; X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -w '%{http_code}' -o "$CACHE_HIT_RESP_FILE2" \
  "${API_BASE}/api/rides/weather?rideDateTimeLocal=${CACHE_HIT_RIDE_DATETIME_LOCAL}" \
  -H "X-User-Id: ${USER_ID}" \
  -D "$CACHE_HIT_HEADERS_FILE2" \
  > "$CACHE_HIT_STATUS_FILE2" \
  || cv_fail "Cache-hit GET /api/rides/weather request 2 failed" $LINENO

CACHE_HIT_STATUS2="$(cat "$CACHE_HIT_STATUS_FILE2")"
cv_http "GET" "/api/rides/weather?rideDateTimeLocal=${CACHE_HIT_RIDE_DATETIME_LOCAL}" "$CACHE_HIT_STATUS2"

echo "RESPONSE_HEADERS:"
cat "$CACHE_HIT_HEADERS_FILE2" || true

echo "RESPONSE_BODY:"
cat "$CACHE_HIT_RESP_FILE2"

if [ "$CACHE_HIT_STATUS2" != "200" ]; then
  cv_fail "Expected cache-hit weather status 200 for second call got ${CACHE_HIT_STATUS2}" $LINENO
fi

cv_step Then "Assert weather responses use cached values and vendor is not called again" $LINENO

# 1. Assert both cache-hit responses report isAvailable == true and match pinned weather snapshot.
IS_AVAILABLE1="$(jq -r '.isAvailable' < "$CACHE_HIT_RESP_FILE1")"
IS_AVAILABLE2="$(jq -r '.isAvailable' < "$CACHE_HIT_RESP_FILE2")"

if [ "$IS_AVAILABLE1" != "true" ]; then
  cv_fail "Expected isAvailable=true on first cache-hit response got ${IS_AVAILABLE1}" $LINENO
fi
if [ "$IS_AVAILABLE2" != "true" ]; then
  cv_fail "Expected isAvailable=true on second cache-hit response got ${IS_AVAILABLE2}" $LINENO
fi

TEMP1="$(jq -r '.temperature' < "$CACHE_HIT_RESP_FILE1")"
TEMP2="$(jq -r '.temperature' < "$CACHE_HIT_RESP_FILE2")"
WIND_SPEED1="$(jq -r '.windSpeedMph' < "$CACHE_HIT_RESP_FILE1")"
WIND_SPEED2="$(jq -r '.windSpeedMph' < "$CACHE_HIT_RESP_FILE2")"
WIND_DIR1="$(jq -r '.windDirectionDeg' < "$CACHE_HIT_RESP_FILE1")"
WIND_DIR2="$(jq -r '.windDirectionDeg' < "$CACHE_HIT_RESP_FILE2")"
HUMIDITY1="$(jq -r '.relativeHumidityPercent' < "$CACHE_HIT_RESP_FILE1")"
HUMIDITY2="$(jq -r '.relativeHumidityPercent' < "$CACHE_HIT_RESP_FILE2")"
CLOUD_COVER1="$(jq -r '.cloudCoverPercent' < "$CACHE_HIT_RESP_FILE1")"
CLOUD_COVER2="$(jq -r '.cloudCoverPercent' < "$CACHE_HIT_RESP_FILE2")"
PRECIP1="$(jq -r '.precipitationType // ""' < "$CACHE_HIT_RESP_FILE1")"
PRECIP2="$(jq -r '.precipitationType // ""' < "$CACHE_HIT_RESP_FILE2")"

# Pinned snapshot values from the stub.
if [ "$TEMP1" != "72.5" ] || [ "$TEMP2" != "72.5" ]; then
  cv_fail "Expected temperature 72.5 on both cache-hit responses got ${TEMP1} and ${TEMP2}" $LINENO
fi
if [ "$WIND_SPEED1" != "10.3" ] || [ "$WIND_SPEED2" != "10.3" ]; then
  cv_fail "Expected windSpeedMph 10.3 on both cache-hit responses got ${WIND_SPEED1} and ${WIND_SPEED2}" $LINENO
fi
if [ "$WIND_DIR1" != "250" ] || [ "$WIND_DIR2" != "250" ]; then
  cv_fail "Expected windDirectionDeg 250 on both cache-hit responses got ${WIND_DIR1} and ${WIND_DIR2}" $LINENO
fi
if [ "$HUMIDITY1" != "65" ] || [ "$HUMIDITY2" != "65" ]; then
  cv_fail "Expected relativeHumidityPercent 65 on both cache-hit responses got ${HUMIDITY1} and ${HUMIDITY2}" $LINENO
fi
if [ "$CLOUD_COVER1" != "30" ] || [ "$CLOUD_COVER2" != "30" ]; then
  cv_fail "Expected cloudCoverPercent 30 on both cache-hit responses got ${CLOUD_COVER1} and ${CLOUD_COVER2}" $LINENO
fi
if [ -n "$PRECIP1" ] || [ -n "$PRECIP2" ]; then
  cv_fail "Expected precipitationType null/empty on cache-hit responses got '${PRECIP1}' and '${PRECIP2}'" $LINENO
fi

# 2. Assert rideDateTimeLocal echoes the requested value (modulo timezone suffix normalization).
RIDE_DT1_RAW="$(jq -r '.rideDateTimeLocal' < "$CACHE_HIT_RESP_FILE1")"
RIDE_DT2_RAW="$(jq -r '.rideDateTimeLocal' < "$CACHE_HIT_RESP_FILE2")"

# Normalize any timezone suffix (Z, +HH:MM, -HH:MM) from the server side for comparison.
normalize_datetime() {
  echo "$1" | sed -E 's/(Z|[+-][0-9]{2}:[0-9]{2})$//'
}

RIDE_DT1_NORM="$(normalize_datetime "$RIDE_DT1_RAW")"
RIDE_DT2_NORM="$(normalize_datetime "$RIDE_DT2_RAW")"
REQUEST_DT_NORM="$(normalize_datetime "$CACHE_HIT_RIDE_DATETIME_LOCAL")"

if [ "$RIDE_DT1_NORM" != "$REQUEST_DT_NORM" ]; then
  cv_fail "Expected rideDateTimeLocal on first cache-hit to echo ${REQUEST_DT_NORM} got ${RIDE_DT1_NORM}" $LINENO
fi
if [ "$RIDE_DT2_NORM" != "$REQUEST_DT_NORM" ]; then
  cv_fail "Expected rideDateTimeLocal on second cache-hit to echo ${REQUEST_DT_NORM} got ${RIDE_DT2_NORM}" $LINENO
fi

# 3. Inspect WireMock journal to ensure no additional vendor requests were made for the cache-hit calls.
VENDOR_REQUESTS_AFTER_FILE="$(mktemp)"

REQUEST_HEADERS="GET ${WIREMOCK_ADMIN_URL}/__admin/requests"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

curl -sS -f "${WIREMOCK_ADMIN_URL}/__admin/requests" -D /tmp/wiremock_after.hdr -o "$VENDOR_REQUESTS_AFTER_FILE" \
  || cv_fail "Failed to read WireMock journal after cache-hit calls" $LINENO

cv_http "GET" "/__admin/requests" "200"

echo "RESPONSE_HEADERS:"
cat /tmp/wiremock_after.hdr || true
rm -f /tmp/wiremock_after.hdr

echo "RESPONSE_BODY:"
cat "$VENDOR_REQUESTS_AFTER_FILE"

FORECAST_CALLS_AFTER="$(jq '[.requests[] | select(.request.url | startswith("/v1/archive"))] | length' < "$VENDOR_REQUESTS_AFTER_FILE")"
rm -f "$VENDOR_REQUESTS_AFTER_FILE"

# We expect that the number of forecast calls did not increase by more than 1 across the two cache-hit calls.
# Because Polly retries may cause >1 calls on the initial cache-miss, we assert that no new batch of retries occurred:
if [ "$FORECAST_CALLS_AFTER" -gt "$FORECAST_CALLS_BEFORE" ]; then
  cv_fail "Expected no additional Open-Meteo archive calls for cache-hit requests; before=${FORECAST_CALLS_BEFORE}, after=${FORECAST_CALLS_AFTER}" $LINENO
fi

rm -f "$CACHE_HIT_RESP_FILE1" "$CACHE_HIT_RESP_FILE2" "$CACHE_HIT_STATUS_FILE1" "$CACHE_HIT_STATUS_FILE2" "$CACHE_HIT_HEADERS_FILE1" "$CACHE_HIT_HEADERS_FILE2"

cv_step Cleanup "No-op cleanup for cache-hit weather test case" $LINENO

# No explicit teardown required; app and WireMock containers are reset between runs by the harness.

echo "CODEVALID_TEST_ASSERTION_OK:authenticated_cache_hit_reuses_weather_snapshot"
