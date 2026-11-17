#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_31266836_1"
SUFFIX="$(date +%s%N)"
RIDER_NAME="yearstats1_${SUFFIX}"
RIDER_PIN="4821"
CUR_YEAR="$(date +%Y)"
PREV_YEAR="$((CUR_YEAR - 1))"
RIDE_IDS=()

record_ride() {
  # $1 = json body
  cv_http POST /api/rides/ "$1" -H "X-User-Id: ${USER_ID}"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 recording ride got ${CV_HTTP_STATUS}: ${CV_HTTP_BODY}" $LINENO
  fi
  RIDE_IDS+=("$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')")
}

# Given
cv_step Given "rider signed up with settings and rides in ${CUR_YEAR} and ${PREV_YEAR}" $LINENO
cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 on signup got ${CV_HTTP_STATUS}" $LINENO
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || cv_fail "expected userId in signup response got ${CV_HTTP_BODY}" $LINENO

cv_prereq "identify rider" $LINENO
cv_http POST /api/users/identify "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 200

cv_prereq "save savings settings" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":25,"mileageRateCents":0.67}' -H "X-User-Id: ${USER_ID}"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 saving settings got ${CV_HTTP_STATUS}: ${CV_HTTP_BODY}" $LINENO

cv_prereq "record rides" $LINENO
record_ride "{\"rideDateTimeLocal\":\"${CUR_YEAR}-01-10T08:00:00\",\"miles\":10,\"rideMinutes\":45,\"gasPricePerGallon\":3.5,\"difficulty\":3,\"primaryTravelDirection\":\"North\",\"windSpeedMph\":12,\"windDirectionDeg\":0,\"weatherUserOverridden\":true}"
record_ride "{\"rideDateTimeLocal\":\"${CUR_YEAR}-02-12T08:00:00\",\"miles\":5,\"rideMinutes\":30,\"gasPricePerGallon\":3.5,\"difficulty\":4,\"primaryTravelDirection\":\"South\",\"windSpeedMph\":8,\"windDirectionDeg\":0,\"weatherUserOverridden\":true}"
record_ride "{\"rideDateTimeLocal\":\"${PREV_YEAR}-06-15T08:00:00\",\"miles\":7,\"rideMinutes\":20,\"difficulty\":2,\"weatherUserOverridden\":true}"

# When
cv_step When "open the year stats dashboard: load selectable years and the preselected year's stats" $LINENO
cv_http GET /api/dashboard/year-stats/years "" -H "X-User-Id: ${USER_ID}"
YEARS_STATUS="$CV_HTTP_STATUS"
YEARS_BODY="$CV_HTTP_BODY"
SELECTED_YEAR="$(printf '%s' "$YEARS_BODY" | jq -r '.years[0] // empty' 2>/dev/null || true)"
[ -n "$SELECTED_YEAR" ] || cv_fail "expected a preselected year in years response got ${YEARS_STATUS}: ${YEARS_BODY}" $LINENO
cv_http GET "/api/dashboard/year-stats?year=${SELECTED_YEAR}" "" -H "X-User-Id: ${USER_ID}"
STATS_STATUS="$CV_HTTP_STATUS"
STATS_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "a year is preselected and every chart and total riding time is populated for it" $LINENO
[ "$YEARS_STATUS" = "200" ] || cv_fail "expected 200 for years got ${YEARS_STATUS}" $LINENO
YEARS_LIST="$(printf '%s' "$YEARS_BODY" | jq -c '.years')"
[ "$YEARS_LIST" = "[${CUR_YEAR},${PREV_YEAR}]" ] || cv_fail "expected years [${CUR_YEAR},${PREV_YEAR}] got ${YEARS_LIST}" $LINENO
[ "$SELECTED_YEAR" = "$CUR_YEAR" ] || cv_fail "expected preselected year ${CUR_YEAR} got ${SELECTED_YEAR}" $LINENO
[ "$STATS_STATUS" = "200" ] || cv_fail "expected 200 for year stats got ${STATS_STATUS}: ${STATS_BODY}" $LINENO

j() { printf '%s' "$STATS_BODY" | jq -r "$1"; }
[ "$(j '.year')" = "$CUR_YEAR" ] || cv_fail "expected year ${CUR_YEAR} got $(j '.year')" $LINENO
[ "$(j '.hasDataForYear')" = "true" ] || cv_fail "expected hasDataForYear true got $(j '.hasDataForYear')" $LINENO
# Mileage trend chart
[ "$(j '.mileageByMonth | length')" -ge 2 ] || cv_fail "expected mileage series to have months got $(j '.mileageByMonth | length')" $LINENO
[ "$(j '[.mileageByMonth[].monthKey | startswith("'"$CUR_YEAR"'")] | all')" = "true" ] || cv_fail "expected all mileage months in ${CUR_YEAR} got $(j '[.mileageByMonth[].monthKey]')" $LINENO
JAN_MILES="$(j '[.mileageByMonth[] | select(.monthKey=="'"$CUR_YEAR"'-01") | .miles][0]')"
FEB_MILES="$(j '[.mileageByMonth[] | select(.monthKey=="'"$CUR_YEAR"'-02") | .miles][0]')"
awk "BEGIN{exit !($JAN_MILES == 10 && $FEB_MILES == 5)}" || cv_fail "expected Jan=10 Feb=5 miles got Jan=${JAN_MILES} Feb=${FEB_MILES}" $LINENO
TOTAL_MILES="$(j '.totals.totalMiles')"
awk "BEGIN{exit !($TOTAL_MILES == 15)}" || cv_fail "expected totalMiles 15 (current year only) got ${TOTAL_MILES}" $LINENO
# Savings chart
[ "$(j '.savingsByMonth | length')" -ge 2 ] || cv_fail "expected savings series got $(j '.savingsByMonth | length')" $LINENO
JAN_SAV="$(j '[.savingsByMonth[] | select(.monthKey=="'"$CUR_YEAR"'-01") | .combinedSavings][0]')"
[ "$JAN_SAV" != "null" ] && awk "BEGIN{exit !($JAN_SAV > 0)}" || cv_fail "expected positive Jan combined savings got ${JAN_SAV}" $LINENO
# Difficulty chart
[ "$(j '.difficulty.hasData')" = "true" ] || cv_fail "expected difficulty.hasData true got $(j '.difficulty.hasData')" $LINENO
[ "$(j '.difficulty.byMonth | length')" -ge 1 ] || cv_fail "expected difficulty byMonth points got $(j '.difficulty.byMonth')" $LINENO
DIFF_AVG="$(j '.difficulty.overallAverageDifficulty')"
awk "BEGIN{exit !($DIFF_AVG == 3.5)}" || cv_fail "expected overall average difficulty 3.5 for ${CUR_YEAR} got ${DIFF_AVG}" $LINENO
# Wind resistance chart
[ "$(j '.windResistance.hasData')" = "true" ] || cv_fail "expected windResistance.hasData true got $(j '.windResistance')" $LINENO
[ "$(j '[.windResistance.bins[].count] | add // 0')" = "2" ] || cv_fail "expected 2 rides in wind bins got $(j '.windResistance.bins')" $LINENO
# Total riding time
[ "$(j '.totals.totalRideMinutes')" = "75" ] || cv_fail "expected totalRideMinutes 75 got $(j '.totals.totalRideMinutes')" $LINENO

# Cleanup
cv_step Cleanup "delete the rider's rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" -H "X-User-Id: ${USER_ID}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_31266836_1"
