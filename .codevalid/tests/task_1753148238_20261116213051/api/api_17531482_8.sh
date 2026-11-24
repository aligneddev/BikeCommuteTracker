#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
THIS_YEAR="$(date -u +%Y)"
LAST_MONTH_DATE="$(date -u -d "$(date -u +%Y-%m-01) -15 days" +%Y-%m-%d)"
LAST_MONTH_YEAR="${LAST_MONTH_DATE%%-*}"

RIDER1_NAME="ExpFilterRider_${CASE_SUFFIX}"
RIDER2_NAME="NoExpRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER1_ID=""
USER2_ID=""
RIDE1_ID=""
EXP_WEEK_ID=""
EXP_LAST_MONTH_ID=""
EXP_DELETED_ID=""
EXP_RIDER2_LAST_MONTH_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register riders and seed expenses dated this week, last month, and a deleted expense dated this week" $LINENO

cv_prereq "sign up Rider 1" $LINENO
SIGNUP1_BODY="$(jq -n --arg name "$RIDER1_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP1_BODY" 201
USER1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER1_ID" ] || cv_fail "signup for Rider 1 did not return userId" $LINENO

cv_prereq "configure Rider 1 averageCarMpg=20 and record a 100-mile ride at 4.00/gal today (fuelCostAvoided=20.00)" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":20}' 200 -H "X-User-Id: $USER1_ID"
RIDE1_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 100, gasPricePerGallon: 4.00}')"
cv_http POST /api/rides "$RIDE1_BODY" 201 -H "X-User-Id: $USER1_ID"
RIDE1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE1_ID" ] || cv_fail "record ride for Rider 1 did not return rideId" $LINENO

cv_prereq "record non-deleted expense of 15.00 dated this week (${TODAY})" $LINENO
cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER1_ID" \
  -F "expenseDate=${TODAY}" \
  -F "amount=15.00" \
  -F "notes=Weekly inner tube"
EXP_WEEK_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXP_WEEK_ID" ] || cv_fail "record weekly expense did not return expenseId" $LINENO

cv_prereq "record non-deleted expense of 40.00 dated last month (${LAST_MONTH_DATE})" $LINENO
cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER1_ID" \
  -F "expenseDate=${LAST_MONTH_DATE}" \
  -F "amount=40.00" \
  -F "notes=Last month chain"
EXP_LAST_MONTH_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXP_LAST_MONTH_ID" ] || cv_fail "record last-month expense did not return expenseId" $LINENO

cv_prereq "record expense of 100.00 dated this week (${TODAY}) and soft-delete it" $LINENO
cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER1_ID" \
  -F "expenseDate=${TODAY}" \
  -F "amount=100.00" \
  -F "notes=Mistaken duplicate wheelset"
EXP_DELETED_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXP_DELETED_ID" ] || cv_fail "record expense to delete did not return expenseId" $LINENO
cv_http DELETE "/api/expenses/${EXP_DELETED_ID}" "" 204 -H "X-User-Id: $USER1_ID"

cv_prereq "sign up Rider 2 with only a last-month expense so weekly and monthly windows have no expenses" $LINENO
SIGNUP2_BODY="$(jq -n --arg name "$RIDER2_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP2_BODY" 201
USER2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER2_ID" ] || cv_fail "signup for Rider 2 did not return userId" $LINENO

cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER2_ID" \
  -F "expenseDate=${LAST_MONTH_DATE}" \
  -F "amount=30.00" \
  -F "notes=Prior month tuneup"
EXP_RIDER2_LAST_MONTH_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXP_RIDER2_LAST_MONTH_ID" ] || cv_fail "record Rider 2 expense did not return expenseId" $LINENO

# When
cv_step When "fetch advanced dashboard for both riders" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER1_ID"
DASH1_BODY="$CV_HTTP_BODY"

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER2_ID"
DASH2_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify weekly totalExpenses includes only the non-deleted this-week expense, excludes last month and deleted expenses, and windows with no expenses show 0.00" $LINENO

check_num_close "$DASH1_BODY" '.savingsWindows.weekly.totalExpenses' 15.00 0.01 \
  || cv_fail "expected weekly.totalExpenses=15.00 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.weekly.totalExpenses')" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.weekly.netSavings' 5.00 0.01 \
  || cv_fail "expected weekly.netSavings=5.00 (20.00 - 15.00) got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.weekly.netSavings')" $LINENO

check_num_close "$DASH1_BODY" '.savingsWindows.monthly.totalExpenses' 15.00 0.01 \
  || cv_fail "expected monthly.totalExpenses=15.00 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.monthly.totalExpenses')" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.monthly.netSavings' 5.00 0.01 \
  || cv_fail "expected monthly.netSavings=5.00 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.monthly.netSavings')" $LINENO

if [ "$LAST_MONTH_YEAR" = "$THIS_YEAR" ]; then
  EXPECTED_YEARLY_EXP="55.00"
  EXPECTED_YEARLY_NET="-35.00"
else
  EXPECTED_YEARLY_EXP="15.00"
  EXPECTED_YEARLY_NET="5.00"
fi
check_num_close "$DASH1_BODY" '.savingsWindows.yearly.totalExpenses' "$EXPECTED_YEARLY_EXP" 0.01 \
  || cv_fail "expected yearly.totalExpenses=${EXPECTED_YEARLY_EXP} got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.yearly.totalExpenses')" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.yearly.netSavings' "$EXPECTED_YEARLY_NET" 0.01 \
  || cv_fail "expected yearly.netSavings=${EXPECTED_YEARLY_NET} got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.yearly.netSavings')" $LINENO

check_num_close "$DASH1_BODY" '.savingsWindows.allTime.totalExpenses' 55.00 0.01 \
  || cv_fail "expected allTime.totalExpenses=55.00 (15.00 + 40.00, excluding deleted 100.00) got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.allTime.totalExpenses')" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.allTime.netSavings' -35.00 0.01 \
  || cv_fail "expected allTime.netSavings=-35.00 (20.00 - 55.00) got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.allTime.netSavings')" $LINENO

for win in weekly monthly; do
  printf '%s' "$DASH2_BODY" | jq -e ".savingsWindows.${win}.totalExpenses | (type == \"number\" and . == 0)" >/dev/null \
    || cv_fail "expected Rider 2 ${win}.totalExpenses=0.00 got $(printf '%s' "$DASH2_BODY" | jq -r ".savingsWindows.${win}.totalExpenses")" $LINENO
done
check_num_close "$DASH2_BODY" '.savingsWindows.allTime.totalExpenses' 30.00 0.01 \
  || cv_fail "expected Rider 2 allTime.totalExpenses=30.00 got $(printf '%s' "$DASH2_BODY" | jq -r '.savingsWindows.allTime.totalExpenses')" $LINENO

# Cleanup
cv_step Cleanup "delete created rides and non-deleted expenses" $LINENO
if [ -n "$RIDE1_ID" ] && [ -n "$USER1_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE1_ID}" "" 200 -H "X-User-Id: $USER1_ID"
fi
if [ -n "$EXP_WEEK_ID" ] && [ -n "$USER1_ID" ]; then
  cv_http DELETE "/api/expenses/${EXP_WEEK_ID}" "" 204 -H "X-User-Id: $USER1_ID"
fi
if [ -n "$EXP_LAST_MONTH_ID" ] && [ -n "$USER1_ID" ]; then
  cv_http DELETE "/api/expenses/${EXP_LAST_MONTH_ID}" "" 204 -H "X-User-Id: $USER1_ID"
fi
if [ -n "$EXP_RIDER2_LAST_MONTH_ID" ] && [ -n "$USER2_ID" ]; then
  cv_http DELETE "/api/expenses/${EXP_RIDER2_LAST_MONTH_ID}" "" 204 -H "X-User-Id: $USER2_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_8"
