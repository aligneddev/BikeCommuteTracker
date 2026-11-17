#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
CASE_ID="api_65854899_1"
SUFFIX="$(date +%s%N)"

# Unique fixed location per run so the hourly lookup record (hour + rounded lat/lon) is new.
LAT_FRAC=$(( (SUFFIX / 1000) % 9000 + 1000 ))          # 1000..9999
LAT="3${LAT_FRAC:0:1}.${LAT_FRAC:1:2}"                  # e.g. 34.56
LON="-8${LAT_FRAC:3:1}.37"
LAT_RE="${LAT//./\\\\.}"
LON_RE="${LON//./\\\\.}"

# Historical ride time (> 92 days before today) -> app calls Open-Meteo /v1/archive.
RIDE_DATE="$(date -u -d '-200 days' +%Y-%m-%d)"
RIDE_LOCAL="${RIDE_DATE}T08:20:00"
STUB_ID=""
USER_ID=""

# Given
cv_step Given "Rider with configured fixed location exists and Open-Meteo archive is stubbed for that location and date" $LINENO
cv_prereq "Register Open-Meteo archive stub in WireMock for lat=${LAT} lon=${LON} date=${RIDE_DATE}" $LINENO
STUB_JSON=$(cat <<JSON
{
  "priority": 1,
  "request": {
    "method": "GET",
    "urlPath": "/v1/archive",
    "queryParameters": {
      "latitude": { "matches": "${LAT_RE}0*" },
      "longitude": { "matches": "${LON_RE}0*" },
      "start_date": { "equalTo": "${RIDE_DATE}" },
      "end_date": { "equalTo": "${RIDE_DATE}" }
    }
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "hourly": {
        "time": ["${RIDE_DATE}T07:00", "${RIDE_DATE}T08:00", "${RIDE_DATE}T09:00"],
        "temperature_2m": [40.0, 52.5, 60.0],
        "wind_speed_10m": [3.0, 9.5, 15.0],
        "wind_direction_10m": [10, 225, 300],
        "relative_humidity_2m": [30, 77, 90],
        "cloud_cover": [5, 64, 95],
        "precipitation": [0.0, 0.4, 0.0],
        "snowfall": [0.0, 0.0, 0.0],
        "weather_code": [0, 61, 0]
      }
    }
  }
}
JSON
)
cv_http POST "${WIREMOCK_ADMIN_URL}/__admin/mappings" "$STUB_JSON" 201
STUB_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.id')"
[ -n "$STUB_ID" ] && [ "$STUB_ID" != "null" ] || cv_fail "expected WireMock stub id got '${STUB_ID}'" $LINENO

cv_prereq "Sign up rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"wx-preview-${SUFFIX}\",\"pin\":\"4321\"}" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || cv_fail "expected userId from signup got '${USER_ID}'" $LINENO
AUTH=(-H "X-User-Id: ${USER_ID}")

cv_prereq "Configure rider fixed location lat=${LAT} lon=${LON}" $LINENO
cv_http PUT /api/users/me/settings "{\"locationLabel\":\"Test Spot ${SUFFIX}\",\"latitude\":${LAT},\"longitude\":${LON},\"averageCarMpg\":30,\"yearlyGoalMiles\":1000,\"oilChangePrice\":50,\"mileageRateCents\":67}" 200 "${AUTH[@]}"

cv_prereq "Reset WireMock request journal" $LINENO
cv_http DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" 200

# When
cv_step When "Rider requests weather from the create form for ride time ${RIDE_LOCAL}" $LINENO
cv_http GET "/api/rides/weather?rideDateTimeLocal=${RIDE_LOCAL}" 200 "${AUTH[@]}"
WX="$CV_HTTP_BODY"

# Then
cv_step Then "Response carries the provider's weather values for the configured location and nothing is saved on a ride" $LINENO
[ "$(printf '%s' "$WX" | jq -r '.isAvailable')" = "true" ] || cv_fail "expected isAvailable=true got $(printf '%s' "$WX" | jq -c .)" $LINENO
printf '%s' "$WX" | jq -e '.temperature == 52.5' >/dev/null || cv_fail "expected temperature 52.5 got $(printf '%s' "$WX" | jq -r '.temperature')" $LINENO
printf '%s' "$WX" | jq -e '.windSpeedMph == 9.5' >/dev/null || cv_fail "expected windSpeedMph 9.5 got $(printf '%s' "$WX" | jq -r '.windSpeedMph')" $LINENO
printf '%s' "$WX" | jq -e '.windDirectionDeg == 225' >/dev/null || cv_fail "expected windDirectionDeg 225 got $(printf '%s' "$WX" | jq -r '.windDirectionDeg')" $LINENO
printf '%s' "$WX" | jq -e '.relativeHumidityPercent == 77' >/dev/null || cv_fail "expected relativeHumidityPercent 77 got $(printf '%s' "$WX" | jq -r '.relativeHumidityPercent')" $LINENO
printf '%s' "$WX" | jq -e '.cloudCoverPercent == 64' >/dev/null || cv_fail "expected cloudCoverPercent 64 got $(printf '%s' "$WX" | jq -r '.cloudCoverPercent')" $LINENO
printf '%s' "$WX" | jq -e '.precipitationType == "rain"' >/dev/null || cv_fail "expected precipitationType rain got $(printf '%s' "$WX" | jq -r '.precipitationType')" $LINENO

cv_prereq "Check provider was called server-side with the rider's configured location" $LINENO
cv_http GET "${WIREMOCK_ADMIN_URL}/__admin/requests" 200
CALLS="$(printf '%s' "$CV_HTTP_BODY" | jq --arg lat "$LAT" --arg lon "$LON" \
  '[.requests[] | select(.request.url | startswith("/v1/archive")) | select(.request.queryParams.latitude.values[0] | startswith($lat)) | select(.request.queryParams.longitude.values[0] | startswith($lon))] | length')"
[ "$CALLS" -ge 1 ] || cv_fail "expected >=1 Open-Meteo archive call for lat=${LAT} lon=${LON} got ${CALLS}" $LINENO

cv_prereq "Ride history must still be empty: preview persists nothing" $LINENO
cv_http GET /api/rides/history 200 "${AUTH[@]}"
ROWS="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.totalRows')"
COUNT="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rides | length')"
[ "$ROWS" = "0" ] && [ "$COUNT" = "0" ] || cv_fail "expected no rides before save got totalRows=${ROWS} rides=${COUNT}" $LINENO

# Cleanup
cv_step Cleanup "Remove WireMock stub and clear rider location (no rides were created)" $LINENO
cv_http DELETE "${WIREMOCK_ADMIN_URL}/__admin/mappings/${STUB_ID}"
cv_http PUT /api/users/me/settings '{"locationLabel":null,"latitude":null,"longitude":null}' "${AUTH[@]}"

echo "CODEVALID_TEST_ASSERTION_OK:api_65854899_1"
