#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
RIDER_NAME="NoRateRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider with MPG configured but no mileage rate, and record a 50-mile ride today" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "configure averageCarMpg=25 while leaving mileageRateCents unset" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":25}' 200 -H "X-User-Id: $USER_ID"

cv_prereq "record 50-mile ride at 4.00/gal today" $LINENO
RIDE_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 50, gasPricePerGallon: 4.00}')"
cv_http POST /api/rides "$RIDE_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_ID" ] || cv_fail "record ride did not return rideId" $LINENO

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify mileageRateSavings is null in all windows, mileageRateReminderRequired is true, and fuel/gallons are shown" $LINENO

MILEAGE_REMINDER="$(printf '%s' "$DASH_BODY" | jq -r '.reminders.mileageRateReminderRequired')"
[ "$MILEAGE_REMINDER" = "true" ] || cv_fail "expected reminders.mileageRateReminderRequired to be true, got ${MILEAGE_REMINDER}" $LINENO

MPG_REMINDER="$(printf '%s' "$DASH_BODY" | jq -r '.reminders.mpgReminderRequired')"
[ "$MPG_REMINDER" = "false" ] || cv_fail "expected reminders.mpgReminderRequired to be false, got ${MPG_REMINDER}" $LINENO

for win in weekly monthly yearly allTime; do
  RATE_VAL="$(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.mileageRateSavings")"
  [ "$RATE_VAL" = "null" ] || cv_fail "expected savingsWindows.${win}.mileageRateSavings to be null (not available), got ${RATE_VAL}" $LINENO
  check_num_close "$DASH_BODY" ".savingsWindows.${win}.gallonsSaved" 2.00 0.01 \
    || cv_fail "expected ${win}.gallonsSaved=2.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.gallonsSaved")" $LINENO
  check_num_close "$DASH_BODY" ".savingsWindows.${win}.fuelCostAvoided" 8.00 0.01 \
    || cv_fail "expected ${win}.fuelCostAvoided=8.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.fuelCostAvoided")" $LINENO
done

# Cleanup
cv_step Cleanup "delete created ride" $LINENO
if [ -n "$RIDE_ID" ] && [ -n "$USER_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_ID}" "" 200 -H "X-User-Id: $USER_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_2"
