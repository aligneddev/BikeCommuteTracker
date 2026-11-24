#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Scenario api_17531482_1: weekly, monthly, yearly and all-time windows each show
# money saved (fuelCostAvoided), mileage-rate savings and gallons saved, computed only
# from that window's rides (distance, configured MPG, ride-date gas price, mileage rate).
BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_17531482_1"
SUFFIX="$(date +%s%N)"
MPG="25"
RATE="0.5"   # mileageRateCents setting; savings = miles x configured rate
RIDE_IDS=()

# Dates (container local time, same clock as the app). Windows: week starts Monday.
TODAY="$(date +%Y-%m-%d)"
DOW="$(date +%u)"
WEEK_START="$(date -d "$TODAY -$((DOW - 1)) days" +%Y-%m-%d)"
MONTH_START="$(date +%Y-%m-01)"
YEAR_START="$(date +%Y-01-01)"
PREV_YEAR_DATE="$(( $(date +%Y) - 1 ))-06-15"

# Per-window expected sums: gallons, fuel, mileage
declare -A EXP_GAL EXP_FUEL EXP_MR EXP_COUNT
for w in weekly monthly yearly allTime; do EXP_GAL[$w]=0; EXP_FUEL[$w]=0; EXP_MR[$w]=0; EXP_COUNT[$w]=0; done

add_expected() { # window miles gas
  local w=$1 m=$2 g=$3
  EXP_GAL[$w]=$(awk -v a="${EXP_GAL[$w]}" -v m="$m" -v p="$MPG" 'BEGIN{printf "%.6f", a + m/p}')
  EXP_FUEL[$w]=$(awk -v a="${EXP_FUEL[$w]}" -v m="$m" -v p="$MPG" -v g="$g" 'BEGIN{printf "%.6f", a + m/p*g}')
  EXP_MR[$w]=$(awk -v a="${EXP_MR[$w]}" -v m="$m" -v r="$RATE" 'BEGIN{printf "%.6f", a + m*r}')
  EXP_COUNT[$w]=$(( ${EXP_COUNT[$w]} + 1 ))
}

record_ride() { # datetime miles gas
  local body
  body=$(jq -nc --arg dt "$1" --argjson mi "$2" --argjson gp "$3" \
    '{rideDateTimeLocal:$dt, miles:$mi, rideMinutes:30, gasPricePerGallon:$gp, weatherUserOverridden:true}')
  cv_http POST /api/rides "$body" 201 -H "X-User-Id: ${USER_ID}"
  local id
  id=$(jq -r '.rideId // empty' <<<"$CV_HTTP_BODY")
  [ -n "$id" ] || cv_fail "expected rideId in ride response got: $CV_HTTP_BODY" $LINENO
  RIDE_IDS+=("$id")
  # classify into windows (same calendar rules as the feature)
  local d="${1%%T*}"
  add_expected allTime "$2" "$3"
  if [[ ! "$d" < "$YEAR_START" ]]; then add_expected yearly "$2" "$3"; fi
  if [[ ! "$d" < "$MONTH_START" ]]; then add_expected monthly "$2" "$3"; fi
  if [[ ! "$d" < "$WEEK_START" ]]; then add_expected weekly "$2" "$3"; fi
}

near() { awk -v a="$1" -v b="$2" 'BEGIN{d=a-b; if(d<0)d=-d; exit !(d<=0.011)}'; }

# Given
cv_step Given "Rider with MPG, mileage rate and gas prices records rides this week, this month, this year and prior year" $LINENO
cv_prereq "signup rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "WinRider${SUFFIX}" '{name:$n, pin:"1234"}')" 201
USER_ID=$(jq -r '.userId // empty' <<<"$CV_HTTP_BODY")
[ -n "$USER_ID" ] || cv_fail "expected userId from signup got: $CV_HTTP_BODY" $LINENO

cv_prereq "set MPG and mileage rate" $LINENO
cv_http PUT /api/users/me/settings \
  "$(jq -nc --argjson mpg "$MPG" --argjson r "$RATE" '{averageCarMpg:$mpg, yearlyGoalMiles:null, oilChangePrice:null, mileageRateCents:$r, locationLabel:null, latitude:null, longitude:null}')" \
  200 -H "X-User-Id: ${USER_ID}"

cv_prereq "ride this week (today)" $LINENO
record_ride "${TODAY}T00:05:00" 10 3.00
if [[ "$MONTH_START" < "$WEEK_START" ]]; then
  cv_prereq "ride earlier this month, before this week" $LINENO
  record_ride "${MONTH_START}T08:00:00" 5 4.00
else
  cv_fail "expected a date earlier this month outside this week got none (week starts $WEEK_START, month starts $MONTH_START)" $LINENO
fi
if [[ "$YEAR_START" < "$MONTH_START" && "$YEAR_START" < "$WEEK_START" ]]; then
  cv_prereq "ride earlier this year, before this month" $LINENO
  record_ride "${YEAR_START}T08:00:00" 20 2.50
else
  cv_fail "expected a date earlier this year outside this month got none (month starts $MONTH_START)" $LINENO
fi
cv_prereq "ride in prior year" $LINENO
record_ride "${PREV_YEAR_DATE}T08:00:00" 50 3.50

# When
cv_step When "Open the advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: ${USER_ID}"
DASH="$CV_HTTP_BODY"

# Then
cv_step Then "Each window shows money saved, mileage-rate savings and gallons saved from only its own rides" $LINENO
for w in weekly monthly yearly allTime; do
  WIN=$(jq -c --arg w "$w" '.savingsWindows[$w] // empty' <<<"$DASH")
  [ -n "$WIN" ] || cv_fail "expected savingsWindows.$w in response got none" $LINENO
  for f in fuelCostAvoided mileageRateSavings gallonsSaved; do
    v=$(jq -r --arg f "$f" '.[$f] | if type=="number" then tostring else "null" end' <<<"$WIN")
    [ "$v" != "null" ] || cv_fail "expected $w.$f to be a number got null ($WIN)" $LINENO
  done
  rc=$(jq -r '.rideCount' <<<"$WIN")
  [ "$rc" = "${EXP_COUNT[$w]}" ] || cv_fail "expected $w.rideCount ${EXP_COUNT[$w]} got $rc" $LINENO
  g=$(jq -r '.gallonsSaved' <<<"$WIN"); f=$(jq -r '.fuelCostAvoided' <<<"$WIN"); m=$(jq -r '.mileageRateSavings' <<<"$WIN")
  near "$g" "${EXP_GAL[$w]}" || cv_fail "expected $w.gallonsSaved ${EXP_GAL[$w]} got $g" $LINENO
  near "$f" "${EXP_FUEL[$w]}" || cv_fail "expected $w.fuelCostAvoided ${EXP_FUEL[$w]} got $f" $LINENO
  near "$m" "${EXP_MR[$w]}" || cv_fail "expected $w.mileageRateSavings ${EXP_MR[$w]} got $m" $LINENO
  est=$(jq -r '.fuelCostEstimated' <<<"$WIN")
  [ "$est" = "false" ] || cv_fail "expected $w.fuelCostEstimated false (all rides have ride-date gas price) got $est" $LINENO
done

# Cleanup
cv_step Cleanup "Delete the rides created by this test" $LINENO
for id in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "X-User-Id: ${USER_ID}"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_1"
