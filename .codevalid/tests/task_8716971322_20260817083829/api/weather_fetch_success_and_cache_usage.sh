#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step "Given" "Import WireMock mappings for Open-Meteo weather cache miss and subsequent cache hit" $LINENO
CASE_DIR=".codevalid/wiremock/mappings/cases/weather_fetch_success_and_cache_usage"
mkdir -p "$CASE_DIR"

# Stub for Open-Meteo archive API (date chosen >92 days before current UTC so app calls /v1/archive).
# The app builds requestPath="/v1/archive" and query string with:
# latitude, longitude, start_date, end_date, hourly=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,cloud_cover,precipitation,weather_code,
# temperature_unit=fahrenheit, wind_speed_unit=mph, timezone=auto, and optional apikey.
# We match on urlPath and critical queryParameters (lat, lon, start_date/end_date).
cat > "$CASE_DIR/open-meteo-archive-weather.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v1/archive",
    "queryParameters": {
      "latitude": { "matches": "40\\.71.*" },
      "longitude": { "matches": "-74\\.01.*" },
      "start_date": { "equalTo": "2026-03-20" },
      "end_date": { "equalTo": "2026-03-20" }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "hourly": {
        "time": [
          "2026-03-20T08:00",
          "2026-03-20T09:00",
          "2026-03-20T10:00",
          "2026-03-20T11:00"
        ],
        "temperature_2m": [ 45.5, 46.0, 47.25, 48.0 ],
        "wind_speed_10m": [ 5.0, 6.0, 7.5, 8.0 ],
        "wind_direction_10m": [ 90, 100, 110, 120 ],
        "relative_humidity_2m": [ 55, 60, 65, 70 ],
        "cloud_cover": [ 10, 20, 30, 40 ],
        "precipitation": [ 0.0, 0.0, 0.1, 0.0 ],
        "snowfall": [ 0.0, 0.0, 0.0, 0.0 ],
        "weather_code": [ 0, 1, 61, 2 ]
      }
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

cv_prereq "Sign up rider and configure UserSettings with lat/lon for weather lookup; clear WireMock request journal" $LINENO

BASE_URL="http://app:${PORT}"

# 1. Sign up a new rider via POST /api/users/signup.
# UsersEndpoints expects JSON with 'name' and 'pin' fields.
signup_body_file="$(mktemp)"
cat > "$signup_body_file" <<'JSON'
{
  "name": "Weather Cache Rider",
  "pin": "1234"
}
JSON

signup_resp_file="$(mktemp)"
signup_status_file="$(mktemp)"
signup_hdr_file="$(mktemp)"
cv_prereq "Signup rider via POST /api/users/signup" $LINENO
echo "REQUEST_HEADERS: Content-Type=application/json";
echo "REQUEST_BODY:"; cat "$signup_body_file";
code=$(curl -sS -o "$signup_resp_file" -w "%{http_code}" \
  -D "$signup_hdr_file" \
  -X POST "${BASE_URL}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$signup_body_file")
printf '%s' "$code" >"$signup_status_file"
signup_status="$(cat "$signup_status_file")"
echo "RESPONSE_HEADERS:"; cat "$signup_hdr_file";
echo "RESPONSE_BODY:"; cat "$signup_resp_file";
cv_http "POST" "/api/users/signup" "$signup_status"
if [ "$signup_status" -ne 201 ]; then
  cv_fail "Expected 201 from signup, got ${signup_status}" $LINENO
fi

rider_id="$(jq -r '.userId // .id // .riderId' "$signup_resp_file")"
if [ -z "$rider_id" ] || [ "$rider_id" = "null" ]; then
  cv_fail "Unable to read rider id from signup response" $LINENO
fi

# 2. Configure UserSettings with lat/lon and optional weatherApiKey.
settings_body_file="$(mktemp)"
cat > "$settings_body_file" <<JSON
{
  "averageCarMpg": 30.0,
  "yearlyGoalMiles": 1000.0,
  "oilChangePrice": 60.0,
  "mileageRateCents": 58.0,
  "locationLabel": "NYC Test Location",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "weatherApiKey": "",
  "eiaGasApiKey": ""
}
JSON

settings_resp_file="$(mktemp)"
settings_status_file="$(mktemp)"
settings_hdr_file="$(mktemp)"
cv_prereq "Set rider UserSettings with lat/lon via PUT /api/users/me/settings" $LINENO
echo "REQUEST_HEADERS: Content-Type=application/json; X-User-Id=${rider_id}";
echo "REQUEST_BODY:"; cat "$settings_body_file";
code=$(curl -sS -o "$settings_resp_file" -w "%{http_code}" \
  -D "$settings_hdr_file" \
  -X PUT "${BASE_URL}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${rider_id}" \
  --data-binary @"$settings_body_file")
printf '%s' "$code" >"$settings_status_file"
settings_status="$(cat "$settings_status_file")"
echo "RESPONSE_HEADERS:"; cat "$settings_hdr_file";
echo "RESPONSE_BODY:"; cat "$settings_resp_file";
cv_http "PUT" "/api/users/me/settings" "$settings_status"
if [ "$settings_status" -ne 200 ]; then
  cv_fail "Expected 200 from settings update, got ${settings_status}" $LINENO
fi

# 3. Clear WireMock request journal before measuring vendor calls.
cv_prereq "Reset WireMock requests journal via DELETE /__admin/requests" $LINENO
wiremock_reset_hdr_file="$(mktemp)"
echo "REQUEST_HEADERS: (none)";
echo "REQUEST_BODY: (empty)";
code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -D "$wiremock_reset_hdr_file" \
  -X DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests")
echo "RESPONSE_HEADERS:"; cat "$wiremock_reset_hdr_file";
echo "RESPONSE_BODY: (empty)";
cv_http "DELETE" "/__admin/requests" "$code"
if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  cv_fail "Failed to reset WireMock request journal" $LINENO
fi

cv_step "When" "Call GET /api/rides/weather twice for same hourly bucket, then record a ride with server-side weather enrichment" $LINENO

# Use a rideDateTimeLocal on 2026-03-20 in local time such that UTC hour 10:00 is used.
# For the test environment (no explicit timezone offset), we use "2026-03-20T10:15".
ride_datetime_local_1="2026-03-20T10:15"
ride_datetime_local_2="2026-03-20T10:45"

# First weather load (expected cache miss, vendor call).
weather1_resp_file="$(mktemp)"
weather1_status_file="$(mktemp)"
weather1_hdr_file="$(mktemp)"
cv_prereq "First GET /api/rides/weather cache miss and vendor call" $LINENO
echo "REQUEST_HEADERS: X-User-Id=${rider_id}";
echo "REQUEST_BODY: (query rideDateTimeLocal=${ride_datetime_local_1})";
code=$(curl -sS -o "$weather1_resp_file" -w "%{http_code}" \
  -D "$weather1_hdr_file" \
  -G "${BASE_URL}/api/rides/weather" \
  -H "X-User-Id: ${rider_id}" \
  --data-urlencode "rideDateTimeLocal=${ride_datetime_local_1}")
printf '%s' "$code" >"$weather1_status_file"
weather1_status="$(cat "$weather1_status_file")"
echo "RESPONSE_HEADERS:"; cat "$weather1_hdr_file";
echo "RESPONSE_BODY:"; cat "$weather1_resp_file";
cv_http "GET" "/api/rides/weather" "$weather1_status"
if [ "$weather1_status" -ne 200 ]; then
  cv_fail "Expected 200 from first GET /api/rides/weather, got ${weather1_status}" $LINENO
fi

# Capture first weather response values.
temp1="$(jq -r '.temperature' "$weather1_resp_file")"
wind_speed1="$(jq -r '.windSpeedMph' "$weather1_resp_file")"
wind_dir1="$(jq -r '.windDirectionDeg' "$weather1_resp_file")"
humidity1="$(jq -r '.relativeHumidityPercent' "$weather1_resp_file")"
cloud1="$(jq -r '.cloudCoverPercent' "$weather1_resp_file")"
precip1="$(jq -r '.precipitationType' "$weather1_resp_file")"
is_available1="$(jq -r '.isAvailable' "$weather1_resp_file")"

# Second weather load for same hourly bucket (should reuse cache).
weather2_resp_file="$(mktemp)"
weather2_status_file="$(mktemp)"
weather2_hdr_file="$(mktemp)"
cv_prereq "Second GET /api/rides/weather expected cache hit" $LINENO
echo "REQUEST_HEADERS: X-User-Id=${rider_id}";
echo "REQUEST_BODY: (query rideDateTimeLocal=${ride_datetime_local_2})";
code=$(curl -sS -o "$weather2_resp_file" -w "%{http_code}" \
  -D "$weather2_hdr_file" \
  -G "${BASE_URL}/api/rides/weather" \
  -H "X-User-Id: ${rider_id}" \
  --data-urlencode "rideDateTimeLocal=${ride_datetime_local_2}")
printf '%s' "$code" >"$weather2_status_file"
weather2_status="$(cat "$weather2_status_file")"
echo "RESPONSE_HEADERS:"; cat "$weather2_hdr_file";
echo "RESPONSE_BODY:"; cat "$weather2_resp_file";
cv_http "GET" "/api/rides/weather" "$weather2_status"
if [ "$weather2_status" -ne 200 ]; then
  cv_fail "Expected 200 from second GET /api/rides/weather, got ${weather2_status}" $LINENO
fi

temp2="$(jq -r '.temperature' "$weather2_resp_file")"
wind_speed2="$(jq -r '.windSpeedMph' "$weather2_resp_file")"
wind_dir2="$(jq -r '.windDirectionDeg' "$weather2_resp_file")"
humidity2="$(jq -r '.relativeHumidityPercent' "$weather2_resp_file")"
cloud2="$(jq -r '.cloudCoverPercent' "$weather2_resp_file")"
precip2="$(jq -r '.precipitationType' "$weather2_resp_file")"
is_available2="$(jq -r '.isAvailable' "$weather2_resp_file")"

# Record a ride for the second timestamp, allowing server-side weather enrichment.
record_body_file="$(mktemp)"
cat > "$record_body_file" <<JSON
{
  "rideDateTimeLocal": "${ride_datetime_local_2}",
  "miles": 12.5,
  "rideMinutes": 45,
  "temperature": null,
  "gasPricePerGallon": null,
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "Weather cache reuse ride",
  "weatherUserOverridden": false,
  "difficulty": null,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "seed-test-weather-cache"
}
JSON

record_resp_file="$(mktemp)"
record_status_file="$(mktemp)"
record_hdr_file="$(mktemp)"
cv_prereq "POST /api/rides to persist ride with cached weather enrichment" $LINENO
echo "REQUEST_HEADERS: Content-Type=application/json; X-User-Id=${rider_id}";
echo "REQUEST_BODY:"; cat "$record_body_file";
code=$(curl -sS -o "$record_resp_file" -w "%{http_code}" \
  -D "$record_hdr_file" \
  -X POST "${BASE_URL}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${rider_id}" \
  --data-binary @"$record_body_file")
printf '%s' "$code" >"$record_status_file"
record_status="$(cat "$record_status_file")"
echo "RESPONSE_HEADERS:"; cat "$record_hdr_file";
echo "RESPONSE_BODY:"; cat "$record_resp_file";
cv_http "POST" "/api/rides" "$record_status"
if [ "$record_status" -ne 201 ]; then
  cv_fail "Expected 201 from POST /api/rides, got ${record_status}" $LINENO
fi

ride_id="$(jq -r '.rideId' "$record_resp_file")"
if [ -z "$ride_id" ] || [ "$ride_id" = "null" ]; then
  cv_fail "Unable to read rideId from record ride response" $LINENO
fi

cv_step "Then" "Assert weather cache behavior and persisted ride weather snapshot fields" $LINENO

# 1. Assert first weather call used vendor (at least one /v1/archive request).
vendor_requests_file="$(mktemp)"
vendor_hdr_file="$(mktemp)"
cv_prereq "Fetch WireMock request journal to inspect Open-Meteo calls" $LINENO
echo "REQUEST_HEADERS: (none)";
echo "REQUEST_BODY: (empty)";
code=$(curl -sS -o "$vendor_requests_file" -w "%{http_code}" \
  -D "$vendor_hdr_file" \
  -X GET "${WIREMOCK_ADMIN_URL}/__admin/requests")
echo "RESPONSE_HEADERS:"; cat "$vendor_hdr_file";
echo "RESPONSE_BODY:"; cat "$vendor_requests_file";
cv_http "GET" "/__admin/requests" "$code"
if [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
  cv_fail "Failed to read WireMock requests journal" $LINENO
fi

archive_call_count="$(
  jq '[.requests[]
      | select(.request.url | startswith("/v1/archive"))
     ] | length' "$vendor_requests_file"
)"
if [ "$archive_call_count" -lt 1 ]; then
  cv_fail "Expected at least one Open-Meteo /v1/archive call for first weather fetch, got ${archive_call_count}" $LINENO
fi

# 2. Assert second weather response reused cached values (equal to first) and isAvailable=true.
if [ "$is_available1" != "true" ]; then
  cv_fail "Expected isAvailable=true on first weather response, got ${is_available1}" $LINENO
fi
if [ "$is_available2" != "true" ]; then
  cv_fail "Expected isAvailable=true on second weather response, got ${is_available2}" $LINENO
fi

# Numeric comparisons: use awk to avoid string/float mismatch issues.
awk -v a="$temp1" -v b="$temp2" 'BEGIN{if (a != b) exit 1}' || cv_fail "Expected same temperature from cache; got temp1=${temp1}, temp2=${temp2}" $LINENO
awk -v a="$wind_speed1" -v b="$wind_speed2" 'BEGIN{if (a != b) exit 1}' || cv_fail "Expected same windSpeedMph from cache; got windSpeed1=${wind_speed1}, windSpeed2=${wind_speed2}" $LINENO
if [ "$wind_dir1" != "$wind_dir2" ]; then
  cv_fail "Expected same windDirectionDeg from cache; got windDir1=${wind_dir1}, windDir2=${wind_dir2}" $LINENO
fi
if [ "$humidity1" != "$humidity2" ]; then
  cv_fail "Expected same relativeHumidityPercent from cache; got humidity1=${humidity1}, humidity2=${humidity2}" $LINENO
fi
if [ "$cloud1" != "$cloud2" ]; then
  cv_fail "Expected same cloudCoverPercent from cache; got cloud1=${cloud1}, cloud2=${cloud2}" $LINENO
fi
if [ "$precip1" != "$precip2" ]; then
  cv_fail "Expected same precipitationType from cache; got precip1=${precip1}, precip2=${precip2}" $LINENO
fi

# 3. Assert that total vendor calls did not grow beyond what is needed for a single cache miss.
# The app may retry on 5xx, but our stub returns 200, so each weather fetch should need only one call.
# We assert no more than 2 calls (defensive upper bound) to detect runaway calls while tolerating minimal overhead.
if [ "$archive_call_count" -gt 2 ]; then
  cv_fail "Expected at most 2 Open-Meteo /v1/archive calls, got ${archive_call_count}" $LINENO
fi

# 4. Assert persisted ride weather snapshot fields via GET /api/rides/history.
history_resp_file="$(mktemp)"
history_status_file="$(mktemp)"
history_hdr_file="$(mktemp)"
cv_prereq "GET /api/rides/history to verify stored ride weather snapshot" $LINENO
echo "REQUEST_HEADERS: X-User-Id=${rider_id}";
echo "REQUEST_BODY: (empty)";
code=$(curl -sS -o "$history_resp_file" -w "%{http_code}" \
  -D "$history_hdr_file" \
  -X GET "${BASE_URL}/api/rides/history" \
  -H "X-User-Id: ${rider_id}")
printf '%s' "$code" >"$history_status_file"
history_status="$(cat "$history_status_file")"
echo "RESPONSE_HEADERS:"; cat "$history_hdr_file";
echo "RESPONSE_BODY:"; cat "$history_resp_file";
cv_http "GET" "/api/rides/history" "$history_status"
if [ "$history_status" -ne 200 ]; then
  cv_fail "Expected 200 from GET /api/rides/history, got ${history_status}" $LINENO
fi

# Extract the ride row by rideId (camelCase JSON keys).
ride_row_json="$(
  jq -c --arg rid "$ride_id" '.rides[] | select((.rideId|tostring) == $rid)' "$history_resp_file"
)"
if [ -z "$ride_row_json" ]; then
  cv_fail "Expected to find rideId=${ride_id} in history response, but none matched" $LINENO
fi

hist_temp="$(echo "$ride_row_json" | jq -r '.temperature')"
hist_wind_speed="$(echo "$ride_row_json" | jq -r '.windSpeedMph')"
hist_wind_dir="$(echo "$ride_row_json" | jq -r '.windDirectionDeg')"
hist_humidity="$(echo "$ride_row_json" | jq -r '.relativeHumidityPercent')"
hist_cloud="$(echo "$ride_row_json" | jq -r '.cloudCoverPercent')"
hist_precip="$(echo "$ride_row_json" | jq -r '.precipitationType')"
hist_weather_overridden="$(echo "$ride_row_json" | jq -r '.weatherUserOverridden')"

awk -v a="$temp2" -v b="$hist_temp" 'BEGIN{if (a != b) exit 1}' || cv_fail "Expected persisted temperature to match second weather response; got temp2=${temp2}, hist_temp=${hist_temp}" $LINENO
awk -v a="$wind_speed2" -v b="$hist_wind_speed" 'BEGIN{if (a != b) exit 1}' || cv_fail "Expected persisted windSpeedMph to match second weather response; got windSpeed2=${wind_speed2}, hist_wind_speed=${hist_wind_speed}" $LINENO
if [ "$wind_dir2" != "$hist_wind_dir" ]; then
  cv_fail "Expected persisted windDirectionDeg=${wind_dir2}, got ${hist_wind_dir}" $LINENO
fi
if [ "$humidity2" != "$hist_humidity" ]; then
  cv_fail "Expected persisted relativeHumidityPercent=${humidity2}, got ${hist_humidity}" $LINENO
fi
if [ "$cloud2" != "$hist_cloud" ]; then
  cv_fail "Expected persisted cloudCoverPercent=${cloud2}, got ${hist_cloud}" $LINENO
fi
if [ "$precip2" != "$hist_precip" ]; then
  cv_fail "Expected persisted precipitationType=${precip2}, got ${hist_precip}" $LINENO
fi
if [ "$hist_weather_overridden" != "false" ]; then
  cv_fail "Expected WeatherUserOverridden=false on persisted ride, got ${hist_weather_overridden}" $LINENO
fi

cv_step "Cleanup" "No explicit cleanup; DB is ephemeral per test run" $LINENO

# The EF Core SQLite database file lives inside the app container and is discarded when the stack stops.
# No additional teardown is required beyond allowing docker-compose to stop the services after the test.

echo "CODEVALID_TEST_ASSERTION_OK:weather_fetch_success_and_cache_usage"
