#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"

RIDER_NAME="NoOilPriceRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_IDS=()
EXPENSE_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider without oilChangePrice, record 3200 miles crossing a 3000-mile boundary and a 50.00 expense" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "configure averageCarMpg=20 while leaving oilChangePrice unset" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":20}' 200 -H "X-User-Id: $USER_ID"

cv_prereq "record 16 rides of 200 miles (3200 miles total) at 4.00/gal today (fuelCostAvoided=640.00)" $LINENO
RIDE_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 200, gasPricePerGallon: 4.00}')"
for i in $(seq 1 16); do
  cv_http POST /api/rides "$RIDE_BODY" 201 -H "X-User-Id: $USER_ID"
  rid="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
  [ -n "$rid" ] || cv_fail "ride ${i} did not return rideId" $LINENO
  RIDE_IDS+=("$rid")
done

cv_prereq "record 50.00 bike expense today" $LINENO
cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER_ID" \
  -F "expenseDate=${TODAY}" \
  -F "amount=50.00" \
  -F "notes=Brake pads"
EXPENSE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXPENSE_ID" ] || cv_fail "record expense did not return expenseId" $LINENO

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify oilChangeSavings is null in every window while netSavings is still computed without it (590.00)" $LINENO

for win in weekly monthly yearly allTime; do
  check_num_close "$DASH_BODY" ".savingsWindows.${win}.totalMiles" 3200 0.01 \
    || cv_fail "expected ${win}.totalMiles=3200 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.totalMiles")" $LINENO

  OIL_VAL="$(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.oilChangeSavings")"
  [ "$OIL_VAL" = "null" ] || cv_fail "expected savingsWindows.${win}.oilChangeSavings to be null (not available), got ${OIL_VAL}" $LINENO

  check_num_close "$DASH_BODY" ".savingsWindows.${win}.fuelCostAvoided" 640.00 0.01 \
    || cv_fail "expected ${win}.fuelCostAvoided=640.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.fuelCostAvoided")" $LINENO

  check_num_close "$DASH_BODY" ".savingsWindows.${win}.totalExpenses" 50.00 0.01 \
    || cv_fail "expected ${win}.totalExpenses=50.00 got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.totalExpenses")" $LINENO

  check_num_close "$DASH_BODY" ".savingsWindows.${win}.netSavings" 590.00 0.01 \
    || cv_fail "expected ${win}.netSavings=590.00 (640.00 - 50.00 without oil-change savings) got $(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.netSavings")" $LINENO
done

# Cleanup
cv_step Cleanup "delete created rides and expense" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER_ID"
done
if [ -n "$EXPENSE_ID" ] && [ -n "$USER_ID" ]; then
  cv_http DELETE "/api/expenses/${EXPENSE_ID}" "" 204 -H "X-User-Id: $USER_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_10"
