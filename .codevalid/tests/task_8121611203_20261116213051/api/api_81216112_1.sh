#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_81216112_1"
SUFFIX="$(date +%s%N)"
RIDER_NAME="cv-rider-${SUFFIX}"
RIDER_PIN="4821"
RIDE_DT="2026-11-16T07:30:00"
RIDE_MILES="12.5"
RIDE_ID=""
AUTH=()

# Given
cv_step Given "a newly signed-up rider (no settings, so no weather lookup) is identified" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
RIDER_ID="$(jq -r '.userId // empty' <<<"$CV_HTTP_BODY")"
[ -n "$RIDER_ID" ] || cv_fail "expected userId in signup response got ${CV_HTTP_BODY}" $LINENO

cv_prereq "identify rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/identify "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 200
[ "$(jq -r '.userId' <<<"$CV_HTTP_BODY")" = "$RIDER_ID" ] \
  || cv_fail "expected identify userId ${RIDER_ID} got ${CV_HTTP_BODY}" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

cv_prereq "rider history starts empty" $LINENO
cv_http GET "/api/rides/history?page=1&pageSize=25" 200 "${AUTH[@]}"
[ "$(jq -r '.totalRows' <<<"$CV_HTTP_BODY")" = "0" ] \
  || cv_fail "expected 0 rides before recording got $(jq -c '.totalRows' <<<"$CV_HTTP_BODY")" $LINENO

# When
cv_step When "rider records a ride with only date/time and 12.5 miles" $LINENO
cv_http POST /api/rides/ "$(jq -nc --arg d "$RIDE_DT" --argjson m "$RIDE_MILES" '{rideDateTimeLocal:$d,miles:$m}')" \
  "${AUTH[@]}"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 for record ride got ${CV_HTTP_STATUS}: ${CV_HTTP_BODY}" $LINENO
RIDE_ID="$(jq -r '.rideId // empty' <<<"$CV_HTTP_BODY")"
[ -n "$RIDE_ID" ] && [ "$RIDE_ID" != "0" ] || cv_fail "expected rideId in response got ${CV_HTTP_BODY}" $LINENO
[ "$(jq -r '.riderId' <<<"$CV_HTTP_BODY")" = "$RIDER_ID" ] \
  || cv_fail "expected riderId ${RIDER_ID} in response got ${CV_HTTP_BODY}" $LINENO

# Then
cv_step Then "ride history shows the ride linked to the rider with values as entered and optionals absent" $LINENO
cv_http GET "/api/rides/history?page=1&pageSize=25" 200 "${AUTH[@]}"
[ "$(jq -r '.totalRows' <<<"$CV_HTTP_BODY")" = "1" ] \
  || cv_fail "expected exactly 1 ride for rider got totalRows=$(jq -c '.totalRows' <<<"$CV_HTTP_BODY")" $LINENO
ROW="$(jq -c --argjson id "$RIDE_ID" '.rides[] | select(.rideId == $id)' <<<"$CV_HTTP_BODY")"
[ -n "$ROW" ] || cv_fail "expected ride ${RIDE_ID} in rider history got ${CV_HTTP_BODY}" $LINENO
echo "ROW: $ROW"

GOT_DT="$(jq -r '.rideDateTimeLocal' <<<"$ROW")"
case "$GOT_DT" in "$RIDE_DT"*) ;; *) cv_fail "expected rideDateTimeLocal ${RIDE_DT} got ${GOT_DT}" $LINENO ;; esac
jq -e '.miles == 12.5' <<<"$ROW" >/dev/null || cv_fail "expected miles 12.5 got $(jq -c '.miles' <<<"$ROW")" $LINENO

for f in rideMinutes temperature gasPricePerGallon note difficulty primaryTravelDirection windResistanceRating; do
  jq -e --arg f "$f" '(.[$f] // null) == null' <<<"$ROW" >/dev/null \
    || cv_fail "expected optional ${f} absent (null) got $(jq -c --arg f "$f" '.[$f]' <<<"$ROW")" $LINENO
done

for f in windSpeedMph windDirectionDeg relativeHumidityPercent cloudCoverPercent precipitationType; do
  jq -e --arg f "$f" 'has($f)' <<<"$ROW" >/dev/null \
    || cv_fail "expected weather field ${f} present (value or explicit empty) got row ${ROW}" $LINENO
  jq -e --arg f "$f" '.[$f] == null' <<<"$ROW" >/dev/null \
    || cv_fail "expected weather field ${f} empty (no location, nothing submitted) got $(jq -c --arg f "$f" '.[$f]' <<<"$ROW")" $LINENO
done
jq -e '.weatherUserOverridden == false' <<<"$ROW" >/dev/null \
  || cv_fail "expected weatherUserOverridden false got $(jq -c '.weatherUserOverridden' <<<"$ROW")" $LINENO

# Cleanup
cv_step Cleanup "delete the recorded ride" $LINENO
if [ -n "$RIDE_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_ID}" "${AUTH[@]}"
  echo "delete status: ${CV_HTTP_STATUS}"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_81216112_1"
