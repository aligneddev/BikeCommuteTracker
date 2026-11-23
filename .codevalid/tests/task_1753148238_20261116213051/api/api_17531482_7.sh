#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
RIDER_NAME="NegNetRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_ID=""
EXPENSE_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider with MPG only (no mileage rate, no oil-change price), record ride and larger expense" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "configure averageCarMpg=20 with mileageRateCents and oilChangePrice unset" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":20}' 200 -H "X-User-Id: $USER_ID"

cv_prereq "record 40-mile ride at 4.00/gal today (fuelCostAvoided = 8.00)" $LINENO
RIDE_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 40, gasPricePerGallon: 4.00}')"
cv_http POST /api/rides "$RIDE_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_ID" ] || cv_fail "record ride did not return rideId" $LINENO

cv_prereq "record 25.00 bike expense today (exceeding 8.00 fuel cost avoided)" $LINENO
cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER_ID" \
  -F "expenseDate=${TODAY}" \
  -F "amount=25.00" \
  -F "notes=Replacement tires"
EXPENSE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXPENSE_ID" ] || cv_fail "record expense did not return expenseId" $LINENO

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify unavailable components count as zero and netSavings is -17.00 (8.00 - 25.00)" $LINENO

for win in weekly monthly yearly allTime; do
  RATE_VAL="$(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.mileageRateSavings")"
  [ "$RATE_VAL" = "null" ] || cv_fail "expected savingsWindows.${win}.mileageRateSavings to be null, got ${RATE_VAL}" $LINENO

  OIL_VAL="$(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.oilChangeSavings")"
  [ "$OIL_VAL" = "null" ] || cv_fail "expected savingsWindows.${win}.oilChangeSavings to be null, got ${OIL_VAL}" $LINENO

  check_num_close "$DASH_BODY" ".savingsWindows.${win}.fuelCostAvoided" 8.00 0.01 \
    || cv_fail "expected ${win}.fuelCostAvoided=8.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.fuelCostAvoided")" $LINENO
  check_num_close "$DASH_BODY" ".savingsWindows.${win}.totalExpenses" 25.00 0.01 \
    || cv_fail "expected ${win}.totalExpenses=25.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.totalExpenses")" $LINENO
  check_num_close "$DASH_BODY" ".savingsWindows.${win}.netSavings" -17.00 0.01 \
    || cv_fail "expected ${win}.netSavings=-17.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.netSavings")" $LINENO
done

# Cleanup
cv_step Cleanup "delete created ride and expense" $LINENO
if [ -n "$RIDE_ID" ] && [ -n "$USER_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_ID}" "" 200 -H "X-User-Id: $USER_ID"
fi
if [ -n "$EXPENSE_ID" ] && [ -n "$USER_ID" ]; then
  cv_http DELETE "/api/expenses/${EXPENSE_ID}" "" 204 -H "X-User-Id: $USER_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_7"
