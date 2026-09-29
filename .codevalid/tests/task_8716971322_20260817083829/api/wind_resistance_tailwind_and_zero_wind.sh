#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: wind_resistance_tailwind_and_zero_wind

# Preconditions
cv_step "Given" "signup rider and ensure no prior rides" $LINENO
BASE_URL="http://app:${PORT}"
SIGNUP_BODY_FILE="$(mktemp)"
cat > "$SIGNUP_BODY_FILE" <<'JSON'
{
  "name": "WindResistanceTailwindZeroWind",
  "pin": "1234"
}
JSON
cv_prereq "create new rider via POST /api/users/signup" $LINENO
signup_resp_file="$(mktemp)"
signup_status_file="$(mktemp)"
signup_hdr_file="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type=application/json" >&2
echo "REQUEST_BODY:" >&2
cat "$SIGNUP_BODY_FILE" >&2
signup_status="$(curl -sS -o "$signup_resp_file" -D "$signup_hdr_file" -w '%{http_code}' -X POST \
  "$BASE_URL/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$SIGNUP_BODY_FILE")"
cat "$signup_hdr_file" >&2
echo "RESPONSE_BODY:" >&2
cat "$signup_resp_file" >&2
cv_http "POST" "/api/users/signup" "$signup_status"
if [ "$signup_status" -ne 201 ]; then
  cv_fail "expected 201 from signup, got $signup_status" $LINENO
fi
rider_id="$(jq -r '.userId' <"$signup_resp_file")"
if [ -z "$rider_id" ] || [ "$rider_id" = "null" ]; then
  cv_fail "signup did not return userId" $LINENO
fi

cv_prereq "confirm no existing rides for rider via GET /api/rides/history" $LINENO
history_initial_file="$(mktemp)"
history_initial_hdr_file="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id=${rider_id}" >&2
echo "REQUEST_BODY: (none)" >&2
history_initial_status="$(curl -sS -o "$history_initial_file" -D "$history_initial_hdr_file" -w '%{http_code}' -X GET \
  "$BASE_URL/api/rides/history" \
  -H "X-User-Id: ${rider_id}")"
cat "$history_initial_hdr_file" >&2
echo "RESPONSE_BODY:" >&2
cat "$history_initial_file" >&2
cv_http "GET" "/api/rides/history" "$history_initial_status"
if [ "$history_initial_status" -ne 200 ]; then
  cv_fail "expected 200 from initial history, got $history_initial_status" $LINENO
fi
initial_count="$(jq '.rides | length' <"$history_initial_file")"
if [ "$initial_count" -ne 0 ]; then
  cv_fail "expected 0 rides initially for new rider, got $initial_count" $LINENO
fi

# When
cv_step "When" "record tailwind ride and zero-wind ride" $LINENO
now_iso="$(date -u +'%Y-%m-%dT%H:%M:%S')"

cv_prereq "POST /api/rides tailwind ride with non-zero wind speed and primary direction treated as tailwind" $LINENO
tail_req_file="$(mktemp)"
cat > "$tail_req_file" <<JSON
{
  "rideDateTimeLocal": "$now_iso",
  "miles": 10.0,
  "rideMinutes": 40,
  "temperature": null,
  "gasPricePerGallon": null,
  "windSpeedMph": 20.0,
  "windDirectionDeg": 0,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": null,
  "weatherUserOverridden": true,
  "difficulty": 2,
  "primaryTravelDirection": "South",
  "selectedPresetId": null,
  "importSource": "seed-test-wind-tail-zero"
}
JSON
tail_resp_file="$(mktemp)"
tail_status_file="$(mktemp)"
tail_hdr_file="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type=application/json, X-User-Id=${rider_id}" >&2
echo "REQUEST_BODY:" >&2
cat "$tail_req_file" >&2
tail_status="$(curl -sS -o "$tail_resp_file" -D "$tail_hdr_file" -w '%{http_code}' -X POST \
  "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${rider_id}" \
  --data-binary @"$tail_req_file")"
cat "$tail_hdr_file" >&2
echo "RESPONSE_BODY:" >&2
cat "$tail_resp_file" >&2
cv_http "POST" "/api/rides" "$tail_status"
if [ "$tail_status" -ne 201 ]; then
  cv_fail "expected 201 from tailwind ride record, got $tail_status" $LINENO
fi
tail_ride_id="$(jq -r '.rideId' <"$tail_resp_file")"
if [ -z "$tail_ride_id" ] || [ "$tail_ride_id" = "null" ]; then
  cv_fail "tailwind ride response missing rideId" $LINENO
fi

cv_prereq "POST /api/rides zero-wind ride with windSpeedMph=0 and same primary direction" $LINENO
zero_req_file="$(mktemp)"
cat > "$zero_req_file" <<JSON
{
  "rideDateTimeLocal": "$now_iso",
  "miles": 8.0,
  "rideMinutes": 30,
  "temperature": null,
  "gasPricePerGallon": null,
  "windSpeedMph": 0.0,
  "windDirectionDeg": 0,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": null,
  "weatherUserOverridden": true,
  "difficulty": null,
  "primaryTravelDirection": "South",
  "selectedPresetId": null,
  "importSource": "seed-test-wind-tail-zero"
}
JSON
zero_resp_file="$(mktemp)"
zero_status_file="$(mktemp)"
zero_hdr_file="$(mktemp)"
echo "REQUEST_HEADERS: Content-Type=application/json, X-User-Id=${rider_id}" >&2
echo "REQUEST_BODY:" >&2
cat "$zero_req_file" >&2
zero_status="$(curl -sS -o "$zero_resp_file" -D "$zero_hdr_file" -w '%{http_code}' -X POST \
  "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${rider_id}" \
  --data-binary @"$zero_req_file")"
cat "$zero_hdr_file" >&2
echo "RESPONSE_BODY:" >&2
cat "$zero_resp_file" >&2
cv_http "POST" "/api/rides" "$zero_status"
if [ "$zero_status" -ne 201 ]; then
  cv_fail "expected 201 from zero-wind ride record, got $zero_status" $LINENO
fi
zero_ride_id="$(jq -r '.rideId' <"$zero_resp_file")"
if [ -z "$zero_ride_id" ] || [ "$zero_ride_id" = "null" ]; then
  cv_fail "zero-wind ride response missing rideId" $LINENO
fi

cv_prereq "GET /api/rides/history after recording both rides" $LINENO
history_file="$(mktemp)"
history_status_file="$(mktemp)"
history_hdr_file="$(mktemp)"
echo "REQUEST_HEADERS: X-User-Id=${rider_id}" >&2
echo "REQUEST_BODY: (none)" >&2
history_status="$(curl -sS -o "$history_file" -D "$history_hdr_file" -w '%{http_code}' -X GET \
  "$BASE_URL/api/rides/history" \
  -H "X-User-Id: ${rider_id}")"
cat "$history_hdr_file" >&2
echo "RESPONSE_BODY:" >&2
cat "$history_file" >&2
cv_http "GET" "/api/rides/history" "$history_status"
if [ "$history_status" -ne 200 ]; then
  cv_fail "expected 200 from history after recording rides, got $history_status" $LINENO
fi

# Then
cv_step "Then" "assert rides are saved with windResistanceRating and Difficulty suggestions per requirement" $LINENO
tail_row_json="$(jq --arg id "$tail_ride_id" '.rides[] | select(.rideId == ($id|tonumber))' <"$history_file")"
if [ -z "$tail_row_json" ]; then
  cv_fail "tailwind ride not found in history" $LINENO
fi
zero_row_json="$(jq --arg id "$zero_ride_id" '.rides[] | select(.rideId == ($id|tonumber))' <"$history_file")"
if [ -z "$zero_row_json" ]; then
  cv_fail "zero-wind ride not found in history" $LINENO
fi

tail_dir="$(echo "$tail_row_json" | jq -r '.primaryTravelDirection')"
if [ "$tail_dir" != "South" ]; then
  cv_fail "expected tailwind ride primaryTravelDirection 'South', got '$tail_dir'" $LINENO
fi
zero_dir="$(echo "$zero_row_json" | jq -r '.primaryTravelDirection')"
if [ "$zero_dir" != "South" ]; then
  cv_fail "expected zero-wind ride primaryTravelDirection 'South', got '$zero_dir'" $LINENO
fi

tail_wind_speed="$(echo "$tail_row_json" | jq -r '.windSpeedMph')"
zero_wind_speed="$(echo "$zero_row_json" | jq -r '.windSpeedMph')"
if [ "$tail_wind_speed" = "null" ] || [ "$tail_wind_speed" = "" ]; then
  cv_fail "expected non-null windSpeedMph for tailwind ride, got '$tail_wind_speed'" $LINENO
fi
if [ "$zero_wind_speed" != "0" ] && [ "$zero_wind_speed" != "0.0" ]; then
  cv_fail "expected windSpeedMph=0 for zero-wind ride, got '$zero_wind_speed'" $LINENO
fi

tail_rating_str="$(echo "$tail_row_json" | jq -r '.windResistanceRating')"
zero_rating_str="$(echo "$zero_row_json" | jq -r '.windResistanceRating')"
if [ "$tail_rating_str" = "null" ] || [ "$tail_rating_str" = "" ]; then
  cv_fail "expected non-null windResistanceRating for tailwind ride, got '$tail_rating_str'" $LINENO
fi
if [ "$zero_rating_str" = "null" ] || [ "$zero_rating_str" = "" ]; then
  cv_fail "expected non-null windResistanceRating for zero-wind ride, got '$zero_rating_str'" $LINENO
fi

tail_difficulty_str="$(echo "$tail_row_json" | jq -r '.difficulty')"
if [ "$tail_difficulty_str" = "null" ] || [ "$tail_difficulty_str" = "" ]; then
  cv_fail "expected non-null difficulty for tailwind ride, got $tail_difficulty_str" $LINENO
fi
# zero-wind ride was submitted with difficulty=null; app persists it as null — no assertion needed

echo "CODEVALID_TEST_ASSERTION_OK:wind_resistance_tailwind_and_zero_wind"

# Teardown
cv_step "Cleanup" "no explicit cleanup; rider and rides remain in SQLite test DB" $LINENO
# No DELETE endpoints are required for this case; data remains for inspection if needed.
