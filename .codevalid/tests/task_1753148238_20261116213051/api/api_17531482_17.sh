#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
THIS_MONTH="$(date -u +%m)"
if [ "$THIS_MONTH" = "06" ]; then
  OTHER_MONTH_DATE="2025-02-15T08:00:00"
else
  OTHER_MONTH_DATE="2025-06-15T08:00:00"
fi

RIDER_A_NAME="IsoRiderA_${CASE_SUFFIX}"
RIDER_B_NAME="IsoRiderB_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_A_ID=""
USER_B_ID=""
RIDE_A_ID=""
EXP_A_ID=""
RIDE_B1_ID=""
RIDE_B2_ID=""
EXP_B_ID=""

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

assert_rider_a_only() {
  local label="$1" body="$2"

  local mpg_rem rate_rem total_mins diff_len diff_count
  mpg_rem="$(printf '%s' "$body" | jq -r '.reminders.mpgReminderRequired')"
  [ "$mpg_rem" = "false" ] || cv_fail "${label}: expected mpgReminderRequired=false got ${mpg_rem}" $LINENO

  rate_rem="$(printf '%s' "$body" | jq -r '.reminders.mileageRateReminderRequired')"
  [ "$rate_rem" = "true" ] || cv_fail "${label}: expected mileageRateReminderRequired=true (Rider B mileageRateCents leaked) got ${rate_rem}" $LINENO

  total_mins="$(printf '%s' "$body" | jq -r '.totalRideMinutes')"
  [ "$total_mins" = "30" ] || cv_fail "${label}: expected totalRideMinutes=30 (Rider A only) got ${total_mins}" $LINENO

  for win in weekly monthly yearly allTime; do
    local rc rate_val oil_val
    rc="$(printf '%s' "$body" | jq -r ".savingsWindows.${win}.rideCount")"
    [ "$rc" = "1" ] || cv_fail "${label}: expected ${win}.rideCount=1 got ${rc}" $LINENO
    check_num_close "$body" ".savingsWindows.${win}.totalMiles" 25 0.01 \
      || cv_fail "${label}: expected ${win}.totalMiles=25 got $(printf '%s' "$body" | jq -r ".savingsWindows.${win}.totalMiles")" $LINENO
    check_num_close "$body" ".savingsWindows.${win}.gallonsSaved" 1.00 0.01 \
      || cv_fail "${label}: expected ${win}.gallonsSaved=1.00 got $(printf '%s' "$body" | jq -r ".savingsWindows.${win}.gallonsSaved")" $LINENO
    check_num_close "$body" ".savingsWindows.${win}.fuelCostAvoided" 4.00 0.01 \
      || cv_fail "${label}: expected ${win}.fuelCostAvoided=4.00 got $(printf '%s' "$body" | jq -r ".savingsWindows.${win}.fuelCostAvoided")" $LINENO
    rate_val="$(printf '%s' "$body" | jq -r ".savingsWindows.${win}.mileageRateSavings")"
    [ "$rate_val" = "null" ] || cv_fail "${label}: expected ${win}.mileageRateSavings=null got ${rate_val}" $LINENO
    oil_val="$(printf '%s' "$body" | jq -r ".savingsWindows.${win}.oilChangeSavings")"
    [ "$oil_val" = "null" ] || cv_fail "${label}: expected ${win}.oilChangeSavings=null got ${oil_val}" $LINENO
    check_num_close "$body" ".savingsWindows.${win}.totalExpenses" 5.00 0.01 \
      || cv_fail "${label}: expected ${win}.totalExpenses=5.00 got $(printf '%s' "$body" | jq -r ".savingsWindows.${win}.totalExpenses")" $LINENO
    check_num_close "$body" ".savingsWindows.${win}.netSavings" -1.00 0.01 \
      || cv_fail "${label}: expected ${win}.netSavings=-1.00 got $(printf '%s' "$body" | jq -r ".savingsWindows.${win}.netSavings")" $LINENO
    check_num_close "$body" ".savingsWindows.${win}.co2Saved" 22.50 0.01 \
      || cv_fail "${label}: expected ${win}.co2Saved=22.50 got $(printf '%s' "$body" | jq -r ".savingsWindows.${win}.co2Saved")" $LINENO
  done

  diff_len="$(printf '%s' "$body" | jq -r '.difficultySection.difficultyByMonth | length')"
  [ "$diff_len" = "1" ] || cv_fail "${label}: expected difficultyByMonth length=1 (Rider A only) got ${diff_len}" $LINENO
  diff_count="$(printf '%s' "$body" | jq -r '.difficultySection.difficultyByMonth[0].rideCount')"
  [ "$diff_count" = "1" ] || cv_fail "${label}: expected difficultyByMonth[0].rideCount=1 got ${diff_count}" $LINENO
  check_num_close "$body" '.difficultySection.overallAverageDifficulty' 2.0 0.1 \
    || cv_fail "${label}: expected overallAverageDifficulty=2.0 got $(printf '%s' "$body" | jq -r '.difficultySection.overallAverageDifficulty')" $LINENO
}

# Given
cv_step Given "create Rider A and Rider B with distinct settings, rides, and expenses" $LINENO

cv_prereq "sign up Rider A with averageCarMpg=25 only, a 25-mile ride (30 min, difficulty 2), and a 5.00 expense" $LINENO
SIGNUP_A_BODY="$(jq -n --arg name "$RIDER_A_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_A_BODY" 201
USER_A_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_A_ID" ] || cv_fail "signup for Rider A did not return userId" $LINENO

cv_http PUT /api/users/me/settings '{"averageCarMpg":25}' 200 -H "X-User-Id: $USER_A_ID"

RIDE_A_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 25, rideMinutes: 30, gasPricePerGallon: 4.00, difficulty: 2}')"
cv_http POST /api/rides "$RIDE_A_BODY" 201 -H "X-User-Id: $USER_A_ID"
RIDE_A_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_A_ID" ] || cv_fail "record ride for Rider A did not return rideId" $LINENO

cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER_A_ID" \
  -F "expenseDate=${TODAY}" \
  -F "amount=5.00" \
  -F "notes=Rider A patch kit"
EXP_A_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXP_A_ID" ] || cv_fail "record expense for Rider A did not return expenseId" $LINENO

cv_prereq "sign up Rider B with distinct settings (10 MPG, 0.70 mileageRate, 80 oilChange), 2 rides (250 mi, 300 min, difficulty 5), and a 250.00 expense" $LINENO
SIGNUP_B_BODY="$(jq -n --arg name "$RIDER_B_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_B_BODY" 201
USER_B_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_B_ID" ] || cv_fail "signup for Rider B did not return userId" $LINENO

cv_http PUT /api/users/me/settings '{"averageCarMpg":10,"mileageRateCents":0.70,"oilChangePrice":80}' 200 -H "X-User-Id: $USER_B_ID"

RIDE_B1_BODY="$(jq -n --arg dt "${TODAY}T09:00:00" '{rideDateTimeLocal: $dt, miles: 100, rideMinutes: 120, gasPricePerGallon: 5.00, difficulty: 5}')"
cv_http POST /api/rides "$RIDE_B1_BODY" 201 -H "X-User-Id: $USER_B_ID"
RIDE_B1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_B1_ID" ] || cv_fail "record ride 1 for Rider B did not return rideId" $LINENO

RIDE_B2_BODY="$(jq -n --arg dt "$OTHER_MONTH_DATE" '{rideDateTimeLocal: $dt, miles: 150, rideMinutes: 180, gasPricePerGallon: 5.00, difficulty: 5}')"
cv_http POST /api/rides "$RIDE_B2_BODY" 201 -H "X-User-Id: $USER_B_ID"
RIDE_B2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE_B2_ID" ] || cv_fail "record ride 2 for Rider B did not return rideId" $LINENO

cv_http POST /api/expenses "" 201 \
  -H "X-User-Id: $USER_B_ID" \
  -F "expenseDate=${TODAY}" \
  -F "amount=250.00" \
  -F "notes=Rider B drivetrain overhaul"
EXP_B_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXP_B_ID" ] || cv_fail "record expense for Rider B did not return expenseId" $LINENO

# When
cv_step When "Rider A fetches advanced dashboard, attempts parameter tampering for Rider B, and an unauthenticated call is attempted" $LINENO

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_A_ID"
DASH_A_BODY="$CV_HTTP_BODY"

cv_http GET "/api/dashboard/advanced?userId=${USER_B_ID}&riderId=${USER_B_ID}" "" -H "X-User-Id: $USER_A_ID"
DASH_A_TAMPER_STATUS="$CV_HTTP_STATUS"
DASH_A_TAMPER_BODY="$CV_HTTP_BODY"

cv_http GET /api/dashboard/advanced ""
UNAUTH_STATUS="$CV_HTTP_STATUS"

# Then
cv_step Then "verify Rider A sees only Rider A data, cannot obtain Rider B stats, unauthenticated request is rejected, and Rider B retains own stats" $LINENO

[ "$UNAUTH_STATUS" = "401" ] || cv_fail "expected unauthenticated GET /api/dashboard/advanced to return 401, got ${UNAUTH_STATUS}" $LINENO

assert_rider_a_only "Rider A dashboard" "$DASH_A_BODY"

if [ "$DASH_A_TAMPER_STATUS" = "200" ]; then
  assert_rider_a_only "Rider A query-tampered dashboard" "$DASH_A_TAMPER_BODY"
elif [ "$DASH_A_TAMPER_STATUS" != "403" ] && [ "$DASH_A_TAMPER_STATUS" != "404" ] && [ "$DASH_A_TAMPER_STATUS" != "400" ]; then
  cv_fail "unexpected status ${DASH_A_TAMPER_STATUS} when Rider A passed Rider B query params" $LINENO
fi

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_B_ID"
DASH_B_BODY="$CV_HTTP_BODY"
check_num_close "$DASH_B_BODY" '.savingsWindows.allTime.totalMiles' 250 0.01 \
  || cv_fail "expected Rider B allTime.totalMiles=250 got $(printf '%s' "$DASH_B_BODY" | jq -r '.savingsWindows.allTime.totalMiles')" $LINENO
check_num_close "$DASH_B_BODY" '.savingsWindows.allTime.totalExpenses' 250.00 0.01 \
  || cv_fail "expected Rider B allTime.totalExpenses=250.00 got $(printf '%s' "$DASH_B_BODY" | jq -r '.savingsWindows.allTime.totalExpenses')" $LINENO
B_MINS="$(printf '%s' "$DASH_B_BODY" | jq -r '.totalRideMinutes')"
[ "$B_MINS" = "300" ] || cv_fail "expected Rider B totalRideMinutes=300 got ${B_MINS}" $LINENO

# Cleanup
cv_step Cleanup "delete created rides and expenses for both riders" $LINENO
if [ -n "$RIDE_A_ID" ] && [ -n "$USER_A_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_A_ID}" "" 200 -H "X-User-Id: $USER_A_ID"
fi
if [ -n "$EXP_A_ID" ] && [ -n "$USER_A_ID" ]; then
  cv_http DELETE "/api/expenses/${EXP_A_ID}" "" 204 -H "X-User-Id: $USER_A_ID"
fi
if [ -n "$RIDE_B1_ID" ] && [ -n "$USER_B_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_B1_ID}" "" 200 -H "X-User-Id: $USER_B_ID"
fi
if [ -n "$RIDE_B2_ID" ] && [ -n "$USER_B_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_B2_ID}" "" 200 -H "X-User-Id: $USER_B_ID"
fi
if [ -n "$EXP_B_ID" ] && [ -n "$USER_B_ID" ]; then
  cv_http DELETE "/api/expenses/${EXP_B_ID}" "" 204 -H "X-User-Id: $USER_B_ID"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_17"
