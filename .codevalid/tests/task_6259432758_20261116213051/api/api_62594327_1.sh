#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case api_62594327_1: the dashboard (GET /api/dashboard) is the signed-in rider's home and
# returns summary cards (mileage totals, savings, expenses, riding time) plus a mileage-over-time
# chart series and a savings chart series.
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="dash-home-${SUFFIX}"
RIDER_PIN="4821"
RIDE_IDS=()

# Given
cv_step Given "Sign up and sign in a rider, record a ride this month" $LINENO
cv_prereq "POST /api/users/signup" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup got $CV_HTTP_STATUS" $LINENO
RIDER_ID="$(jq -r '.userId' <<<"$CV_HTTP_BODY")"
[ -n "$RIDER_ID" ] && [ "$RIDER_ID" != "null" ] || cv_fail "expected userId in signup response got none" $LINENO

cv_prereq "POST /api/users/identify (sign in)" $LINENO
cv_http POST /api/users/identify "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 from identify got $CV_HTTP_STATUS" $LINENO
[ "$(jq -r '.authorized' <<<"$CV_HTTP_BODY")" = "true" ] || cv_fail "expected authorized=true got $CV_HTTP_BODY" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

RIDE_DT="$(date +%Y-%m-01T08:00:00)"
cv_prereq "POST /api/rides (ride this month)" $LINENO
cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${RIDE_DT}\",\"miles\":7.5,\"rideMinutes\":30,\"weatherUserOverridden\":false}" "${AUTH[@]}"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from record ride got $CV_HTTP_STATUS" $LINENO
RIDE_IDS+=("$(jq -r '.rideId' <<<"$CV_HTTP_BODY")")

# When
cv_step When "Signed-in rider opens the dashboard home (GET /api/dashboard)" $LINENO
cv_http GET /api/dashboard "${AUTH[@]}"
DASH_STATUS="$CV_HTTP_STATUS"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "Dashboard returns summary cards, a mileage-over-time chart and a savings chart" $LINENO
[ "$DASH_STATUS" = "200" ] || cv_fail "expected 200 from GET /api/dashboard got $DASH_STATUS" $LINENO
jq -e . >/dev/null 2>&1 <<<"$DASH_BODY" || cv_fail "expected JSON dashboard body got non-JSON" $LINENO
for path in '.totals.currentMonthMiles.miles' '.totals.yearToDateMiles.miles' '.totals.allTimeMiles.miles' \
            '.totals.moneySaved' '.totals.expenseSummary' '.totals.totalRideMinutes' '.averages'; do
  jq -e "${path} != null" >/dev/null <<<"$DASH_BODY" || cv_fail "expected summary card field ${path} got missing" $LINENO
done
jq -e '.totals.moneySaved | has("mileageRateSavings") and has("fuelCostAvoided")' >/dev/null <<<"$DASH_BODY" \
  || cv_fail "expected split savings fields mileageRateSavings/fuelCostAvoided got $(jq -c '.totals.moneySaved' <<<"$DASH_BODY")" $LINENO
jq -e '.totals.moneySaved | has("combinedSavings") | not' >/dev/null <<<"$DASH_BODY" \
  || cv_fail "expected combinedSavings removed from moneySaved got present" $LINENO
jq -e '(.charts.mileageByMonth | type) == "array" and (.charts.mileageByMonth | length) >= 1' >/dev/null <<<"$DASH_BODY" \
  || cv_fail "expected non-empty mileage-over-time chart got $(jq -c '.charts.mileageByMonth' <<<"$DASH_BODY")" $LINENO
jq -e '(.charts.savingsByMonth | type) == "array" and (.charts.savingsByMonth | length) >= 1' >/dev/null <<<"$DASH_BODY" \
  || cv_fail "expected non-empty savings chart got $(jq -c '.charts.savingsByMonth' <<<"$DASH_BODY")" $LINENO
MONTH_KEY="$(date +%Y-%m)"
CHART_MILES="$(jq -r --arg k "$MONTH_KEY" '[.charts.mileageByMonth[] | select(.monthKey == $k) | .miles] | first // "none"' <<<"$DASH_BODY")"
awk -v m="$CHART_MILES" 'BEGIN{exit !(m+0 == 7.5)}' || cv_fail "expected mileage chart ${MONTH_KEY} = 7.5 got ${CHART_MILES}" $LINENO
MONTH_MILES="$(jq -r '.totals.currentMonthMiles.miles' <<<"$DASH_BODY")"
awk -v m="$MONTH_MILES" 'BEGIN{exit !(m+0 == 7.5)}' || cv_fail "expected currentMonthMiles 7.5 got ${MONTH_MILES}" $LINENO

# Cleanup
cv_step Cleanup "Delete the rides this case recorded" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  [ -n "$rid" ] && [ "$rid" != "null" ] && cv_http DELETE "/api/rides/${rid}" "${AUTH[@]}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_62594327_1"
