#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_31266836_6"
SUFFIX="$(date +%s%N)"
RIDER_NAME="yearstats6_${SUFFIX}"
RIDER_PIN="5937"
CUR_YEAR="$(date +%Y)"
PREV_YEAR="$((CUR_YEAR - 1))"
RIDE_IDS=()

record_ride() {
  cv_http POST /api/rides/ "$1" -H "X-User-Id: ${USER_ID}"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 recording ride got ${CV_HTTP_STATUS}: ${CV_HTTP_BODY}" $LINENO
  fi
  RIDE_IDS+=("$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')")
}

# Given
cv_step Given "rider with distinct rides in ${CUR_YEAR} and ${PREV_YEAR}, dashboard open on ${CUR_YEAR}" $LINENO
cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 on signup got ${CV_HTTP_STATUS}" $LINENO
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] || cv_fail "expected userId in signup response got ${CV_HTTP_BODY}" $LINENO

cv_prereq "save savings settings" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":25,"mileageRateCents":0.67}' -H "X-User-Id: ${USER_ID}"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 saving settings got ${CV_HTTP_STATUS}: ${CV_HTTP_BODY}" $LINENO

cv_prereq "record rides in both years" $LINENO
record_ride "{\"rideDateTimeLocal\":\"${CUR_YEAR}-01-10T08:00:00\",\"miles\":10,\"rideMinutes\":45,\"gasPricePerGallon\":3.5,\"difficulty\":3,\"primaryTravelDirection\":\"North\",\"windSpeedMph\":12,\"windDirectionDeg\":0,\"weatherUserOverridden\":true}"
record_ride "{\"rideDateTimeLocal\":\"${PREV_YEAR}-03-05T08:00:00\",\"miles\":8,\"rideMinutes\":90,\"gasPricePerGallon\":3.0,\"difficulty\":5,\"primaryTravelDirection\":\"East\",\"windSpeedMph\":15,\"windDirectionDeg\":90,\"weatherUserOverridden\":true}"
record_ride "{\"rideDateTimeLocal\":\"${PREV_YEAR}-07-20T08:00:00\",\"miles\":12,\"rideMinutes\":55,\"gasPricePerGallon\":3.2,\"difficulty\":4,\"primaryTravelDirection\":\"West\",\"windSpeedMph\":5,\"windDirectionDeg\":90,\"weatherUserOverridden\":true}"

cv_prereq "dashboard initially shows ${CUR_YEAR}" $LINENO
cv_http GET /api/dashboard/year-stats/years "" 200 -H "X-User-Id: ${USER_ID}"
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -c '.years')" = "[${CUR_YEAR},${PREV_YEAR}]" ] || cv_fail "expected years [${CUR_YEAR},${PREV_YEAR}] got ${CV_HTTP_BODY}" $LINENO
cv_http GET "/api/dashboard/year-stats?year=${CUR_YEAR}" "" 200 -H "X-User-Id: ${USER_ID}"
INITIAL_MILES="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.totals.totalMiles')"
awk "BEGIN{exit !($INITIAL_MILES == 10)}" || cv_fail "expected initial ${CUR_YEAR} totalMiles 10 got ${INITIAL_MILES}" $LINENO

# When
cv_step When "switch the selector to ${PREV_YEAR}" $LINENO
cv_http GET "/api/dashboard/year-stats?year=${PREV_YEAR}" "" -H "X-User-Id: ${USER_ID}"
SWITCH_STATUS="$CV_HTTP_STATUS"
SWITCH_BODY="$CV_HTTP_BODY"
SWITCH_MS="$CV_HTTP_MS"

# Then
cv_step Then "one in-place response under 2s carries all charts and total riding time for ${PREV_YEAR}" $LINENO
[ "$SWITCH_STATUS" = "200" ] || cv_fail "expected 200 for ${PREV_YEAR} stats got ${SWITCH_STATUS}: ${SWITCH_BODY}" $LINENO
[ "$SWITCH_MS" -lt 2000 ] || cv_fail "expected year switch response under 2000ms got ${SWITCH_MS}ms" $LINENO
j() { printf '%s' "$SWITCH_BODY" | jq -r "$1"; }
[ "$(j '.year')" = "$PREV_YEAR" ] || cv_fail "expected year ${PREV_YEAR} got $(j '.year')" $LINENO
[ "$(j '.hasDataForYear')" = "true" ] || cv_fail "expected hasDataForYear true got $(j '.hasDataForYear')" $LINENO
# Mileage trend
[ "$(j '[.mileageByMonth[].monthKey | startswith("'"$PREV_YEAR"'")] | all')" = "true" ] || cv_fail "expected mileage months all in ${PREV_YEAR} got $(j '[.mileageByMonth[].monthKey]')" $LINENO
MAR="$(j '[.mileageByMonth[] | select(.monthKey=="'"$PREV_YEAR"'-03") | .miles][0]')"
JUL="$(j '[.mileageByMonth[] | select(.monthKey=="'"$PREV_YEAR"'-07") | .miles][0]')"
awk "BEGIN{exit !($MAR == 8 && $JUL == 12)}" || cv_fail "expected Mar=8 Jul=12 miles got Mar=${MAR} Jul=${JUL}" $LINENO
TOTAL_MILES="$(j '.totals.totalMiles')"
awk "BEGIN{exit !($TOTAL_MILES == 20)}" || cv_fail "expected totalMiles 20 for ${PREV_YEAR} got ${TOTAL_MILES}" $LINENO
# Savings
[ "$(j '[.savingsByMonth[].monthKey | startswith("'"$PREV_YEAR"'")] | all')" = "true" ] || cv_fail "expected savings months all in ${PREV_YEAR} got $(j '[.savingsByMonth[].monthKey]')" $LINENO
MAR_SAV="$(j '[.savingsByMonth[] | select(.monthKey=="'"$PREV_YEAR"'-03") | .combinedSavings][0]')"
JUL_SAV="$(j '[.savingsByMonth[] | select(.monthKey=="'"$PREV_YEAR"'-07") | .combinedSavings][0]')"
[ "$MAR_SAV" != "null" ] && [ "$JUL_SAV" != "null" ] && awk "BEGIN{exit !($MAR_SAV > 0 && $JUL_SAV > 0)}" || cv_fail "expected positive Mar/Jul savings got Mar=${MAR_SAV} Jul=${JUL_SAV}" $LINENO
# Difficulty
[ "$(j '.difficulty.hasData')" = "true" ] || cv_fail "expected difficulty.hasData true got $(j '.difficulty')" $LINENO
DIFF_AVG="$(j '.difficulty.overallAverageDifficulty')"
awk "BEGIN{exit !($DIFF_AVG == 4.5)}" || cv_fail "expected ${PREV_YEAR} average difficulty 4.5 got ${DIFF_AVG}" $LINENO
[ "$(j '[.difficulty.byMonth[].monthKey | startswith("'"$PREV_YEAR"'")] | all')" = "true" ] || cv_fail "expected difficulty months in ${PREV_YEAR} got $(j '[.difficulty.byMonth[].monthKey]')" $LINENO
# Wind resistance
[ "$(j '.windResistance.hasData')" = "true" ] || cv_fail "expected windResistance.hasData true got $(j '.windResistance')" $LINENO
[ "$(j '[.windResistance.bins[].count] | add // 0')" = "2" ] || cv_fail "expected 2 rides in ${PREV_YEAR} wind bins got $(j '.windResistance.bins')" $LINENO
# Total riding time
[ "$(j '.totals.totalRideMinutes')" = "145" ] || cv_fail "expected totalRideMinutes 145 for ${PREV_YEAR} got $(j '.totals.totalRideMinutes')" $LINENO

# Cleanup
cv_step Cleanup "delete the rider's rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" -H "X-User-Id: ${USER_ID}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_31266836_6"
