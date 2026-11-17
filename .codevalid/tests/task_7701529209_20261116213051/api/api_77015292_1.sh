#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case: api_77015292_1 - Rider views own ride history with tiles and grid
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="HistTiles-${SUFFIX}"
OTHER_NAME="HistOther-${SUFFIX}"
PIN="1234"
RIDE_IDS=()
OTHER_RIDE_IDS=()

# Numeric comparison of decimals (jq handles number formatting)
num_eq() { jq -n --argjson a "$1" --argjson b "$2" '($a - $b) | fabs < 0.0001' | grep -q true; }

# Given
cv_step Given "Sign up rider with rides this month, earlier this year and in a previous year, plus another rider" $LINENO
cv_prereq "Sign up the rider and a second rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${PIN}\"}" 201
RIDER_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')
[[ "$RIDER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId got '${RIDER_ID}'" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${OTHER_NAME}\",\"pin\":\"${PIN}\"}" 201
OTHER_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')
[[ "$OTHER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId for other rider got '${OTHER_ID}'" $LINENO

YEAR=$(date +%Y)
MONTH=$(date +%m)
TODAY=$(date +%Y-%m-%d)
PREV_YEAR=$((YEAR - 1))

cv_prereq "Record a ride this month (with duration and temperature)" $LINENO
cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${TODAY}T00:00:05\",\"miles\":5.5,\"rideMinutes\":30,\"temperature\":61.5,\"weatherUserOverridden\":true}" 201 -H "X-User-Id: ${RIDER_ID}"
MONTH_RIDE_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')
[[ "$MONTH_RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected rideId for this-month ride got '${MONTH_RIDE_ID}'" $LINENO
RIDE_IDS+=("$MONTH_RIDE_ID")

EXPECT_MONTH=5.5
EXPECT_YEAR=5.5
EXPECT_COUNT=2
EARLIER_RIDE_ID=""
if [ "$MONTH" != "01" ]; then
  cv_prereq "Record a ride earlier this year (Jan 15, no duration or temperature)" $LINENO
  cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${YEAR}-01-15T08:00:00\",\"miles\":7.25,\"weatherUserOverridden\":true}" 201 -H "X-User-Id: ${RIDER_ID}"
  EARLIER_RIDE_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')
  [[ "$EARLIER_RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected rideId for earlier-this-year ride got '${EARLIER_RIDE_ID}'" $LINENO
  RIDE_IDS+=("$EARLIER_RIDE_ID")
  EXPECT_YEAR=12.75
  EXPECT_COUNT=3
fi

cv_prereq "Record a ride in a previous year (with duration only)" $LINENO
cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${PREV_YEAR}-06-15T17:30:00\",\"miles\":10,\"rideMinutes\":55,\"weatherUserOverridden\":true}" 201 -H "X-User-Id: ${RIDER_ID}"
PREV_RIDE_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')
[[ "$PREV_RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected rideId for previous-year ride got '${PREV_RIDE_ID}'" $LINENO
RIDE_IDS+=("$PREV_RIDE_ID")
EXPECT_ALL=$(jq -n --argjson y "$EXPECT_YEAR" '$y + 10')

cv_prereq "Record a previous-year ride for the other rider (must not be counted for the rider)" $LINENO
cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${PREV_YEAR}-03-10T07:00:00\",\"miles\":99,\"rideMinutes\":10,\"weatherUserOverridden\":true}" 201 -H "X-User-Id: ${OTHER_ID}"
OTHER_RIDE_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')
[[ "$OTHER_RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected rideId for other rider got '${OTHER_RIDE_ID}'" $LINENO
OTHER_RIDE_IDS+=("$OTHER_RIDE_ID")

# When
cv_step When "Rider opens History (GET /api/rides/history)" $LINENO
cv_http GET /api/rides/history 200 -H "X-User-Id: ${RIDER_ID}"
HIST="$CV_HTTP_BODY"

# Then
cv_step Then "Tiles show month/year/all-time miles and the grid lists all own rides with recorded fields" $LINENO
TM=$(printf '%s' "$HIST" | jq '.summaries.thisMonth.miles')
TY=$(printf '%s' "$HIST" | jq '.summaries.thisYear.miles')
TA=$(printf '%s' "$HIST" | jq '.summaries.allTime.miles')
num_eq "$TM" "$EXPECT_MONTH" || cv_fail "expected thisMonth miles ${EXPECT_MONTH} got ${TM}" $LINENO
num_eq "$TY" "$EXPECT_YEAR" || cv_fail "expected thisYear miles ${EXPECT_YEAR} got ${TY}" $LINENO
num_eq "$TA" "$EXPECT_ALL" || cv_fail "expected allTime miles ${EXPECT_ALL} got ${TA}" $LINENO

# Each tile is identified by its own period id (icon ids thisMonth / thisYear / allTime)
P_TM=$(printf '%s' "$HIST" | jq -r '.summaries.thisMonth.period')
P_TY=$(printf '%s' "$HIST" | jq -r '.summaries.thisYear.period')
P_TA=$(printf '%s' "$HIST" | jq -r '.summaries.allTime.period')
[ "$P_TM" = "thisMonth" ] || cv_fail "expected thisMonth tile period 'thisMonth' got '${P_TM}'" $LINENO
[ "$P_TY" = "thisYear" ] || cv_fail "expected thisYear tile period 'thisYear' got '${P_TY}'" $LINENO
[ "$P_TA" = "allTime" ] || cv_fail "expected allTime tile period 'allTime' got '${P_TA}'" $LINENO

COUNT=$(printf '%s' "$HIST" | jq '.rides | length')
[ "$COUNT" -eq "$EXPECT_COUNT" ] || cv_fail "expected ${EXPECT_COUNT} rides in grid got ${COUNT}" $LINENO
TOTAL_ROWS=$(printf '%s' "$HIST" | jq '.totalRows')
[ "$TOTAL_ROWS" -eq "$EXPECT_COUNT" ] || cv_fail "expected totalRows ${EXPECT_COUNT} got ${TOTAL_ROWS}" $LINENO

# Other rider's ride is not in the grid
if printf '%s' "$HIST" | jq -e --argjson id "$OTHER_RIDE_ID" '.rides[] | select(.rideId == $id)' >/dev/null; then
  cv_fail "expected other rider's ride ${OTHER_RIDE_ID} absent from grid but it was listed" $LINENO
fi

# Every row has a date and miles
BAD=$(printf '%s' "$HIST" | jq '[.rides[] | select(.rideDateTimeLocal == null or .miles == null)] | length')
[ "$BAD" -eq 0 ] || cv_fail "expected every row to have rideDateTimeLocal and miles, ${BAD} rows missing" $LINENO

row() { printf '%s' "$HIST" | jq -c --argjson id "$1" '.rides[] | select(.rideId == $id)'; }

R=$(row "$MONTH_RIDE_ID")
[ -n "$R" ] || cv_fail "expected this-month ride ${MONTH_RIDE_ID} in grid, not found" $LINENO
num_eq "$(printf '%s' "$R" | jq '.miles')" 5.5 || cv_fail "expected this-month ride miles 5.5 got $(printf '%s' "$R" | jq '.miles')" $LINENO
[ "$(printf '%s' "$R" | jq '.rideMinutes')" = "30" ] || cv_fail "expected this-month ride rideMinutes 30 got $(printf '%s' "$R" | jq '.rideMinutes')" $LINENO
num_eq "$(printf '%s' "$R" | jq '.temperature')" 61.5 || cv_fail "expected this-month ride temperature 61.5 got $(printf '%s' "$R" | jq '.temperature')" $LINENO
case "$(printf '%s' "$R" | jq -r '.rideDateTimeLocal')" in
  "${TODAY}T00:00:05"*) ;;
  *) cv_fail "expected this-month ride date ${TODAY}T00:00:05 got $(printf '%s' "$R" | jq -r '.rideDateTimeLocal')" $LINENO ;;
esac

if [ -n "$EARLIER_RIDE_ID" ]; then
  R=$(row "$EARLIER_RIDE_ID")
  [ -n "$R" ] || cv_fail "expected earlier-this-year ride ${EARLIER_RIDE_ID} in grid, not found" $LINENO
  num_eq "$(printf '%s' "$R" | jq '.miles')" 7.25 || cv_fail "expected earlier ride miles 7.25 got $(printf '%s' "$R" | jq '.miles')" $LINENO
  [ "$(printf '%s' "$R" | jq '.rideMinutes')" = "null" ] || cv_fail "expected earlier ride rideMinutes null (not recorded) got $(printf '%s' "$R" | jq '.rideMinutes')" $LINENO
  [ "$(printf '%s' "$R" | jq '.temperature')" = "null" ] || cv_fail "expected earlier ride temperature null (not recorded) got $(printf '%s' "$R" | jq '.temperature')" $LINENO
fi

R=$(row "$PREV_RIDE_ID")
[ -n "$R" ] || cv_fail "expected previous-year ride ${PREV_RIDE_ID} in grid, not found" $LINENO
num_eq "$(printf '%s' "$R" | jq '.miles')" 10 || cv_fail "expected previous-year ride miles 10 got $(printf '%s' "$R" | jq '.miles')" $LINENO
[ "$(printf '%s' "$R" | jq '.rideMinutes')" = "55" ] || cv_fail "expected previous-year ride rideMinutes 55 got $(printf '%s' "$R" | jq '.rideMinutes')" $LINENO
[ "$(printf '%s' "$R" | jq '.temperature')" = "null" ] || cv_fail "expected previous-year ride temperature null got $(printf '%s' "$R" | jq '.temperature')" $LINENO

# A rider with no rides this month or this year sees 0 on those tiles
cv_http GET /api/rides/history 200 -H "X-User-Id: ${OTHER_ID}"
OHIST="$CV_HTTP_BODY"
num_eq "$(printf '%s' "$OHIST" | jq '.summaries.thisMonth.miles')" 0 || cv_fail "expected other rider thisMonth 0 got $(printf '%s' "$OHIST" | jq '.summaries.thisMonth.miles')" $LINENO
num_eq "$(printf '%s' "$OHIST" | jq '.summaries.thisYear.miles')" 0 || cv_fail "expected other rider thisYear 0 got $(printf '%s' "$OHIST" | jq '.summaries.thisYear.miles')" $LINENO
num_eq "$(printf '%s' "$OHIST" | jq '.summaries.allTime.miles')" 99 || cv_fail "expected other rider allTime 99 got $(printf '%s' "$OHIST" | jq '.summaries.allTime.miles')" $LINENO

# Cleanup
cv_step Cleanup "Delete rides created by this test" $LINENO
for id in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "X-User-Id: ${RIDER_ID}"
done
for id in "${OTHER_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "X-User-Id: ${OTHER_ID}"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_77015292_1"
