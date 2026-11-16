#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case api_22670402_1: Rider imports a valid CSV (Date, Miles, Time, Temp, Tags, Notes,
# Difficulty, Direction) -> preview -> confirm -> one ride per row in history, every value
# stored and direction normalized to a compass abbreviation.
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="CsvImport${SUFFIX: -12}"
RIDER_PIN="4826"
CREATED_RIDE_IDS=""

# Given
cv_step Given "a signed-up rider and a valid 3-row CSV with every supported column using the Direction alias" $LINENO
cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$RIDER_ID" ] && [ "$RIDER_ID" != "null" ] || cv_fail "expected userId from signup got '$RIDER_ID'" $LINENO
AUTH=(-H "X-User-Id: $RIDER_ID")

CSV_CONTENT=$'Date,Miles,Time,Temp,Tags,Notes,Difficulty,Direction\n'
CSV_CONTENT+=$'2025-03-03,12.5,45,38,"commute;morning","Morning commute ride",3,East\n'
CSV_CONTENT+=$'03/04/2025,8.25,1:30,41,errand,Grocery run,1,nw\n'
CSV_CONTENT+=$'05-Mar-2025,20,60,35,"long, weekend",Windy day,5,South\n'
CSV_B64="$(printf '%s' "$CSV_CONTENT" | base64 | tr -d '\n')"
PREVIEW_BODY="$(jq -nc --arg f "rides-${SUFFIX}.csv" --arg c "$CSV_B64" '{fileName:$f,contentBase64:$c}')"

cv_prereq "upload CSV for preview" $LINENO
cv_http POST /api/imports/preview "$PREVIEW_BODY" 200 "${AUTH[@]}"
PREVIEW="$CV_HTTP_BODY"
JOB_ID="$(printf '%s' "$PREVIEW" | jq -r '.importJobId')"
[ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ] || cv_fail "expected importJobId in preview got '$JOB_ID'" $LINENO
TOTAL="$(printf '%s' "$PREVIEW" | jq -r '.totalRows')"
VALID="$(printf '%s' "$PREVIEW" | jq -r '.validRows')"
[ "$TOTAL" = "3" ] || cv_fail "expected preview totalRows 3 got $TOTAL" $LINENO
[ "$VALID" = "3" ] || cv_fail "expected preview validRows 3 got $VALID: $(printf '%s' "$PREVIEW" | jq -c '[.rows[].errors]')" $LINENO
SAMPLE_ROWS="$(printf '%s' "$PREVIEW" | jq -r '.rows | length')"
[ "$SAMPLE_ROWS" -ge 1 ] || cv_fail "expected sample rows in preview got $SAMPLE_ROWS" $LINENO
PREVIEW_TAGS="$(printf '%s' "$PREVIEW" | jq -r '.rows[] | select(.rowNumber==1) | .tags')"
[ "$PREVIEW_TAGS" = "commute;morning" ] || cv_fail "expected preview row 1 tags 'commute;morning' got '$PREVIEW_TAGS'" $LINENO

# When
cv_step When "rider confirms the previewed import" $LINENO
cv_http POST /api/imports/start "$(jq -nc --argjson j "$JOB_ID" '{importJobId:$j,overrideAllDuplicates:false,resolutions:[]}')" 202 "${AUTH[@]}"

# Then
cv_step Then "import completes and history has one ride per row with every value stored and direction normalized" $LINENO
STATUS=""
for _ in $(seq 1 40); do
  cv_http GET "/api/imports/${JOB_ID}/status" "" 200 "${AUTH[@]}"
  STATUS="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.status')"
  case "$STATUS" in completed|failed|cancelled) break ;; esac
  sleep 0.5
done
[ "$STATUS" = "completed" ] || cv_fail "expected import status completed got '$STATUS'" $LINENO
IMPORTED="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.importedRows')"
[ "$IMPORTED" = "3" ] || cv_fail "expected importedRows 3 got $IMPORTED" $LINENO

cv_http GET "/api/rides/history?page=1&pageSize=50" "" 200 "${AUTH[@]}"
HISTORY="$CV_HTTP_BODY"
CREATED_RIDE_IDS="$(printf '%s' "$HISTORY" | jq -r '.rides[].rideId' | tr '\n' ' ')"
COUNT="$(printf '%s' "$HISTORY" | jq -r '.rides | length')"
[ "$COUNT" = "3" ] || cv_fail "expected 3 rides in rider history got $COUNT" $LINENO

check_ride() {
  local date="$1" miles="$2" minutes="$3" temp="$4" note="$5" diff="$6" dir="$7" line="$8" ride
  ride="$(printf '%s' "$HISTORY" | jq -c --arg d "$date" '[.rides[] | select(.rideDateTimeLocal | startswith($d))] | first')"
  [ "$ride" != "null" ] || cv_fail "expected a ride dated $date in history got none" "$line"
  [ "$(printf '%s' "$ride" | jq -r '.miles == ('"$miles"')')" = "true" ] || cv_fail "expected miles $miles for $date got $(printf '%s' "$ride" | jq -r '.miles')" "$line"
  [ "$(printf '%s' "$ride" | jq -r '.rideMinutes')" = "$minutes" ] || cv_fail "expected rideMinutes $minutes for $date got $(printf '%s' "$ride" | jq -r '.rideMinutes')" "$line"
  [ "$(printf '%s' "$ride" | jq -r '.temperature == ('"$temp"')')" = "true" ] || cv_fail "expected temperature $temp for $date got $(printf '%s' "$ride" | jq -r '.temperature')" "$line"
  [ "$(printf '%s' "$ride" | jq -r '.note')" = "$note" ] || cv_fail "expected note '$note' for $date got '$(printf '%s' "$ride" | jq -r '.note')'" "$line"
  [ "$(printf '%s' "$ride" | jq -r '.difficulty')" = "$diff" ] || cv_fail "expected difficulty $diff for $date got $(printf '%s' "$ride" | jq -r '.difficulty')" "$line"
  [ "$(printf '%s' "$ride" | jq -r '.primaryTravelDirection')" = "$dir" ] || cv_fail "expected normalized direction '$dir' for $date got '$(printf '%s' "$ride" | jq -r '.primaryTravelDirection')'" "$line"
}
check_ride 2025-03-03 12.5 45 38 "Morning commute ride" 3 E $LINENO
check_ride 2025-03-04 8.25 90 41 "Grocery run" 1 NW $LINENO
check_ride 2025-03-05 20 60 35 "Windy day" 5 S $LINENO

# Cleanup
cv_step Cleanup "delete the imported rides" $LINENO
if [ -z "$CREATED_RIDE_IDS" ] && [ -n "${RIDER_ID:-}" ]; then
  cv_http GET "/api/rides/history?page=1&pageSize=50" "" "" -H "X-User-Id: $RIDER_ID"
  CREATED_RIDE_IDS="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rides[]?.rideId' 2>/dev/null | tr '\n' ' ' || true)"
fi
for rid in $CREATED_RIDE_IDS; do
  cv_http DELETE "/api/rides/${rid}" "" -H "X-User-Id: $RIDER_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_22670402_1"
