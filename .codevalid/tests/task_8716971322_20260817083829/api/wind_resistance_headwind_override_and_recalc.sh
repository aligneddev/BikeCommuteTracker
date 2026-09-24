#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: wind_resistance_headwind_override_and_recalc

# Mocks
# cv_step "Given" "No external vendor stubs needed; weatherUserOverridden=true and gas price omitted so POST /api/rides does not call Open-Meteo or EIA." $LINENO
# For this case, the RecordRideService is instructed not to fetch weather (WeatherUserOverridden=true),
# and we do not send gasPricePerGallon. As a result, POST /api/rides and PUT /api/rides/{id} will not
# call any external HTTP clients (EiaGasPrice or OpenMeteo). No WireMock case mappings are required.

# Preconditions
cv_step "Given" "Sign up a rider and capture userId for X-User-Id header; ensure no prior rides exist for this rider." $LINENO
BASE_URL="http://app:${PORT}"

# Sign up a new rider; UsersEndpoints expects name + pin fields (per previous workspace learnings).
SIGNUP_REQ_BODY="$(jq -n --arg name "WindDifficultyUser_$RANDOM" --arg pin "1234" '{name:$name, pin:$pin}')"
cv_prereq "POST /api/users/signup to create rider" $LINENO
SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_RESP_HEADERS="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$SIGNUP_REQ_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS="$(curl -sS -D "$SIGNUP_RESP_HEADERS" -o "$SIGNUP_RESP_FILE" -w '%{http_code}' -X POST \
  "$BASE_URL/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary "$SIGNUP_REQ_BODY")"

echo "RESPONSE_HEADERS:"
cat "$SIGNUP_RESP_HEADERS"
echo "RESPONSE_BODY:"
cat "$SIGNUP_RESP_FILE"

cv_http "POST" "/api/users/signup" "$HTTP_STATUS"
if [ "$HTTP_STATUS" -ne 201 ]; then
  cv_fail "Expected 201 from POST /api/users/signup, got $HTTP_STATUS" $LINENO
fi

USER_ID="$(jq -r '.userId // .UserId' < "$SIGNUP_RESP_FILE")"
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  cv_fail "Signup response did not contain userId field" $LINENO
fi

# Ensure the rider has no prior rides; GET /api/rides/history should return empty rides array.
HIST_RESP_FILE_PRE="$(mktemp)"
HIST_RESP_HEADERS_PRE="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS="$(curl -sS -D "$HIST_RESP_HEADERS_PRE" -o "$HIST_RESP_FILE_PRE" -w '%{http_code}' -X GET \
  "$BASE_URL/api/rides/history" \
  -H "X-User-Id: ${USER_ID}")"

echo "RESPONSE_HEADERS:"
cat "$HIST_RESP_HEADERS_PRE"
echo "RESPONSE_BODY:"
cat "$HIST_RESP_FILE_PRE"

cv_http "GET" "/api/rides/history" "$HTTP_STATUS"
if [ "$HTTP_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from initial GET /api/rides/history, got $HTTP_STATUS" $LINENO
fi
INITIAL_RIDE_COUNT="$(jq '.rides | length' < "$HIST_RESP_FILE_PRE")"
if [ "$INITIAL_RIDE_COUNT" -ne 0 ]; then
  cv_fail "Precondition violated: expected 0 rides for new user, found $INITIAL_RIDE_COUNT" $LINENO
fi

# When - record ride
cv_step "When" "Record a ride with North travel direction, 20 mph headwind, and rider-chosen Difficulty=2 via POST /api/rides." $LINENO

# Build RecordRideRequest JSON. Use current time for RideDateTimeLocal; Miles=8.0, RideMinutes=30.
NOW_ISO="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
RECORD_REQ_BODY="$(jq -n \
  --arg rideDateTimeLocal "$NOW_ISO" \
  --argjson miles 8.0 \
  --argjson rideMinutes 30 \
  --argjson windSpeedMph 20.0 \
  --argjson windDirectionDeg 0 \
  --argjson difficulty 2 \
  --arg primaryTravelDirection "North" \
  --argjson weatherUserOverridden true \
  '{
    rideDateTimeLocal: $rideDateTimeLocal
  , miles: $miles
  , rideMinutes: $rideMinutes
  , windSpeedMph: $windSpeedMph
  , windDirectionDeg: $windDirectionDeg
  , weatherUserOverridden: $weatherUserOverridden
  , primaryTravelDirection: $primaryTravelDirection
  , difficulty: $difficulty
  }')"

RECORD_RESP_FILE="$(mktemp)"
RECORD_RESP_HEADERS="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${USER_ID}"
REQUEST_BODY="$RECORD_REQ_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS="$(curl -sS -D "$RECORD_RESP_HEADERS" -o "$RECORD_RESP_FILE" -w '%{http_code}' -X POST \
  "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary "$RECORD_REQ_BODY")"

echo "RESPONSE_HEADERS:"
cat "$RECORD_RESP_HEADERS"
echo "RESPONSE_BODY:"
cat "$RECORD_RESP_FILE"

cv_http "POST" "/api/rides" "$HTTP_STATUS"
if [ "$HTTP_STATUS" -ne 201 ]; then
  cv_fail "Expected 201 from POST /api/rides, got $HTTP_STATUS" $LINENO
fi

RIDE_ID="$(jq -r '.rideId // .RideId' < "$RECORD_RESP_FILE")"
RIDER_ID_RESP="$(jq -r '.riderId // .RiderId' < "$RECORD_RESP_FILE")"
if [ -z "$RIDE_ID" ] || [ "$RIDE_ID" = "null" ]; then
  cv_fail "RecordRideSuccessResponse missing rideId" $LINENO
fi
if [ "$RIDER_ID_RESP" != "$USER_ID" ]; then
  cv_fail "RecordRideSuccessResponse RiderId ($RIDER_ID_RESP) does not match authenticated USER_ID ($USER_ID)" $LINENO
fi

cv_prereq "Fetch ride history and then edit the ride to change primary direction to South with Difficulty=3 via PUT /api/rides/{rideId}." $LINENO

# Fetch history after recording to assert initial WindResistanceRating and Difficulty.
HIST_RESP_FILE_AFTER_RECORD="$(mktemp)"
HIST_RESP_HEADERS_AFTER_RECORD="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS="$(curl -sS -D "$HIST_RESP_HEADERS_AFTER_RECORD" -o "$HIST_RESP_FILE_AFTER_RECORD" -w '%{http_code}' -X GET \
  "$BASE_URL/api/rides/history" \
  -H "X-User-Id: ${USER_ID}")"

echo "RESPONSE_HEADERS:"
cat "$HIST_RESP_HEADERS_AFTER_RECORD"
echo "RESPONSE_BODY:"
cat "$HIST_RESP_FILE_AFTER_RECORD"

cv_http "GET" "/api/rides/history" "$HTTP_STATUS"
if [ "$HTTP_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from GET /api/rides/history after record, got $HTTP_STATUS" $LINENO
fi

# Build EditRideRequest body: keep miles, minutes, wind data, WeatherUserOverridden=true; change PrimaryTravelDirection to South and Difficulty to 3.
EDIT_REQ_BODY="$(jq -n \
  --arg rideDateTimeLocal "$NOW_ISO" \
  --argjson miles 8.0 \
  --argjson rideMinutes 30 \
  --argjson expectedVersion 1 \
  --argjson windSpeedMph 20.0 \
  --argjson windDirectionDeg 0 \
  --argjson difficulty 3 \
  --arg primaryTravelDirection "South" \
  --argjson weatherUserOverridden true \
  '{
    rideDateTimeLocal: $rideDateTimeLocal
  , miles: $miles
  , rideMinutes: $rideMinutes
  , temperature: null
  , expectedVersion: $expectedVersion
  , windSpeedMph: $windSpeedMph
  , windDirectionDeg: $windDirectionDeg
  , weatherUserOverridden: $weatherUserOverridden
  , primaryTravelDirection: $primaryTravelDirection
  , difficulty: $difficulty
  }')"

EDIT_RESP_FILE="$(mktemp)"
EDIT_RESP_HEADERS="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${USER_ID}"
REQUEST_BODY="$EDIT_REQ_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS="$(curl -sS -D "$EDIT_RESP_HEADERS" -o "$EDIT_RESP_FILE" -w '%{http_code}' -X PUT \
  "$BASE_URL/api/rides/${RIDE_ID}" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${USER_ID}" \
  --data-binary "$EDIT_REQ_BODY")"

echo "RESPONSE_HEADERS:"
cat "$EDIT_RESP_HEADERS"
echo "RESPONSE_BODY:"
cat "$EDIT_RESP_FILE"

cv_http "PUT" "/api/rides/${RIDE_ID}" "$HTTP_STATUS"
if [ "$HTTP_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from PUT /api/rides/${RIDE_ID}, got $HTTP_STATUS" $LINENO
fi

HIST_RESP_FILE_AFTER_EDIT="$(mktemp)"
HIST_RESP_HEADERS_AFTER_EDIT="$(mktemp)"

REQUEST_HEADERS="X-User-Id: ${USER_ID}"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS="$(curl -sS -D "$HIST_RESP_HEADERS_AFTER_EDIT" -o "$HIST_RESP_FILE_AFTER_EDIT" -w '%{http_code}' -X GET \
  "$BASE_URL/api/rides/history" \
  -H "X-User-Id: ${USER_ID}")"

echo "RESPONSE_HEADERS:"
cat "$HIST_RESP_HEADERS_AFTER_EDIT"
echo "RESPONSE_BODY:"
cat "$HIST_RESP_FILE_AFTER_EDIT"

cv_http "GET" "/api/rides/history" "$HTTP_STATUS"
if [ "$HTTP_STATUS" -ne 200 ]; then
  cv_fail "Expected 200 from GET /api/rides/history after edit, got $HTTP_STATUS" $LINENO
fi

# Then
cv_step "Then" "Assert initial headwind rating (+4) with Difficulty=2, then tailwind rating (-4) with Difficulty=3 after direction change." $LINENO

# Assert initial ride row: primaryTravelDirection=North, windSpeedMph=20, windDirectionDeg=0, windResistanceRating=4, difficulty=2.
INITIAL_RIDE_JSON="$(jq -c --arg rid "$RIDE_ID" '.rides[] | select((.rideId|tostring) == $rid)' < "$HIST_RESP_FILE_AFTER_RECORD" || true)"
if [ -z "$INITIAL_RIDE_JSON" ]; then
  cv_fail "Initial history response did not contain rideId=${RIDE_ID}" $LINENO
fi

INIT_DIR="$(jq -r '.primaryTravelDirection' <<< "$INITIAL_RIDE_JSON")"
INIT_WIND_SPEED="$(jq -r '.windSpeedMph' <<< "$INITIAL_RIDE_JSON")"
INIT_WIND_DIR_DEG="$(jq -r '.windDirectionDeg' <<< "$INITIAL_RIDE_JSON")"
INIT_WIND_RESISTANCE="$(jq -r '.windResistanceRating' <<< "$INITIAL_RIDE_JSON")"
INIT_DIFFICULTY="$(jq -r '.difficulty' <<< "$INITIAL_RIDE_JSON")"

if [ "$INIT_DIR" != "North" ]; then
  cv_fail "Expected initial primaryTravelDirection 'North', got '$INIT_DIR'" $LINENO
fi
if [ "$INIT_WIND_SPEED" != "20" ] && [ "$INIT_WIND_SPEED" != "20.0" ]; then
  cv_fail "Expected initial windSpeedMph 20, got '$INIT_WIND_SPEED'" $LINENO
fi
if [ "$INIT_WIND_DIR_DEG" != "0" ]; then
  cv_fail "Expected initial windDirectionDeg 0, got '$INIT_WIND_DIR_DEG'" $LINENO
fi
if [ "$INIT_WIND_RESISTANCE" != "4" ]; then
  cv_fail "Expected initial WindResistanceRating 4 for North travel with 20 mph wind from 0°, got '$INIT_WIND_RESISTANCE'" $LINENO
fi
if [ "$INIT_DIFFICULTY" != "2" ]; then
  cv_fail "Expected initial Difficulty 2 (rider override), got '$INIT_DIFFICULTY'" $LINENO
fi

# Assert edited ride row: primaryTravelDirection=South, windSpeedMph=20, windDirectionDeg=0, windResistanceRating=-4, difficulty=3.
EDITED_RIDE_JSON="$(jq -c --arg rid "$RIDE_ID" '.rides[] | select((.rideId|tostring) == $rid)' < "$HIST_RESP_FILE_AFTER_EDIT" || true)"
if [ -z "$EDITED_RIDE_JSON" ]; then
  cv_fail "Edited history response did not contain rideId=${RIDE_ID}" $LINENO
fi

EDIT_DIR="$(jq -r '.primaryTravelDirection' <<< "$EDITED_RIDE_JSON")"
EDIT_WIND_SPEED="$(jq -r '.windSpeedMph' <<< "$EDITED_RIDE_JSON")"
EDIT_WIND_DIR_DEG="$(jq -r '.windDirectionDeg' <<< "$EDITED_RIDE_JSON")"
EDIT_WIND_RESISTANCE="$(jq -r '.windResistanceRating' <<< "$EDITED_RIDE_JSON")"
EDIT_DIFFICULTY="$(jq -r '.difficulty' <<< "$EDITED_RIDE_JSON")"

if [ "$EDIT_DIR" != "South" ]; then
  cv_fail "Expected edited primaryTravelDirection 'South', got '$EDIT_DIR'" $LINENO
fi
if [ "$EDIT_WIND_SPEED" != "20" ] && [ "$EDIT_WIND_SPEED" != "20.0" ]; then
  cv_fail "Expected edited windSpeedMph 20, got '$EDIT_WIND_SPEED'" $LINENO
fi
if [ "$EDIT_WIND_DIR_DEG" != "0" ]; then
  cv_fail "Expected edited windDirectionDeg 0, got '$EDIT_WIND_DIR_DEG'" $LINENO
fi
if [ "$EDIT_WIND_RESISTANCE" != "-4" ]; then
  cv_fail "Expected edited WindResistanceRating -4 for South travel with 20 mph wind from 0°, got '$EDIT_WIND_RESISTANCE'" $LINENO
fi
if [ "$EDIT_DIFFICULTY" != "3" ]; then
  cv_fail "Expected edited Difficulty 3 (rider override), got '$EDIT_DIFFICULTY'" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit cleanup endpoint for rides; leave created data in SQLite test database." $LINENO
# The efcore-sqlite infra prohibits direct DB access from seed-test; there is no DELETE /api/rides/{id} used in this case.
# Leaving the created ride and user rows in the test database is acceptable for isolated case runs.

echo "CODEVALID_TEST_ASSERTION_OK:wind_resistance_headwind_override_and_recalc"
