#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
RIDER_NAME="Co2Rider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider, configure initial MPG and vehicle settings, and record 100-mile ride this month" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "set initial vehicle settings (25 MPG, 0.50 mileage rate, 50 oil change, Regular gas)" $LINENO
INIT_SETTINGS='{"averageCarMpg":25,"mileageRateCents":0.50,"oilChangePrice":50,"gasGrade":"Regular"}'
cv_http PUT /api/users/me/settings "$INIT_SETTINGS" 200 -H "X-User-Id: $USER_ID"

cv_prereq "record 100-mile ride in current calendar month" $LINENO
RIDE_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 100, gasPricePerGallon: 3.50}')"
cv_http POST /api/rides "$RIDE_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_ID" ] || cv_fail "record ride did not return rideId" $LINENO

# When
cv_step When "fetch advanced dashboard before and after changing MPG and vehicle settings" $LINENO

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
BEFORE_BODY="$CV_HTTP_BODY"

UPDATED_SETTINGS='{"averageCarMpg":45,"mileageRateCents":0.75,"oilChangePrice":80,"gasGrade":"Premium"}'
cv_http PUT /api/users/me/settings "$UPDATED_SETTINGS" 200 -H "X-User-Id: $USER_ID"

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
AFTER_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify CO2 saved equals 90.00 lb with 0.90 factor and is unchanged after MPG/vehicle settings update" $LINENO

check_num_close "$BEFORE_BODY" '.co2SavedPerMileLbs' 0.90 0.001 \
  || cv_fail "expected initial co2SavedPerMileLbs=0.90 got $(printf '%s' "$BEFORE_BODY" | jq -r '.co2SavedPerMileLbs')" $LINENO
check_num_close "$BEFORE_BODY" '.savingsWindows.monthly.totalMiles' 100 0.01 \
  || cv_fail "expected initial monthly.totalMiles=100 got $(printf '%s' "$BEFORE_BODY" | jq -r '.savingsWindows.monthly.totalMiles')" $LINENO
for win in weekly monthly yearly allTime; do
  check_num_close "$BEFORE_BODY" ".savingsWindows.${win}.co2Saved" 90.00 0.01 \
    || cv_fail "expected initial ${win}.co2Saved=90.00 got $(printf '%s' "$BEFORE_BODY" | jq -r ".savingsWindows.${win}.co2Saved")" $LINENO
done

check_num_close "$AFTER_BODY" '.co2SavedPerMileLbs' 0.90 0.001 \
  || cv_fail "expected post-change co2SavedPerMileLbs=0.90 got $(printf '%s' "$AFTER_BODY" | jq -r '.co2SavedPerMileLbs')" $LINENO
check_num_close "$AFTER_BODY" '.savingsWindows.monthly.totalMiles' 100 0.01 \
  || cv_fail "expected post-change monthly.totalMiles=100 got $(printf '%s' "$AFTER_BODY" | jq -r '.savingsWindows.monthly.totalMiles')" $LINENO
for win in weekly monthly yearly allTime; do
  check_num_close "$AFTER_BODY" ".savingsWindows.${win}.co2Saved" 90.00 0.01 \
    || cv_fail "expected post-change ${win}.co2Saved=90.00 got $(printf '%s' "$AFTER_BODY" | jq -r ".savingsWindows.${win}.co2Saved")" $LINENO
done

# Cleanup
cv_step Cleanup "delete created ride" $LINENO
if [ -n "$RIDE_ID" ] && [ -n "$USER_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_ID}" "" 200 -H "X-User-Id: $USER_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_11"
