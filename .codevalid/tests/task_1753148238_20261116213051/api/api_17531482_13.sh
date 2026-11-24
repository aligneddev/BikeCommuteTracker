#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
RIDER_NAME="TimeRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_IDS=()

# Given
cv_step Given "register rider and record rides of 90m, 40m, and one ride with no duration" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "record 1h 30m (90m) ride" $LINENO
RIDE1_BODY="$(jq -n --arg dt "${TODAY}T07:00:00" '{rideDateTimeLocal: $dt, miles: 15, rideMinutes: 90}')"
cv_http POST /api/rides "$RIDE1_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE1_ID" ] || cv_fail "ride 1 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE1_ID")

cv_prereq "record 40m ride" $LINENO
RIDE2_BODY="$(jq -n --arg dt "${TODAY}T12:00:00" '{rideDateTimeLocal: $dt, miles: 8, rideMinutes: 40}')"
cv_http POST /api/rides "$RIDE2_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE2_ID" ] || cv_fail "ride 2 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE2_ID")

cv_prereq "record ride with no recorded duration" $LINENO
RIDE3_BODY="$(jq -n --arg dt "${TODAY}T17:00:00" '{rideDateTimeLocal: $dt, miles: 5}')"
cv_http POST /api/rides "$RIDE3_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE3_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE3_ID" ] || cv_fail "ride 3 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE3_ID")

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify all-time totalRideMinutes is 130 (2h 10m), durationless ride is excluded, and windows omit riding time" $LINENO

TOTAL_MINUTES="$(printf '%s' "$DASH_BODY" | jq -r '.totalRideMinutes')"
[ "$TOTAL_MINUTES" = "130" ] || cv_fail "expected totalRideMinutes to be 130 (2h 10m), got ${TOTAL_MINUTES}" $LINENO

ALL_TIME_COUNT="$(printf '%s' "$DASH_BODY" | jq -r '.savingsWindows.allTime.rideCount')"
[ "$ALL_TIME_COUNT" = "3" ] || cv_fail "expected allTime.rideCount to be 3, got ${ALL_TIME_COUNT}" $LINENO

for win in weekly monthly yearly allTime; do
  if printf '%s' "$DASH_BODY" | jq -e ".savingsWindows.${win} | (has(\"totalRideMinutes\") or has(\"rideMinutes\") or has(\"ridingTime\"))" >/dev/null; then
    cv_fail "expected savingsWindows.${win} not to contain riding time fields" $LINENO
  fi
done

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_13"
