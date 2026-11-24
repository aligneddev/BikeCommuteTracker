#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Scenario api_17531482_6: monthly NetSavings = FuelCostAvoided + MileageRateSavings
# + OilChangeSavings - TotalExpenses (month's bike expenses).
BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_17531482_6"
SUFFIX="$(date +%s%N)"
MPG="25"
RATE="0.5"
OIL="40"
RIDE_IDS=()
EXPENSE_IDS=()
TODAY="$(date +%Y-%m-%d)"
PREV_YEAR="$(( $(date +%Y) - 1 ))"

record_ride() { # datetime miles gas
  local body id
  body=$(jq -nc --arg dt "$1" --argjson mi "$2" --argjson gp "$3" \
    '{rideDateTimeLocal:$dt, miles:$mi, rideMinutes:60, gasPricePerGallon:$gp, weatherUserOverridden:true}')
  cv_http POST /api/rides "$body" 201 -H "X-User-Id: ${USER_ID}"
  id=$(jq -r '.rideId // empty' <<<"$CV_HTTP_BODY")
  [ -n "$id" ] || cv_fail "expected rideId in ride response got: $CV_HTTP_BODY" $LINENO
  RIDE_IDS+=("$id")
}

record_expense() { # date amount
  local id
  cv_http POST /api/expenses 201 -H "X-User-Id: ${USER_ID}" -F "expenseDate=$1" -F "amount=$2" -F "notes=chain $SUFFIX"
  id=$(jq -r '.expenseId // empty' <<<"$CV_HTTP_BODY")
  [ -n "$id" ] || cv_fail "expected expenseId in expense response got: $CV_HTTP_BODY" $LINENO
  EXPENSE_IDS+=("$id")
}

near() { awk -v a="$1" -v b="$2" 'BEGIN{d=a-b; if(d<0)d=-d; exit !(d<=0.011)}'; }

# Given
cv_step Given "Rider with MPG, mileage rate, oil-change price, 2800 prior miles, a 200-mile ride and an expense this month" $LINENO
cv_prereq "signup rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "NetRider${SUFFIX}" '{name:$n, pin:"1234"}')" 201
USER_ID=$(jq -r '.userId // empty' <<<"$CV_HTTP_BODY")
[ -n "$USER_ID" ] || cv_fail "expected userId from signup got: $CV_HTTP_BODY" $LINENO

cv_prereq "set MPG, mileage rate and oil-change price" $LINENO
cv_http PUT /api/users/me/settings \
  "$(jq -nc --argjson mpg "$MPG" --argjson r "$RATE" --argjson o "$OIL" '{averageCarMpg:$mpg, yearlyGoalMiles:null, oilChangePrice:$o, mileageRateCents:$r, locationLabel:null, latitude:null, longitude:null}')" \
  200 -H "X-User-Id: ${USER_ID}"

cv_prereq "14 prior-year rides of 200 miles (2800 cumulative miles before this month)" $LINENO
for i in $(seq 1 14); do
  record_ride "${PREV_YEAR}-03-$(printf '%02d' "$i")T08:00:00" 200 3.00
done
cv_prereq "200-mile ride this month crossing the 3000-mile oil-change interval" $LINENO
record_ride "${TODAY}T00:05:00" 200 3.00
cv_prereq "bike expense dated this month" $LINENO
record_expense "$TODAY" "30.50"

# When
cv_step When "Open the advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: ${USER_ID}"
DASH="$CV_HTTP_BODY"

# Then
cv_step Then "Monthly net savings equals fuel + mileage-rate + oil-change savings minus the month's expenses" $LINENO
WIN=$(jq -c '.savingsWindows.monthly // empty' <<<"$DASH")
[ -n "$WIN" ] || cv_fail "expected savingsWindows.monthly got none" $LINENO
FUEL=$(jq -r '.fuelCostAvoided' <<<"$WIN")
MR=$(jq -r '.mileageRateSavings' <<<"$WIN")
OILS=$(jq -r '.oilChangeSavings' <<<"$WIN")
EXP=$(jq -r '.totalExpenses' <<<"$WIN")
NET=$(jq -r '.netSavings' <<<"$WIN")
for pair in "fuelCostAvoided:$FUEL:24" "mileageRateSavings:$MR:100" "oilChangeSavings:$OILS:40" "totalExpenses:$EXP:30.50"; do
  IFS=: read -r name got want <<<"$pair"
  [ "$got" != "null" ] || cv_fail "expected monthly.$name $want got null" $LINENO
  near "$got" "$want" || cv_fail "expected monthly.$name $want got $got" $LINENO
done
[ "$NET" != "null" ] || cv_fail "expected monthly.netSavings 133.50 got null" $LINENO
FORMULA=$(awk -v f="$FUEL" -v m="$MR" -v o="$OILS" -v e="$EXP" 'BEGIN{printf "%.2f", f+m+o-e}')
near "$NET" "$FORMULA" || cv_fail "expected monthly.netSavings = fuel $FUEL + mileage $MR + oil $OILS - expenses $EXP = $FORMULA got $NET" $LINENO
near "$NET" "133.50" || cv_fail "expected monthly.netSavings 133.50 got $NET" $LINENO

# Cleanup
cv_step Cleanup "Delete the expense and rides created by this test" $LINENO
for id in "${EXPENSE_IDS[@]}"; do
  cv_http DELETE "/api/expenses/${id}" -H "X-User-Id: ${USER_ID}"
done
for id in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "X-User-Id: ${USER_ID}"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_6"
