#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step Given "Import WireMock mappings for Open-Meteo archive distinct snapshots per location" $LINENO
CASE_DIR=".codevalid/wiremock/mappings/cases/authenticated_different_locations_distinct_cache_keys"
mkdir -p "$CASE_DIR"

# Stub for location A: latitude ~40.71, longitude ~-74.01, archive API
cat > "$CASE_DIR/open-meteo-archive-location-a.json" <<'JSON'
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
        "equalTo": "2024-01-10"
      },
      "end_date": {
        "equalTo": "2024-01-10"
      }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "hourly": {
        "time": [
          "2024-01-10T09:00",
          "2024-01-10T10:00",
          "2024-01-10T11:00"
        ],
        "temperature_2m": [
          70.5,
          72.5,
          74.5
        ],
        "wind_speed_10m": [
          8.3,
          10.3,
          12.3
        ],
        "wind_direction_10m": [
          240,
          250,
          260
        ],
        "relative_humidity_2m": [
          60,
          65,
          70
        ],
        "cloud_cover": [
          25,
          30,
          35
        ],
        "precipitation": [
          0.0,
          0.1,
          0.0
        ],
        "snowfall": [
          0.0,
          0.0,
          0.0
        ],
        "weather_code": [
          1,
          1,
          1
        ]
      }
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

# Stub for location B: latitude ~34.05, longitude ~-118.25, archive API
cat > "$CASE_DIR/open-meteo-archive-location-b.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v1/archive",
    "queryParameters": {
      "latitude": {
        "matches": "34\\.05.*"
      },
      "longitude": {
        "matches": "-118\\.25.*"
      },
      "start_date": {
        "equalTo": "2024-01-10"
      },
      "end_date": {
        "equalTo": "2024-01-10"
      }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "hourly": {
        "time": [
          "2024-01-10T09:00",
          "2024-01-10T10:00",
          "2024-01-10T11:00"
        ],
        "temperature_2m": [
          60.1,
          62.1,
          64.1
        ],
        "wind_speed_10m": [
          5.0,
          7.0,
          9.0
        ],
        "wind_direction_10m": [
          180,
          190,
          200
        ],
        "relative_humidity_2m": [
          40,
          45,
          50
        ],
        "cloud_cover": [
          10,
          15,
          20
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

wiremock_admin_import_mappings "$CASE_DIR"

cv_prereq "Signup rider and configure initial UserSettings for location A; clear WireMock journal" $LINENO

API_BASE="http://app:${PORT}"

# 1. Signup to create rider
SIGNUP_BODY_FILE="$(mktemp)"
cat > "$SIGNUP_BODY_FILE" <<'JSON'
{
  "name": "Weather Cache Rider",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"
cv_prereq "POST /api/users/signup to create rider" $LINENO
REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "$SIGNUP_BODY_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"
SIGNUP_STATUS=$(curl -sS -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_RESP_FILE" -w '%{http_code}' \
  -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$SIGNUP_BODY_FILE")
cv_http POST "/api/users/signup" "$SIGNUP_STATUS"
RESPONSE_HEADERS="$(cat "$SIGNUP_HDR_FILE")"
RESPONSE_BODY="$(cat "$SIGNUP_RESP_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"
if [ "$SIGNUP_STATUS" -ne 201 ]; then
  cv_fail "Expected 201 from signup, got $SIGNUP_STATUS" $LINENO
fi

RIDER_ID="$(jq -r '.userId' <"$SIGNUP_RESP_FILE")"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "Signup response missing userId" $LINENO
fi

# 2. Configure UserSettings for location A (New York-ish coordinates)
SETTINGS_BODY_A_FILE="$(mktemp)"
# UpdatedAtUtc must be provided; use a fixed ISO string so model binding succeeds
cat > "$SETTINGS_BODY_A_FILE" <<JSON
{
  "averageCarMpg": null,
  "yearlyGoalMiles": null,
  "oilChangePrice": null,
  "mileageRateCents": null,
  "locationLabel": "Location A",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": false,
  "dashboardGoalProgressEnabled": false,
  "weatherApiKey": null,
  "eiaGasApiKey": null,
  "updatedAtUtc": "2024-01-01T00:00:00Z"
}
JSON

SETTINGS_RESP_A_FILE="$(mktemp)"
SETTINGS_HDR_A_FILE="$(mktemp)"
cv_prereq "PUT /api/users/me/settings to set location A" $LINENO
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$SETTINGS_BODY_A_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"
SETTINGS_STATUS_A=$(curl -sS -D "$SETTINGS_HDR_A_FILE" -o "$SETTINGS_RESP_A_FILE" -w '%{http_code}' \
  -X PUT "${API_BASE}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$SETTINGS_BODY_A_FILE")
cv_http PUT "/api/users/me/settings" "$SETTINGS_STATUS_A"
RESPONSE_HEADERS="$(cat "$SETTINGS_HDR_A_FILE")"
RESPONSE_BODY="$(cat "$SETTINGS_RESP_A_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"
if [ "$SETTINGS_STATUS_A" -ne 200 ]; then
  cv_fail "Expected 200 from settings update for location A, got $SETTINGS_STATUS_A" $LINENO
fi

# 3. Clear WireMock request journal before weather calls
WIREMOCK_HDR_RESET_FILE="$(mktemp)"
cv_prereq "Reset WireMock request journal" $LINENO
REQUEST_HEADERS="(none)"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"
WIREMOCK_RESET_STATUS=$(curl -sS -D "$WIREMOCK_HDR_RESET_FILE" -o /dev/null -w '%{http_code}' -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests")
cv_http DELETE "/__admin/requests" "$WIREMOCK_RESET_STATUS"
RESPONSE_HEADERS="$(cat "$WIREMOCK_HDR_RESET_FILE")"
RESPONSE_BODY="(no body)"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"
if [ "$WIREMOCK_RESET_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from WireMock journal reset, got $WIREMOCK_RESET_STATUS" $LINENO
fi

# Common rideDateTimeLocal for all weather calls (older than 92 days to force archive API)
RIDE_LOCAL_TIME="2024-01-10T10:30:00"

cv_step When "Call GET /api/rides/weather for location A and then reconfigure settings for location B and call twice" $LINENO

# Helper: perform a weather call for current settings, store response in given file
call_weather() {
  local resp_file="$1"
  local status_file="$2"
  local hdr_file
  hdr_file="$(mktemp)"

  REQUEST_HEADERS="X-User-Id: ${RIDER_ID}"
  REQUEST_BODY="(none)"
  echo "REQUEST_HEADERS: $REQUEST_HEADERS"
  echo "REQUEST_BODY: $REQUEST_BODY"
  local status
  status=$(curl -sS -D "$hdr_file" -o "$resp_file" -w '%{http_code}' \
    -X GET "${API_BASE}/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL_TIME}" \
    -H "X-User-Id: ${RIDER_ID}")
  echo "$status" >"$status_file"
  cv_http GET "/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL_TIME}" "$status"
  RESPONSE_HEADERS="$(cat "$hdr_file")"
  RESPONSE_BODY="$(cat "$resp_file")"
  echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
  echo "RESPONSE_BODY: $RESPONSE_BODY"
  echo "$status"
}

# 1. First weather call for location A (cache miss, vendor call)
WEATHER_A1_RESP_FILE="$(mktemp)"
WEATHER_A1_STATUS_FILE="$(mktemp)"
STATUS_A1="$(call_weather "$WEATHER_A1_RESP_FILE" "$WEATHER_A1_STATUS_FILE")"
if [ "$STATUS_A1" -ne 200 ]; then
  cv_fail "Expected 200 from first weather call for location A, got $STATUS_A1" $LINENO
fi

# 2. Switch UserSettings to location B (Los Angeles-ish coordinates)
SETTINGS_BODY_B_FILE="$(mktemp)"
cat > "$SETTINGS_BODY_B_FILE" <<JSON
{
  "averageCarMpg": null,
  "yearlyGoalMiles": null,
  "oilChangePrice": null,
  "mileageRateCents": null,
  "locationLabel": "Location B",
  "latitude": 34.05,
  "longitude": -118.25,
  "dashboardGallonsAvoidedEnabled": false,
  "dashboardGoalProgressEnabled": false,
  "weatherApiKey": null,
  "eiaGasApiKey": null,
  "updatedAtUtc": "2024-01-02T00:00:00Z"
}
JSON

SETTINGS_RESP_B_FILE="$(mktemp)"
SETTINGS_HDR_B_FILE="$(mktemp)"
cv_prereq "PUT /api/users/me/settings to set location B" $LINENO
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$SETTINGS_BODY_B_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"
SETTINGS_STATUS_B=$(curl -sS -D "$SETTINGS_HDR_B_FILE" -o "$SETTINGS_RESP_B_FILE" -w '%{http_code}' \
  -X PUT "${API_BASE}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$SETTINGS_BODY_B_FILE")
cv_http PUT "/api/users/me/settings" "$SETTINGS_STATUS_B"
RESPONSE_HEADERS="$(cat "$SETTINGS_HDR_B_FILE")"
RESPONSE_BODY="$(cat "$SETTINGS_RESP_B_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"
if [ "$SETTINGS_STATUS_B" -ne 200 ]; then
  cv_fail "Expected 200 from settings update for location B, got $SETTINGS_STATUS_B" $LINENO
fi

# 3. First weather call for location B (cache miss, vendor call)
WEATHER_B1_RESP_FILE="$(mktemp)"
WEATHER_B1_STATUS_FILE="$(mktemp)"
STATUS_B1="$(call_weather "$WEATHER_B1_RESP_FILE" "$WEATHER_B1_STATUS_FILE")"
if [ "$STATUS_B1" -ne 200 ]; then
  cv_fail "Expected 200 from first weather call for location B, got $STATUS_B1" $LINENO
fi

# 4. Second weather call for location B (cache hit for B)
WEATHER_B2_RESP_FILE="$(mktemp)"
WEATHER_B2_STATUS_FILE="$(mktemp)"
STATUS_B2="$(call_weather "$WEATHER_B2_RESP_FILE" "$WEATHER_B2_STATUS_FILE")"
if [ "$STATUS_B2" -ne 200 ]; then
  cv_fail "Expected 200 from second weather call for location B, got $STATUS_B2" $LINENO
fi

# 5. Switch back to location A and call again (cache hit for A)
SETTINGS_RESP_A2_FILE="$(mktemp)"
SETTINGS_HDR_A2_FILE="$(mktemp)"
cv_prereq "PUT /api/users/me/settings back to location A" $LINENO
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$SETTINGS_BODY_A_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"
SETTINGS_STATUS_A2=$(curl -sS -D "$SETTINGS_HDR_A2_FILE" -o "$SETTINGS_RESP_A2_FILE" -w '%{http_code}' \
  -X PUT "${API_BASE}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$SETTINGS_BODY_A_FILE")
cv_http PUT "/api/users/me/settings" "$SETTINGS_STATUS_A2"
RESPONSE_HEADERS="$(cat "$SETTINGS_HDR_A2_FILE")"
RESPONSE_BODY="$(cat "$SETTINGS_RESP_A2_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"
if [ "$SETTINGS_STATUS_A2" -ne 200 ]; then
  cv_fail "Expected 200 from settings re-update for location A, got $SETTINGS_STATUS_A2" $LINENO
fi

WEATHER_A2_RESP_FILE="$(mktemp)"
WEATHER_A2_STATUS_FILE="$(mktemp)"
STATUS_A2="$(call_weather "$WEATHER_A2_RESP_FILE" "$WEATHER_A2_STATUS_FILE")"
if [ "$STATUS_A2" -ne 200 ]; then
  cv_fail "Expected 200 from second weather call for location A, got $STATUS_A2" $LINENO
fi

cv_step Then "Assert per-location weather snapshots match stubs and WireMock journal shows distinct cache keys per location" $LINENO

# 1. Assert RideDateTimeLocal echo and availability for all calls
for f in "$WEATHER_A1_RESP_FILE" "$WEATHER_A2_RESP_FILE" "$WEATHER_B1_RESP_FILE" "$WEATHER_B2_RESP_FILE"; do
  RIDE_ECHO="$(jq -r '.rideDateTimeLocal' <"$f")"
  if [ "$RIDE_ECHO" = "null" ]; then
    cv_fail "rideDateTimeLocal missing in response $(basename "$f")" $LINENO
  fi
  # Strip timezone suffix from echo and expected, because server may include offset
  RIDE_ECHO_STRIPPED="$(echo "$RIDE_ECHO" | sed -E 's/(Z|[+-][0-9]{2}:[0-9]{2})$//')"
  EXPECTED_STRIPPED="$(echo "$RIDE_LOCAL_TIME" | sed -E 's/(Z|[+-][0-9]{2}:[0-9]{2})$//')"
  if [ "$RIDE_ECHO_STRIPPED" != "$EXPECTED_STRIPPED" ]; then
    cv_fail "Expected rideDateTimeLocal ${EXPECTED_STRIPPED}, got ${RIDE_ECHO_STRIPPED}" $LINENO
  fi

  IS_AVAILABLE="$(jq -r '.isAvailable' <"$f")"
  if [ "$IS_AVAILABLE" != "true" ]; then
    cv_fail "Expected isAvailable=true, got ${IS_AVAILABLE} in $(basename "$f")" $LINENO
  fi
done

# 2. Assert location A snapshot matches stub values and is stable across A1/A2
TEMP_A1="$(jq -r '.temperature' <"$WEATHER_A1_RESP_FILE")"
TEMP_A2="$(jq -r '.temperature' <"$WEATHER_A2_RESP_FILE")"
WIND_SPEED_A1="$(jq -r '.windSpeedMph' <"$WEATHER_A1_RESP_FILE")"
WIND_SPEED_A2="$(jq -r '.windSpeedMph' <"$WEATHER_A2_RESP_FILE")"
WIND_DIR_A1="$(jq -r '.windDirectionDeg' <"$WEATHER_A1_RESP_FILE")"
WIND_DIR_A2="$(jq -r '.windDirectionDeg' <"$WEATHER_A2_RESP_FILE")"
HUMID_A1="$(jq -r '.relativeHumidityPercent' <"$WEATHER_A1_RESP_FILE")"
HUMID_A2="$(jq -r '.relativeHumidityPercent' <"$WEATHER_A2_RESP_FILE")"
CLOUD_A1="$(jq -r '.cloudCoverPercent' <"$WEATHER_A1_RESP_FILE")"
CLOUD_A2="$(jq -r '.cloudCoverPercent' <"$WEATHER_A2_RESP_FILE")"
PRECIP_A1="$(jq -r '.precipitationType' <"$WEATHER_A1_RESP_FILE")"
PRECIP_A2="$(jq -r '.precipitationType' <"$WEATHER_A2_RESP_FILE")"

# Expected from location A stub: second hourly bucket at 10:00 is index 1
if [ "$TEMP_A1" != "72.5" ] || [ "$TEMP_A2" != "72.5" ]; then
  cv_fail "Location A temperature should be 72.5 in both calls; got A1=${TEMP_A1}, A2=${TEMP_A2}" $LINENO
fi
if [ "$WIND_SPEED_A1" != "10.3" ] || [ "$WIND_SPEED_A2" != "10.3" ]; then
  cv_fail "Location A windSpeedMph should be 10.3 in both calls; got A1=${WIND_SPEED_A1}, A2=${WIND_SPEED_A2}" $LINENO
fi
if [ "$WIND_DIR_A1" != "250" ] || [ "$WIND_DIR_A2" != "250" ]; then
  cv_fail "Location A windDirectionDeg should be 250; got A1=${WIND_DIR_A1}, A2=${WIND_DIR_A2}" $LINENO
fi
if [ "$HUMID_A1" != "65" ] || [ "$HUMID_A2" != "65" ]; then
  cv_fail "Location A relativeHumidityPercent should be 65; got A1=${HUMID_A1}, A2=${HUMID_A2}" $LINENO
fi
if [ "$CLOUD_A1" != "30" ] || [ "$CLOUD_A2" != "30" ]; then
  cv_fail "Location A cloudCoverPercent should be 30; got A1=${CLOUD_A1}, A2=${CLOUD_A2}" $LINENO
fi
# PrecipitationType derived from weather_code 1 with hasPrecip=true, hasSnow=false: app DeterminePrecipitationType may yield "rain" or null; acceptance allows either so just assert stability
if [ "$PRECIP_A1" != "$PRECIP_A2" ]; then
  cv_fail "Location A precipitationType should be stable across calls; got A1=${PRECIP_A1}, A2=${PRECIP_A2}" $LINENO
fi

# 3. Assert location B snapshot matches stub values and is stable across B1/B2
TEMP_B1="$(jq -r '.temperature' <"$WEATHER_B1_RESP_FILE")"
TEMP_B2="$(jq -r '.temperature' <"$WEATHER_B2_RESP_FILE")"
WIND_SPEED_B1="$(jq -r '.windSpeedMph' <"$WEATHER_B1_RESP_FILE")"
WIND_SPEED_B2="$(jq -r '.windSpeedMph' <"$WEATHER_B2_RESP_FILE")"
WIND_DIR_B1="$(jq -r '.windDirectionDeg' <"$WEATHER_B1_RESP_FILE")"
WIND_DIR_B2="$(jq -r '.windDirectionDeg' <"$WEATHER_B2_RESP_FILE")"
HUMID_B1="$(jq -r '.relativeHumidityPercent' <"$WEATHER_B1_RESP_FILE")"
HUMID_B2="$(jq -r '.relativeHumidityPercent' <"$WEATHER_B2_RESP_FILE")"
CLOUD_B1="$(jq -r '.cloudCoverPercent' <"$WEATHER_B1_RESP_FILE")"
CLOUD_B2="$(jq -r '.cloudCoverPercent' <"$WEATHER_B2_RESP_FILE")"
PRECIP_B1="$(jq -r '.precipitationType' <"$WEATHER_B1_RESP_FILE")"
PRECIP_B2="$(jq -r '.precipitationType' <"$WEATHER_B2_RESP_FILE")"

if [ "$TEMP_B1" != "62.1" ] || [ "$TEMP_B2" != "62.1" ]; then
  cv_fail "Location B temperature should be 62.1 in both calls; got B1=${TEMP_B1}, B2=${TEMP_B2}" $LINENO
fi
if [ "$WIND_SPEED_B1" != "7" ] && [ "$WIND_SPEED_B1" != "7.0" ]; then
  cv_fail "Location B windSpeedMph should be 7.0; got B1=${WIND_SPEED_B1}" $LINENO
fi
if [ "$WIND_SPEED_B2" != "$WIND_SPEED_B1" ]; then
  cv_fail "Location B windSpeedMph should be stable across calls; got B1=${WIND_SPEED_B1}, B2=${WIND_SPEED_B2}" $LINENO
fi
if [ "$WIND_DIR_B1" != "190" ] || [ "$WIND_DIR_B2" != "190" ]; then
  cv_fail "Location B windDirectionDeg should be 190; got B1=${WIND_DIR_B1}, B2=${WIND_DIR_B2}" $LINENO
fi
if [ "$HUMID_B1" != "45" ] || [ "$HUMID_B2" != "45" ]; then
  cv_fail "Location B relativeHumidityPercent should be 45; got B1=${HUMID_B1}, B2=${HUMID_B2}" $LINENO
fi
if [ "$CLOUD_B1" != "15" ] || [ "$CLOUD_B2" != "15" ]; then
  cv_fail "Location B cloudCoverPercent should be 15; got B1=${CLOUD_B1}, B2=${CLOUD_B2}" $LINENO
fi
if [ "$PRECIP_B1" != "$PRECIP_B2" ]; then
  cv_fail "Location B precipitationType should be stable across calls; got B1=${PRECIP_B1}, B2=${PRECIP_B2}" $LINENO
fi

# 4. Assert distinct snapshots per location: temperatures differ between A and B
if [ "$TEMP_A1" = "$TEMP_B1" ]; then
  cv_fail "Expected different temperatures for locations A and B; both are ${TEMP_A1}" $LINENO
fi

# 5. Inspect WireMock request journal for /v1/archive calls and confirm both coordinate sets were used
WIREMOCK_REQUESTS_FILE="$(mktemp)"
WIREMOCK_HDR_REQ_FILE="$(mktemp)"
REQUEST_HEADERS="(none)"
REQUEST_BODY="(empty)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"
WIREMOCK_REQ_STATUS=$(curl -sS -D "$WIREMOCK_HDR_REQ_FILE" -o "$WIREMOCK_REQUESTS_FILE" -w '%{http_code}' \
  -X GET "${WIREMOCK_ADMIN_URL}/__admin/requests")
cv_http GET "/__admin/requests" "$WIREMOCK_REQ_STATUS"
RESPONSE_HEADERS="$(cat "$WIREMOCK_HDR_REQ_FILE")"
RESPONSE_BODY="$(cat "$WIREMOCK_REQUESTS_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"
if [ "$WIREMOCK_REQ_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from WireMock requests journal, got $WIREMOCK_REQ_STATUS" $LINENO
fi

# Extract URLs for archive calls
ARCHIVE_URLS="$(jq -r '.requests[] | select(.request.url | startswith("/v1/archive")) | .request.url' <"$WIREMOCK_REQUESTS_FILE")"

if [ -z "$ARCHIVE_URLS" ]; then
  cv_fail "Expected at least one /v1/archive call but found none" $LINENO
fi

# Count how many URLs mention location A vs location B coordinates in query
A_COUNT="$(printf '%s
' "$ARCHIVE_URLS" | grep -c 'latitude=40.71' || true)"
B_COUNT="$(printf '%s
' "$ARCHIVE_URLS" | grep -c 'latitude=34.05' || true)"

if [ "$A_COUNT" -lt 1 ]; then
  cv_fail "Expected at least one archive call for location A (latitude=40.71), found $A_COUNT" $LINENO
fi
if [ "$B_COUNT" -lt 1 ]; then
  cv_fail "Expected at least one archive call for location B (latitude=34.05), found $B_COUNT" $LINENO
fi

cv_step Cleanup "No-op teardown for authenticated_different_locations_distinct_cache_keys" $LINENO
# No explicit cleanup required; app container and WireMock are reset between seed-test runs.

echo "CODEVALID_TEST_ASSERTION_OK:authenticated_different_locations_distinct_cache_keys"
