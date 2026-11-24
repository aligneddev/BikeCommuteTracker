#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
CASE_ID="api_65854899_4"
SUFFIX="$(date +%s%N)"

# Unique fixed location per run so no hourly lookup record exists yet for it.
FRAC=$(( (SUFFIX / 1000) % 9000 + 1000 ))
LAT="4${FRAC:0:1}.${FRAC:1:2}"
LON="-9${FRAC:3:1}.41"
LAT_RE="${LAT//./\\\\.}"
LON_RE="${LON//./\\\\.}"

# Historical ride time (> 92 days ago) -> app calls Open-Meteo /v1/archive.
RIDE_DATE="$(date -u -d '-150 days' +%Y-%m-%d)"
RIDE_LOCAL="${RIDE_DATE}T17:40:00"
STUB_ID=""
USER_ID=""
RIDE_ID=""

# Given
cv_step Given "Rider with configured fixed location exists and Open-Meteo archive is stubbed for that location and date" $LINENO
cv_prereq "Register Open-Meteo archive stub for lat=${LAT} lon=${LON} date=${RIDE_DATE}" $LINENO
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
        "time": ["${RIDE_DATE}T16:00", "${RIDE_DATE}T17:00", "${RIDE_DATE}T18:00"],
        "temperature_2m": [70.0, 68.25, 65.0],
        "wind_speed_10m": [4.0, 11.75, 6.0],
        "wind_direction_10m": [45, 315, 90],
        "relative_humidity_2m": [40, 58, 60],
        "cloud_cover": [10, 42, 80],
        "precipitation": [0.0, 0.0, 0.0],
        "snowfall": [0.0, 0.0, 0.0],
        "weather_code": [0, 2, 3]
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
cv_http POST /api/users/signup "{\"name\":\"wx-save-${SUFFIX}\",\"pin\":\"5678\"}" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || cv_fail "expected userId from signup got '${USER_ID}'" $LINENO
AUTH=(-H "X-User-Id: ${USER_ID}")

cv_prereq "Configure rider fixed location lat=${LAT} lon=${LON}" $LINENO
cv_http PUT /api/users/me/settings "{\"locationLabel\":\"Save Spot ${SUFFIX}\",\"latitude\":${LAT},\"longitude\":${LON},\"averageCarMpg\":30,\"yearlyGoalMiles\":1000,\"oilChangePrice\":50,\"mileageRateCents\":67}" 200 "${AUTH[@]}"

cv_prereq "Reset WireMock request journal" $LINENO
cv_http DELETE "${WIREMOCK_ADMIN_URL}/__admin/requests" 200

# When
cv_step When "Rider saves a new ride at ${RIDE_LOCAL} without loading weather first and with no weather fields" $LINENO
cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${RIDE_LOCAL}\",\"miles\":7.25,\"rideMinutes\":32,\"note\":\"auto weather ${SUFFIX}\"}" 201 "${AUTH[@]}"
RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')"
[ -n "$RIDE_ID" ] && [ "$RIDE_ID" != "null" ] || cv_fail "expected rideId from POST /api/rides got '${RIDE_ID}'" $LINENO

# Then
cv_step Then "Stored ride carries the weather for its ride time at the rider's configured location" $LINENO
cv_http GET /api/rides/history 200 "${AUTH[@]}"
ROW="$(printf '%s' "$CV_HTTP_BODY" | jq -c --arg id "$RIDE_ID" '.rides[] | select((.rideId|tostring) == $id)')"
[ -n "$ROW" ] || cv_fail "expected ride ${RIDE_ID} in history got none" $LINENO
printf '%s' "$ROW" | jq -e '.temperature == 68.25' >/dev/null || cv_fail "expected stored temperature 68.25 got $(printf '%s' "$ROW" | jq -r '.temperature')" $LINENO
printf '%s' "$ROW" | jq -e '.windSpeedMph == 11.75' >/dev/null || cv_fail "expected stored windSpeedMph 11.75 got $(printf '%s' "$ROW" | jq -r '.windSpeedMph')" $LINENO
printf '%s' "$ROW" | jq -e '.windDirectionDeg == 315' >/dev/null || cv_fail "expected stored windDirectionDeg 315 got $(printf '%s' "$ROW" | jq -r '.windDirectionDeg')" $LINENO
printf '%s' "$ROW" | jq -e '.relativeHumidityPercent == 58' >/dev/null || cv_fail "expected stored relativeHumidityPercent 58 got $(printf '%s' "$ROW" | jq -r '.relativeHumidityPercent')" $LINENO
printf '%s' "$ROW" | jq -e '.cloudCoverPercent == 42' >/dev/null || cv_fail "expected stored cloudCoverPercent 42 got $(printf '%s' "$ROW" | jq -r '.cloudCoverPercent')" $LINENO
printf '%s' "$ROW" | jq -e '.precipitationType == null' >/dev/null || cv_fail "expected stored precipitationType empty (no precipitation) got $(printf '%s' "$ROW" | jq -r '.precipitationType')" $LINENO

cv_prereq "Check the save looked up the provider with the rider's configured location and ride date" $LINENO
cv_http GET "${WIREMOCK_ADMIN_URL}/__admin/requests" 200
CALLS="$(printf '%s' "$CV_HTTP_BODY" | jq --arg lat "$LAT" --arg lon "$LON" --arg d "$RIDE_DATE" \
  '[.requests[] | select(.request.url | startswith("/v1/archive")) | select(.request.queryParams.latitude.values[0] | startswith($lat)) | select(.request.queryParams.longitude.values[0] | startswith($lon)) | select(.request.queryParams.start_date.values[0] == $d)] | length')"
[ "$CALLS" -ge 1 ] || cv_fail "expected >=1 Open-Meteo archive call for lat=${LAT} lon=${LON} date=${RIDE_DATE} got ${CALLS}" $LINENO

# Cleanup
cv_step Cleanup "Delete the ride, remove WireMock stub and clear rider location" $LINENO
cv_http DELETE "/api/rides/${RIDE_ID}" "${AUTH[@]}"
cv_http DELETE "${WIREMOCK_ADMIN_URL}/__admin/mappings/${STUB_ID}"
cv_http PUT /api/users/me/settings '{"locationLabel":null,"latitude":null,"longitude":null}' "${AUTH[@]}"

echo "CODEVALID_TEST_ASSERTION_OK:api_65854899_4"
