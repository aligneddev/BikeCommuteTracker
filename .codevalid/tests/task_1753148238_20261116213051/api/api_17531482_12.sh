#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
THIS_YEAR="$(date -u +%Y)"
PREV_YEAR="$((THIS_YEAR - 1))"

RIDER_NAME="Co2RecalcRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_IDS=()

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider with a 50-mile ride in previous year and a 20-mile ride in the current window" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "record 50-mile ride in ${PREV_YEAR} (expected CO2 = 45.00 lb)" $LINENO
RIDE_PREV_BODY="$(jq -n --arg dt "${PREV_YEAR}-06-15T08:00:00" '{rideDateTimeLocal: $dt, miles: 50}')"
cv_http POST /api/rides "$RIDE_PREV_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE_PREV_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_PREV_ID" ] || cv_fail "previous-year ride did not return rideId" $LINENO
RIDE_IDS+=("$RIDE_PREV_ID")

cv_prereq "record 20-mile ride today (${TODAY}, expected CO2 = 18.00 lb)" $LINENO
RIDE_CURR_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 20}')"
cv_http POST /api/rides "$RIDE_CURR_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE_CURR_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_CURR_ID" ] || cv_fail "current-window ride did not return rideId" $LINENO
RIDE_IDS+=("$RIDE_CURR_ID")

# When
cv_step When "view CO2 saved, add a 10-mile ride in current window, reload, and select previous year" $LINENO

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
BEFORE_BODY="$CV_HTTP_BODY"

RIDE_ADD_BODY="$(jq -n --arg dt "${TODAY}T12:00:00" '{rideDateTimeLocal: $dt, miles: 10}')"
cv_http POST /api/rides "$RIDE_ADD_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE_ADD_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_ADD_ID" ] || cv_fail "added 10-mile ride did not return rideId" $LINENO
RIDE_IDS+=("$RIDE_ADD_ID")

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
AFTER_BODY="$CV_HTTP_BODY"

cv_http GET "/api/dashboard/advanced?year=${PREV_YEAR}" "" 200 -H "X-User-Id: $USER_ID"
ADV_PREV_YEAR_BODY="$CV_HTTP_BODY"

cv_http GET "/api/dashboard/year-stats?year=${PREV_YEAR}" "" 200 -H "X-User-Id: $USER_ID"
YEAR_STATS_PREV_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify adding a 10-mile ride increases CO2 by 9.00 lb and selecting previous year shows 45.00 lb CO2 for that year's miles" $LINENO

for win in weekly monthly yearly; do
  check_num_close "$BEFORE_BODY" ".savingsWindows.${win}.co2Saved" 18.00 0.01 \
    || cv_fail "expected initial ${win}.co2Saved=18.00 got $(printf '%s' "$BEFORE_BODY" | jq -r ".savingsWindows.${win}.co2Saved")" $LINENO
  check_num_close "$AFTER_BODY" ".savingsWindows.${win}.co2Saved" 27.00 0.01 \
    || cv_fail "expected updated ${win}.co2Saved=27.00 (+9.00 lb) got $(printf '%s' "$AFTER_BODY" | jq -r ".savingsWindows.${win}.co2Saved")" $LINENO
done

check_num_close "$BEFORE_BODY" '.savingsWindows.allTime.co2Saved' 63.00 0.01 \
  || cv_fail "expected initial allTime.co2Saved=63.00 got $(printf '%s' "$BEFORE_BODY" | jq -r '.savingsWindows.allTime.co2Saved')" $LINENO
check_num_close "$AFTER_BODY" '.savingsWindows.allTime.co2Saved' 72.00 0.01 \
  || cv_fail "expected updated allTime.co2Saved=72.00 (+9.00 lb) got $(printf '%s' "$AFTER_BODY" | jq -r '.savingsWindows.allTime.co2Saved')" $LINENO

ADV_PREV_CO2="$(printf '%s' "$ADV_PREV_YEAR_BODY" | jq -r '.savingsWindows.yearly.co2Saved')"
YS_PREV_CO2="$(printf '%s' "$YEAR_STATS_PREV_BODY" | jq -r '.totals.co2Saved // .co2Saved // "null"')"

if ! check_num_close "$ADV_PREV_YEAR_BODY" '.savingsWindows.yearly.co2Saved' 45.00 0.01 \
  && ! check_num_close "$YEAR_STATS_PREV_BODY" '(.totals.co2Saved // .co2Saved)' 45.00 0.01; then
  cv_fail "expected selecting year ${PREV_YEAR} to return 45.00 lb CO2 (50 mi * 0.90), got advanced?year=${PREV_YEAR} yearly.co2Saved=${ADV_PREV_CO2} and year-stats?year=${PREV_YEAR} co2Saved=${YS_PREV_CO2}" $LINENO
fi

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_12"
