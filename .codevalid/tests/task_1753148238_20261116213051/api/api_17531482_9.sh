#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
THIS_YEAR="$(date -u +%Y)"
THIS_MONTH="$(date -u +%m)"
PREV_YEAR="$((THIS_YEAR - 1))"

RIDER1_NAME="OilIntervalRider_${CASE_SUFFIX}"
RIDER2_NAME="OilZeroCrossRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER1_ID=""
USER2_ID=""
RIDE1_IDS=()
RIDE2_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

record_ride() {
  local uid="$1" dt="$2" miles="$3"
  local body rid
  body="$(jq -n --arg dt "$dt" --argjson miles "$miles" '{rideDateTimeLocal: $dt, miles: $miles}')"
  cv_http POST /api/rides "$body" 201 -H "X-User-Id: $uid"
  rid="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
  [ -n "$rid" ] || cv_fail "record ride did not return rideId" $LINENO
  LAST_RIDE_ID="$rid"
}

# Given
cv_step Given "register rider with 50 oil-change price, 2900 miles before this year, and 3200 miles this year (6100 cumulative)" $LINENO

cv_prereq "sign up Rider 1 and set oilChangePrice=50" $LINENO
SIGNUP1_BODY="$(jq -n --arg name "$RIDER1_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP1_BODY" 201
USER1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER1_ID" ] || cv_fail "signup for Rider 1 did not return userId" $LINENO

cv_http PUT /api/users/me/settings '{"oilChangePrice":50}' 200 -H "X-User-Id: $USER1_ID"

cv_prereq "record 2900 cumulative miles in ${PREV_YEAR} (14x200 + 1x100)" $LINENO
for i in $(seq 1 14); do
  record_ride "$USER1_ID" "${PREV_YEAR}-06-15T08:00:00" 200
  RIDE1_IDS+=("$LAST_RIDE_ID")
done
record_ride "$USER1_ID" "${PREV_YEAR}-06-16T08:00:00" 100
RIDE1_IDS+=("$LAST_RIDE_ID")

if [ "$THIS_MONTH" != "01" ]; then
  cv_prereq "record 3190 miles in January ${THIS_YEAR} (15x200 + 1x190) and 10 miles today (${TODAY}) for 3200 yearly / 6100 cumulative miles" $LINENO
  for i in $(seq 1 15); do
    record_ride "$USER1_ID" "${THIS_YEAR}-01-10T08:00:00" 200
    RIDE1_IDS+=("$LAST_RIDE_ID")
  done
  record_ride "$USER1_ID" "${THIS_YEAR}-01-11T08:00:00" 190
  RIDE1_IDS+=("$LAST_RIDE_ID")
  record_ride "$USER1_ID" "${TODAY}T08:00:00" 10
  RIDE1_IDS+=("$LAST_RIDE_ID")
else
  cv_prereq "record 3200 miles in January ${THIS_YEAR} (16x200) and a second rider with 100 miles (no 3000-mile crossing)" $LINENO
  for i in $(seq 1 16); do
    record_ride "$USER1_ID" "${THIS_YEAR}-01-01T08:00:00" 200
    RIDE1_IDS+=("$LAST_RIDE_ID")
  done
  SIGNUP2_BODY="$(jq -n --arg name "$RIDER2_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
  cv_http POST /api/users/signup "$SIGNUP2_BODY" 201
  USER2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
  [ -n "$USER2_ID" ] || cv_fail "signup for Rider 2 did not return userId" $LINENO
  cv_http PUT /api/users/me/settings '{"oilChangePrice":50}' 200 -H "X-User-Id: $USER2_ID"
  record_ride "$USER2_ID" "${TODAY}T08:00:00" 100
  RIDE2_ID="$LAST_RIDE_ID"
fi

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER1_ID"
DASH1_BODY="$CV_HTTP_BODY"

DASH2_BODY=""
if [ -n "$USER2_ID" ]; then
  cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER2_ID"
  DASH2_BODY="$CV_HTTP_BODY"
fi

# Then
cv_step Then "verify yearly oil-change savings is 100 (2 intervals crossed) and a window crossing no 3000-mile boundary shows 0" $LINENO

check_num_close "$DASH1_BODY" '.savingsWindows.yearly.totalMiles' 3200 0.01 \
  || cv_fail "expected yearly.totalMiles=3200 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.yearly.totalMiles')" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.allTime.totalMiles' 6100 0.01 \
  || cv_fail "expected allTime.totalMiles=6100 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.allTime.totalMiles')" $LINENO

check_num_close "$DASH1_BODY" '.savingsWindows.yearly.oilChangeSavings' 100.00 0.01 \
  || cv_fail "expected yearly.oilChangeSavings=100.00 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.yearly.oilChangeSavings')" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.allTime.oilChangeSavings' 100.00 0.01 \
  || cv_fail "expected allTime.oilChangeSavings=100.00 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.allTime.oilChangeSavings')" $LINENO

if [ "$THIS_MONTH" != "01" ]; then
  check_num_close "$DASH1_BODY" '.savingsWindows.weekly.oilChangeSavings' 0 0.01 \
    || cv_fail "expected weekly.oilChangeSavings=0 (no 3000-mile boundary crossed) got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.weekly.oilChangeSavings')" $LINENO
  check_num_close "$DASH1_BODY" '.savingsWindows.monthly.oilChangeSavings' 0 0.01 \
    || cv_fail "expected monthly.oilChangeSavings=0 (no 3000-mile boundary crossed) got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.monthly.oilChangeSavings')" $LINENO
else
  check_num_close "$DASH2_BODY" '.savingsWindows.yearly.oilChangeSavings' 0 0.01 \
    || cv_fail "expected Rider 2 yearly.oilChangeSavings=0 (no 3000-mile boundary crossed) got $(printf '%s' "$DASH2_BODY" | jq -r '.savingsWindows.yearly.oilChangeSavings')" $LINENO
  check_num_close "$DASH2_BODY" '.savingsWindows.weekly.oilChangeSavings' 0 0.01 \
    || cv_fail "expected Rider 2 weekly.oilChangeSavings=0 got $(printf '%s' "$DASH2_BODY" | jq -r '.savingsWindows.weekly.oilChangeSavings')" $LINENO
fi

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${RIDE1_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER1_ID"
done
if [ -n "$RIDE2_ID" ] && [ -n "$USER2_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE2_ID}" "" 200 -H "X-User-Id: $USER2_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_9"
