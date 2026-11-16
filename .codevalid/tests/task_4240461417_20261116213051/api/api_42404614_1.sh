#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case: api_42404614_1 - Rider edits and saves own ride
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="EditRider${SUFFIX}"
RIDER_PIN="4821"
TODAY="$(date -u +%Y-%m-%d)"
ORIG_DT="${TODAY}T07:00:00"
EDIT_DT="${TODAY}T08:30:00"

# Given
cv_step Given "Register a rider, log in and record one ride to edit" $LINENO
cv_prereq "Sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 201
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[[ "$RIDER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId from signup got '${RIDER_ID}'" $LINENO

cv_prereq "Identify rider" $LINENO
cv_http POST /api/users/identify "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 200

cv_prereq "Record original ride (5 miles, North, tailwind)" $LINENO
ORIG_BODY=$(jq -nc --arg dt "$ORIG_DT" '{
  rideDateTimeLocal: $dt, miles: 5.0, rideMinutes: 25, temperature: 50,
  gasPricePerGallon: 3.10, windSpeedMph: 20, windDirectionDeg: 180,
  relativeHumidityPercent: 40, cloudCoverPercent: 10, precipitationType: "none",
  note: "original note", weatherUserOverridden: true, difficulty: 2,
  primaryTravelDirection: "North"
}')
cv_http POST /api/rides "$ORIG_BODY" 201 -H "X-User-Id: ${RIDER_ID}"
RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')"
[[ "$RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric rideId got '${RIDE_ID}'" $LINENO

cv_prereq "Confirm original ride is in history" $LINENO
cv_http GET "/api/rides/history?from=${TODAY}&to=${TODAY}" 200 -H "X-User-Id: ${RIDER_ID}"
ORIG_MILES=$(printf '%s' "$CV_HTTP_BODY" | jq -r ".rides[] | select(.rideId == ${RIDE_ID}) | .miles")
[ "$(jq -n "${ORIG_MILES:-0} == 5")" = "true" ] || cv_fail "expected original ride miles 5 got '${ORIG_MILES}'" $LINENO

# When
cv_step When "Save an edit of miles, date/time, gas price, weather, direction, difficulty and note" $LINENO
NOTE='Edited: rainy commute, "wet" & windy <ok>'
EDIT_BODY=$(jq -nc --arg dt "$EDIT_DT" --arg note "$NOTE" '{
  rideDateTimeLocal: $dt, miles: 12.5, rideMinutes: 50, temperature: 61.5,
  expectedVersion: 1, gasPricePerGallon: 3.459, windSpeedMph: 20,
  windDirectionDeg: 180, relativeHumidityPercent: 85, cloudCoverPercent: 90,
  precipitationType: "rain", note: $note, weatherUserOverridden: true,
  difficulty: 5, primaryTravelDirection: "South"
}')
cv_http PUT "/api/rides/${RIDE_ID}" "$EDIT_BODY" -H "X-User-Id: ${RIDER_ID}"
EDIT_STATUS="$CV_HTTP_STATUS"
EDIT_RESP="$CV_HTTP_BODY"

# Then
cv_step Then "Edit is confirmed as a new version and history/totals show the saved values" $LINENO
[ "$EDIT_STATUS" = "200" ] || cv_fail "expected 200 from PUT /api/rides/${RIDE_ID} got ${EDIT_STATUS}: ${EDIT_RESP}" $LINENO
NEW_VERSION=$(printf '%s' "$EDIT_RESP" | jq -r '.newVersion')
[ "$NEW_VERSION" = "2" ] || cv_fail "expected newVersion 2 (new revision appended after version 1) got '${NEW_VERSION}'" $LINENO
MSG=$(printf '%s' "$EDIT_RESP" | jq -r '.message // empty')
[ -n "$MSG" ] || cv_fail "expected a confirmation message in edit response got none" $LINENO

cv_http GET "/api/rides/history?from=${TODAY}&to=${TODAY}" 200 -H "X-User-Id: ${RIDER_ID}"
H="$CV_HTTP_BODY"
ROW=$(printf '%s' "$H" | jq -c ".rides[] | select(.rideId == ${RIDE_ID})")
[ -n "$ROW" ] || cv_fail "expected edited ride ${RIDE_ID} in filtered history got none" $LINENO
COUNT=$(printf '%s' "$H" | jq "[.rides[] | select(.rideId == ${RIDE_ID})] | length")
[ "$COUNT" = "1" ] || cv_fail "expected the edited ride once in history (edit is not a duplicate ride) got ${COUNT}" $LINENO

chk() { # jq-expr expected-description
  [ "$(printf '%s' "$ROW" | jq "$1")" = "true" ] || cv_fail "expected $2 got row ${ROW}" "$3"
}
chk '.miles == 12.5' "miles 12.5" $LINENO
chk '.rideDateTimeLocal | startswith("'"$EDIT_DT"'")' "rideDateTimeLocal ${EDIT_DT}" $LINENO
chk '.rideMinutes == 50' "rideMinutes 50" $LINENO
chk '.gasPricePerGallon == 3.459' "gasPricePerGallon 3.459" $LINENO
chk '.temperature == 61.5' "temperature 61.5" $LINENO
chk '.windSpeedMph == 20' "windSpeedMph 20" $LINENO
chk '.windDirectionDeg == 180' "windDirectionDeg 180" $LINENO
chk '.relativeHumidityPercent == 85' "relativeHumidityPercent 85" $LINENO
chk '.cloudCoverPercent == 90' "cloudCoverPercent 90" $LINENO
chk '.precipitationType == "rain"' "precipitationType rain" $LINENO
chk '.weatherUserOverridden == true' "weatherUserOverridden true" $LINENO
chk '.difficulty == 5' "difficulty 5" $LINENO
chk '.primaryTravelDirection == "South"' "primaryTravelDirection South" $LINENO
# Direction North->South with 20 mph wind from 180 deg: headwind, round(20*cos(0)/5)=4
chk '.windResistanceRating == 4' "windResistanceRating recalculated to 4" $LINENO
NOTE_BACK=$(printf '%s' "$ROW" | jq -r '.note')
[ "$NOTE_BACK" = "$NOTE" ] || cv_fail "expected note stored exactly as '${NOTE}' got '${NOTE_BACK}'" $LINENO

[ "$(printf '%s' "$H" | jq '.filteredTotal.miles == 12.5 and .filteredTotal.rideCount == 1')" = "true" ] \
  || cv_fail "expected filteredTotal 12.5 miles / 1 ride got $(printf '%s' "$H" | jq -c '.filteredTotal')" $LINENO
[ "$(printf '%s' "$H" | jq '.summaries.allTime.miles == 12.5 and .summaries.allTime.rideCount == 1')" = "true" ] \
  || cv_fail "expected allTime summary 12.5 miles / 1 ride got $(printf '%s' "$H" | jq -c '.summaries.allTime')" $LINENO
[ "$(printf '%s' "$H" | jq '.summaries.thisMonth.miles == 12.5 and .summaries.thisYear.miles == 12.5')" = "true" ] \
  || cv_fail "expected thisMonth/thisYear summaries 12.5 miles got $(printf '%s' "$H" | jq -c '.summaries')" $LINENO

# Prior revision kept as history: the old version is now superseded, so a save
# against version 1 must be refused as stale rather than overwriting in place.
cv_http PUT "/api/rides/${RIDE_ID}" "$(printf '%s' "$EDIT_BODY" | jq -c '.miles = 1.0')" -H "X-User-Id: ${RIDER_ID}"
[ "$CV_HTTP_STATUS" = "409" ] || cv_fail "expected 409 for stale expectedVersion 1 after edit got ${CV_HTTP_STATUS}" $LINENO
CUR=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.currentVersion')
[ "$CUR" = "2" ] || cv_fail "expected currentVersion 2 in conflict got '${CUR}'" $LINENO

# Cleanup
cv_step Cleanup "Delete the ride created by this test" $LINENO
cv_http DELETE "/api/rides/${RIDE_ID}" -H "X-User-Id: ${RIDER_ID}"

echo "CODEVALID_TEST_ASSERTION_OK:api_42404614_1"
