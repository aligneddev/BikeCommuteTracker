#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case api_62594327_3: current-month, year-to-date and all-time miles are sums of the rider's
# own rides in each period. Another rider's rides must not be counted.
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
PIN="5307"
RIDER_RIDES=()
OTHER_RIDES=()

signup() { # name -> sets LAST_USER_ID
  cv_http POST /api/users/signup "{\"name\":\"$1\",\"pin\":\"${PIN}\"}"
  [ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup of $1 got $CV_HTTP_STATUS" $LINENO
  LAST_USER_ID="$(jq -r '.userId' <<<"$CV_HTTP_BODY")"
}

record_ride() { # userId datetime miles -> sets LAST_RIDE_ID
  cv_http POST /api/rides "{\"rideDateTimeLocal\":\"$2\",\"miles\":$3,\"weatherUserOverridden\":false}" -H "X-User-Id: $1"
  [ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 recording ride $2 ($3 mi) got $CV_HTTP_STATUS" $LINENO
  LAST_RIDE_ID="$(jq -r '.rideId' <<<"$CV_HTTP_BODY")"
}

num_eq() { awk -v a="$1" -v b="$2" 'BEGIN{d=a-b; if(d<0)d=-d; exit !(d < 0.0001)}'; }

# Given
cv_step Given "Rider with rides this month, earlier this year and in prior years; another rider with rides" $LINENO
cv_prereq "Sign up the rider and another rider" $LINENO
signup "miles-rider-${SUFFIX}"; RIDER_ID="$LAST_USER_ID"
signup "miles-other-${SUFFIX}"; OTHER_ID="$LAST_USER_ID"
cv_http POST /api/users/identify "{\"name\":\"miles-rider-${SUFFIX}\",\"pin\":\"${PIN}\"}" 200

YEAR="$(date +%Y)"; MONTH="$(date +%m)"
PREV_YEAR=$((YEAR - 1)); OLD_YEAR=$((YEAR - 3))
CUR_MONTH_DT="${YEAR}-${MONTH}-01T07:30:00"

cv_prereq "Record rider rides across periods" $LINENO
record_ride "$RIDER_ID" "$CUR_MONTH_DT" 5.25; RIDER_RIDES+=("$LAST_RIDE_ID")
record_ride "$RIDER_ID" "${YEAR}-${MONTH}-01T17:45:00" 4.5; RIDER_RIDES+=("$LAST_RIDE_ID")
EXP_MONTH="9.75"
if [ "$MONTH" != "01" ]; then
  record_ride "$RIDER_ID" "${YEAR}-01-15T08:00:00" 12.0; RIDER_RIDES+=("$LAST_RIDE_ID")
  EXP_YTD="21.75"
else
  EXP_YTD="9.75"
fi
record_ride "$RIDER_ID" "${PREV_YEAR}-12-31T18:00:00" 8.0; RIDER_RIDES+=("$LAST_RIDE_ID")
record_ride "$RIDER_ID" "${OLD_YEAR}-06-10T09:00:00" 20.5; RIDER_RIDES+=("$LAST_RIDE_ID")
EXP_ALL="$(awk -v y="$EXP_YTD" 'BEGIN{printf "%.2f", y + 8.0 + 20.5}')"

cv_prereq "Record other rider rides (must not be counted)" $LINENO
record_ride "$OTHER_ID" "${YEAR}-${MONTH}-01T09:00:00" 33.0; OTHER_RIDES+=("$LAST_RIDE_ID")
record_ride "$OTHER_ID" "${PREV_YEAR}-03-03T09:00:00" 44.0; OTHER_RIDES+=("$LAST_RIDE_ID")

# When
cv_step When "Rider loads the dashboard (GET /api/dashboard)" $LINENO
cv_http GET /api/dashboard -H "X-User-Id: ${RIDER_ID}"
DASH_STATUS="$CV_HTTP_STATUS"; DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "Month, year-to-date and all-time miles equal the rider's own ride sums" $LINENO
[ "$DASH_STATUS" = "200" ] || cv_fail "expected 200 from GET /api/dashboard got $DASH_STATUS" $LINENO
M="$(jq -r '.totals.currentMonthMiles.miles' <<<"$DASH_BODY")"
Y="$(jq -r '.totals.yearToDateMiles.miles' <<<"$DASH_BODY")"
A="$(jq -r '.totals.allTimeMiles.miles' <<<"$DASH_BODY")"
num_eq "$M" "$EXP_MONTH" || cv_fail "expected currentMonthMiles ${EXP_MONTH} got ${M}" $LINENO
num_eq "$Y" "$EXP_YTD" || cv_fail "expected yearToDateMiles ${EXP_YTD} got ${Y}" $LINENO
num_eq "$A" "$EXP_ALL" || cv_fail "expected allTimeMiles ${EXP_ALL} got ${A}" $LINENO
[ "$(jq -r '.totals.allTimeMiles.rideCount' <<<"$DASH_BODY")" = "${#RIDER_RIDES[@]}" ] \
  || cv_fail "expected allTime rideCount ${#RIDER_RIDES[@]} got $(jq -r '.totals.allTimeMiles.rideCount' <<<"$DASH_BODY")" $LINENO
[ "$(jq -r '.totals.currentMonthMiles.rideCount' <<<"$DASH_BODY")" = "2" ] \
  || cv_fail "expected currentMonth rideCount 2 got $(jq -r '.totals.currentMonthMiles.rideCount' <<<"$DASH_BODY")" $LINENO

# Cleanup
cv_step Cleanup "Delete the rides this case recorded" $LINENO
for rid in "${RIDER_RIDES[@]}"; do cv_http DELETE "/api/rides/${rid}" -H "X-User-Id: ${RIDER_ID}" || true; done
for rid in "${OTHER_RIDES[@]}"; do cv_http DELETE "/api/rides/${rid}" -H "X-User-Id: ${OTHER_ID}" || true; done

echo "CODEVALID_TEST_ASSERTION_OK:api_62594327_3"
