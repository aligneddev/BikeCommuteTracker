#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_step Given "Bootstrap rider, settings, and vendor failure stubs for weather_fetch_failure_manual_weather" $LINENO

# Case mappings
# | case_id                           | method | path               | purpose
# |-----------------------------------|--------|--------------------|-----------------------------------------------|
# | weather_fetch_failure_manual_weather | GET    | /api/rides/weather | Simulate vendor failure then manual weather |
# | weather_fetch_failure_manual_weather | POST   | /api/rides         | Record ride with manual weather snapshot    |
# | weather_fetch_failure_manual_weather | GET    | /api/rides/history | Assert persisted manual weather snapshot    |

# Case: weather_fetch_failure_manual_weather

### Mocks

cv_prereq "Configure WireMock stubs to make Open-Meteo forecast and archive calls fail for all requests" $LINENO

CASE_DIR=".codevalid/wiremock/mappings/cases/weather_fetch_failure_manual_weather"
mkdir -p "$CASE_DIR"

cat > "$CASE_DIR/open-meteo-forecast-failure.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v1/forecast",
    "queryParameters": {
      "latitude": {
        "matches": "40\\.71.*"
      },
      "longitude": {
        "matches": "-74\\.01.*"
      }
    }
  },
  "response": {
    "status": 500,
    "jsonBody": {
      "error": "simulated forecast failure for case weather_fetch_failure_manual_weather"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

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
      }
    }
  },
  "response": {
    "status": 500,
    "jsonBody": {
      "error": "simulated archive failure for case weather_fetch_failure_manual_weather"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

### Preconditions

cv_prereq "Signup rider and set UserSettings with lat/lon to enable weather lookup" $LINENO

API_BASE="http://app:${PORT}"

# Signup a new rider
SIGNUP_BODY='{"name":"WeatherFailureManualWeather-'"$(date +%s)"'","pin":"1234"}'
SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type: application/json" >&2
echo "REQUEST_BODY: $SIGNUP_BODY" >&2
code="$(curl -sS -o "$SIGNUP_RESP_FILE" -w '%{http_code}' -D "$SIGNUP_HDR_FILE" -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary "$SIGNUP_BODY" || echo "000")"
cat "$SIGNUP_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$SIGNUP_RESP_FILE")" >&2
cv_http POST "${API_BASE}/api/users/signup" "$code"
[ "$code" = "201" ] || cv_fail "Signup request failed, expected 201 got $code" $LINENO

RIDER_ID="$(jq -r '.userId' < "$SIGNUP_RESP_FILE")"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "Failed to extract riderId from signup response" $LINENO
fi

# Configure user settings with latitude/longitude so weather lookup is attempted.
SETTINGS_BODY=$(cat <<JSON
{
  "averageCarMpg": 30.0,
  "yearlyGoalMiles": 1000.0,
  "oilChangePrice": 60.0,
  "mileageRateCents": 58.5,
  "locationLabel": "Test Location",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "eiaGasApiKey": null,
  "weatherApiKey": null
}
JSON
)

SETTINGS_RESP_FILE="$(mktemp)"
SETTINGS_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type: application/json; X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: $SETTINGS_BODY" >&2
code="$(curl -sS -o "$SETTINGS_RESP_FILE" -w '%{http_code}' -D "$SETTINGS_HDR_FILE" -X PUT "${API_BASE}/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary "$SETTINGS_BODY" || echo "000")"
cat "$SETTINGS_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$SETTINGS_RESP_FILE")" >&2
cv_http PUT "${API_BASE}/api/users/me/settings" "$code"
[ "$code" = "200" ] || cv_fail "Settings update failed, expected 200 got $code" $LINENO

# Choose a recent rideDateTimeLocal (current time truncated to minutes)
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M')"
RIDE_DATETIME_LOCAL="${NOW_ISO}"

### When

cv_step When "Call /api/rides/weather which fails vendor lookup, then record ride with manual weather fields" $LINENO

# 1) Attempt to load weather for the ride timestamp (vendor failure → isAvailable=false, no fields)
WEATHER_RESP_FILE="$(mktemp)"
WEATHER_HDR_FILE="$(mktemp)"
WEATHER_URL="${API_BASE}/api/rides/weather?rideDateTimeLocal=$(printf '%s' "$RIDE_DATETIME_LOCAL" | jq -sRr @uri)"
echo "REQUEST_HEADERS: X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
WEATHER_STATUS="$(curl -sS -o "$WEATHER_RESP_FILE" -w '%{http_code}' -D "$WEATHER_HDR_FILE" \
  "$WEATHER_URL" \
  -H "X-User-Id: ${RIDER_ID}" || echo "000")"
cat "$WEATHER_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$WEATHER_RESP_FILE")" >&2
cv_http GET "${API_BASE}/api/rides/weather" "$WEATHER_STATUS"

# 2) Record ride with manual weather fields and WeatherUserOverridden=true
MANUAL_TEMP="55.5"
MANUAL_WIND_SPEED="15.0"
MANUAL_WIND_DIR="90"
MANUAL_HUMIDITY="45"
MANUAL_CLOUD="25"
MANUAL_PRECIP="rain"

RECORD_BODY=$(cat <<JSON
{
  "rideDateTimeLocal": "${RIDE_DATETIME_LOCAL}:00",
  "miles": 10.5,
  "rideMinutes": 40,
  "temperature": ${MANUAL_TEMP},
  "gasPricePerGallon": null,
  "windSpeedMph": ${MANUAL_WIND_SPEED},
  "windDirectionDeg": ${MANUAL_WIND_DIR},
  "relativeHumidityPercent": ${MANUAL_HUMIDITY},
  "cloudCoverPercent": ${MANUAL_CLOUD},
  "precipitationType": "${MANUAL_PRECIP}",
  "note": "Manual weather after vendor failure",
  "weatherUserOverridden": true,
  "difficulty": null,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "test-weather-failure-manual"
}
JSON
)

RECORD_RESP_FILE="$(mktemp)"
RECORD_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type: application/json; X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: $RECORD_BODY" >&2
RECORD_STATUS="$(curl -sS -o "$RECORD_RESP_FILE" -w '%{http_code}' -D "$RECORD_HDR_FILE" \
  -X POST "${API_BASE}/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary "$RECORD_BODY" || echo "000")"
cat "$RECORD_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$RECORD_RESP_FILE")" >&2
cv_http POST "${API_BASE}/api/rides" "$RECORD_STATUS"

### Then

cv_step Then "Assert weather load reported unavailable, and ride history shows manual weather fields persisted unchanged" $LINENO

# Assert /api/rides/weather response: 200, isAvailable=false, all nullable weather fields null
if [ "$WEATHER_STATUS" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/weather got ${WEATHER_STATUS}" $LINENO
fi

WEATHER_AVAILABLE="$(jq -r '.isAvailable' < "$WEATHER_RESP_FILE")"
if [ "$WEATHER_AVAILABLE" != "false" ]; then
  cv_fail "Expected isAvailable=false in weather response got ${WEATHER_AVAILABLE}" $LINENO
fi

for field in temperature windSpeedMph windDirectionDeg relativeHumidityPercent cloudCoverPercent precipitationType; do
  val="$(jq -r ".${field}" < "$WEATHER_RESP_FILE")"
  if [ "$val" != "null" ]; then
    cv_fail "Expected ${field}=null in weather response when vendor fails got ${val}" $LINENO
  fi
done

# Assert POST /api/rides succeeded with 201 and returned a positive rideId for this rider
if [ "$RECORD_STATUS" != "201" ]; then
  cv_fail "Expected 201 from POST /api/rides got ${RECORD_STATUS}" $LINENO
fi

REC_RIDE_ID="$(jq -r '.rideId' < "$RECORD_RESP_FILE")"
REC_RIDER_ID="$(jq -r '.riderId' < "$RECORD_RESP_FILE")"
if [ -z "$REC_RIDE_ID" ] || [ "$REC_RIDE_ID" = "null" ]; then
  cv_fail "Missing rideId in record ride response" $LINENO
fi
if [ "$REC_RIDER_ID" != "$RIDER_ID" ]; then
  cv_fail "Expected riderId ${RIDER_ID} in record ride response got ${REC_RIDER_ID}" $LINENO
fi

# Fetch history and locate the recorded ride
HISTORY_RESP_FILE="$(mktemp)"
HISTORY_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
HISTORY_STATUS="$(curl -sS -o "$HISTORY_RESP_FILE" -w '%{http_code}' -D "$HISTORY_HDR_FILE" \
  "${API_BASE}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}" || echo "000")"
cat "$HISTORY_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$HISTORY_RESP_FILE")" >&2
cv_http GET "${API_BASE}/api/rides/history" "$HISTORY_STATUS"

if [ "$HISTORY_STATUS" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/history got ${HISTORY_STATUS}" $LINENO
fi

# Extract the ride row by id
RIDE_JSON="$(jq -c --argjson id "$REC_RIDE_ID" '.rides[] | select(.rideId == $id)' < "$HISTORY_RESP_FILE")"
if [ -z "$RIDE_JSON" ]; then
  cv_fail "Recorded ride ${REC_RIDE_ID} not found in history" $LINENO
fi

# Numeric comparisons via awk to avoid formatting issues
ride_temp="$(printf '%s' "$RIDE_JSON" | jq -r '.temperature')"
ride_wind_speed="$(printf '%s' "$RIDE_JSON" | jq -r '.windSpeedMph')"
ride_wind_dir="$(printf '%s' "$RIDE_JSON" | jq -r '.windDirectionDeg')"
ride_humidity="$(printf '%s' "$RIDE_JSON" | jq -r '.relativeHumidityPercent')"
ride_cloud="$(printf '%s' "$RIDE_JSON" | jq -r '.cloudCoverPercent')"
ride_precip="$(printf '%s' "$RIDE_JSON" | jq -r '.precipitationType')"
ride_overridden="$(printf '%s' "$RIDE_JSON" | jq -r '.weatherUserOverridden')"

awk "BEGIN{if ($ride_temp != $MANUAL_TEMP) exit 1}" || cv_fail "temperature mismatch: expected ${MANUAL_TEMP} got ${ride_temp}" $LINENO
awk "BEGIN{if ($ride_wind_speed != $MANUAL_WIND_SPEED) exit 1}" || cv_fail "windSpeedMph mismatch: expected ${MANUAL_WIND_SPEED} got ${ride_wind_speed}" $LINENO
awk "BEGIN{if ($ride_wind_dir != $MANUAL_WIND_DIR) exit 1}" || cv_fail "windDirectionDeg mismatch: expected ${MANUAL_WIND_DIR} got ${ride_wind_dir}" $LINENO
awk "BEGIN{if ($ride_humidity != $MANUAL_HUMIDITY) exit 1}" || cv_fail "relativeHumidityPercent mismatch: expected ${MANUAL_HUMIDITY} got ${ride_humidity}" $LINENO
awk "BEGIN{if ($ride_cloud != $MANUAL_CLOUD) exit 1}" || cv_fail "cloudCoverPercent mismatch: expected ${MANUAL_CLOUD} got ${ride_cloud}" $LINENO

if [ "$ride_precip" != "$MANUAL_PRECIP" ]; then
  cv_fail "precipitationType mismatch: expected ${MANUAL_PRECIP} got ${ride_precip}" $LINENO
fi
if [ "$ride_overridden" != "true" ]; then
  cv_fail "Expected weatherUserOverridden=true on persisted ride got ${ride_overridden}" $LINENO
fi

# Call /api/rides/weather again for the same timestamp; it should still report unavailable and not affect saved snapshot
SECOND_WEATHER_RESP_FILE="$(mktemp)"
SECOND_WEATHER_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
SECOND_WEATHER_STATUS="$(curl -sS -o "$SECOND_WEATHER_RESP_FILE" -w '%{http_code}' -D "$SECOND_WEATHER_HDR_FILE" \
  "$WEATHER_URL" \
  -H "X-User-Id: ${RIDER_ID}" || echo "000")"
cat "$SECOND_WEATHER_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$SECOND_WEATHER_RESP_FILE")" >&2
cv_http GET "${API_BASE}/api/rides/weather" "$SECOND_WEATHER_STATUS"

if [ "$SECOND_WEATHER_STATUS" != "200" ]; then
  cv_fail "Expected 200 from second GET /api/rides/weather got ${SECOND_WEATHER_STATUS}" $LINENO
fi

SECOND_AVAILABLE="$(jq -r '.isAvailable' < "$SECOND_WEATHER_RESP_FILE")"
if [ "$SECOND_AVAILABLE" != "false" ]; then
  cv_fail "Expected isAvailable=false on second weather load got ${SECOND_AVAILABLE}" $LINENO
fi

for field in temperature windSpeedMph windDirectionDeg relativeHumidityPercent cloudCoverPercent precipitationType; do
  val="$(jq -r ".${field}" < "$SECOND_WEATHER_RESP_FILE")"
  if [ "$val" != "null" ]; then
    cv_fail "Expected ${field}=null on second weather load when vendor still failing got ${val}" $LINENO
  fi
done

# Re-read history to confirm snapshot still matches manual values (no overwrite by later automatic fetches)
HISTORY2_RESP_FILE="$(mktemp)"
HISTORY2_HDR_FILE="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
HISTORY2_STATUS="$(curl -sS -o "$HISTORY2_RESP_FILE" -w '%{http_code}' -D "$HISTORY2_HDR_FILE" \
  "${API_BASE}/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}" || echo "000")"
cat "$HISTORY2_HDR_FILE" >&2
echo "RESPONSE_BODY: $(cat "$HISTORY2_RESP_FILE")" >&2
cv_http GET "${API_BASE}/api/rides/history" "$HISTORY2_STATUS"

if [ "$HISTORY2_STATUS" != "200" ]; then
  cv_fail "Expected 200 from second GET /api/rides/history got ${HISTORY2_STATUS}" $LINENO
fi

RIDE2_JSON="$(jq -c --argjson id "$REC_RIDE_ID" '.rides[] | select(.rideId == $id)' < "$HISTORY2_RESP_FILE")"
if [ -z "$RIDE2_JSON" ]; then
  cv_fail "Recorded ride ${REC_RIDE_ID} not found in second history fetch" $LINENO
fi

ride2_temp="$(printf '%s' "$RIDE2_JSON" | jq -r '.temperature')"
ride2_wind_speed="$(printf '%s' "$RIDE2_JSON" | jq -r '.windSpeedMph')"
ride2_wind_dir="$(printf '%s' "$RIDE2_JSON" | jq -r '.windDirectionDeg')"
ride2_humidity="$(printf '%s' "$RIDE2_JSON" | jq -r '.relativeHumidityPercent')"
ride2_cloud="$(printf '%s' "$RIDE2_JSON" | jq -r '.cloudCoverPercent')"
ride2_precip="$(printf '%s' "$RIDE2_JSON" | jq -r '.precipitationType')"
ride2_overridden="$(printf '%s' "$RIDE2_JSON" | jq -r '.weatherUserOverridden')"

awk "BEGIN{if ($ride2_temp != $MANUAL_TEMP) exit 1}" || cv_fail "temperature changed after second weather load; expected ${MANUAL_TEMP} got ${ride2_temp}" $LINENO
awk "BEGIN{if ($ride2_wind_speed != $MANUAL_WIND_SPEED) exit 1}" || cv_fail "windSpeedMph changed after second weather load; expected ${MANUAL_WIND_SPEED} got ${ride2_wind_speed}" $LINENO
awk "BEGIN{if ($ride2_wind_dir != $MANUAL_WIND_DIR) exit 1}" || cv_fail "windDirectionDeg changed after second weather load; expected ${MANUAL_WIND_DIR} got ${ride2_wind_dir}" $LINENO
awk "BEGIN{if ($ride2_humidity != $MANUAL_HUMIDITY) exit 1}" || cv_fail "relativeHumidityPercent changed after second weather load; expected ${MANUAL_HUMIDITY} got ${ride2_humidity}" $LINENO
awk "BEGIN{if ($ride2_cloud != $MANUAL_CLOUD) exit 1}" || cv_fail "cloudCoverPercent changed after second weather load; expected ${MANUAL_CLOUD} got ${ride2_cloud}" $LINENO

if [ "$ride2_precip" != "$MANUAL_PRECIP" ]; then
  cv_fail "precipitationType changed after second weather load; expected ${MANUAL_PRECIP} got ${ride2_precip}" $LINENO
fi
if [ "$ride2_overridden" != "true" ]; then
  cv_fail "weatherUserOverridden should remain true after second weather load got ${ride2_overridden}" $LINENO
fi

### Teardown

cv_step Cleanup "No explicit teardown; rider and rides remain in SQLite test database" $LINENO

echo "CODEVALID_TEST_ASSERTION_OK:weather_fetch_failure_manual_weather"
