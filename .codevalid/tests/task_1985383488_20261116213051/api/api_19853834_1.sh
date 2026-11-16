#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Rider reviews optional metric suggestions and approves only "gallons avoided".
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="cv-suggest-${SUFFIX}"
RIDER_PIN="4821"
RIDE_DATE="$(date -u +%Y-%m-%d)T00:01:00"
RIDE_ID=""
USER_ID=""

auth() { printf 'X-User-Id: %s' "$USER_ID"; }

suggestion_field() {
  # $1 = metricKey, $2 = field; reads from CV_HTTP_BODY
  printf '%s' "$CV_HTTP_BODY" | jq -r --arg k "$1" --arg f "$2" \
    '[.suggestions[] | select(.metricKey == $k)][0][$f] | tostring'
}

# Given
cv_step Given "register rider, save settings, record a ride, and open the suggestion flow" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup, got $CV_HTTP_STATUS" $LINENO
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[[ "$USER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId from signup, got '$USER_ID'" $LINENO

cv_prereq "save rider settings (car mpg 25, yearly goal 1000) with no optional metric approved" $LINENO
cv_http PUT /api/users/me/settings \
  '{"averageCarMpg":25,"yearlyGoalMiles":1000,"mileageRateCents":67,"dashboardGallonsAvoidedEnabled":false,"dashboardGoalProgressEnabled":false}' \
  -H "$(auth)"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 saving settings, got $CV_HTTP_STATUS" $LINENO

cv_prereq "record a 10 mile ride this month" $LINENO
cv_http POST /api/rides \
  "{\"rideDateTimeLocal\":\"${RIDE_DATE}\",\"miles\":10,\"rideMinutes\":40,\"temperature\":60,\"gasPricePerGallon\":3.5,\"weatherUserOverridden\":true}" \
  -H "$(auth)"
case "$CV_HTTP_STATUS" in 200|201) ;; *) cv_fail "expected 200/201 recording ride, got $CV_HTTP_STATUS" $LINENO ;; esac
RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')"
[[ "$RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric rideId, got '$RIDE_ID'" $LINENO

cv_prereq "open suggestion flow: dashboard presents optional suggestions, none enabled yet" $LINENO
cv_http GET /api/dashboard "" 200 -H "$(auth)"
for key in gallonsAvoided goalProgress; do
  present="$(printf '%s' "$CV_HTTP_BODY" | jq --arg k "$key" '[.suggestions[] | select(.metricKey == $k)] | length')"
  [ "$present" = "1" ] || cv_fail "expected suggestion '$key' presented for review, got count $present" $LINENO
  en="$(suggestion_field "$key" isEnabled)"
  [ "$en" = "false" ] || cv_fail "expected '$key' not enabled before rider review, got isEnabled=$en" $LINENO
done

# When
cv_step When "rider approves only the gallons-avoided suggestion" $LINENO
cv_http PUT /api/users/me/settings '{"dashboardGallonsAvoidedEnabled":true}' -H "$(auth)"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 approving gallons avoided, got $CV_HTTP_STATUS" $LINENO

# Then
cv_step Then "dashboard shows all core metrics plus gallons avoided, goal progress stays hidden" $LINENO
cv_http GET /api/dashboard "" 200 -H "$(auth)"
B="$CV_HTTP_BODY"
check() { # $1 jq expr, $2 expected, $3 label
  local got
  got="$(printf '%s' "$B" | jq -r "$1 | tostring")"
  [ "$got" = "$2" ] || cv_fail "expected $3 = $2, got $got" "$4"
}
check '.totals.currentMonthMiles.miles' "10" "current-month miles" $LINENO
check '.totals.yearToDateMiles.miles' "10" "year-to-date miles" $LINENO
check '.totals.allTimeMiles.miles' "10" "all-time miles" $LINENO
check '.totals.moneySaved.mileageRateSavings != null' "true" "mileage-rate savings present" $LINENO
check '.totals.moneySaved.fuelCostAvoided != null' "true" "fuel-economy savings present" $LINENO
check '.averages.averageTemperature' "60" "average temperature" $LINENO
check '.averages.averageMilesPerRide' "10" "average miles per ride" $LINENO
check '.averages.averageRideMinutes' "40" "average ride duration" $LINENO

GA_EN="$(suggestion_field gallonsAvoided isEnabled)"
[ "$GA_EN" = "true" ] || cv_fail "expected approved gallonsAvoided isEnabled=true, got $GA_EN" $LINENO
GA_VAL="$(suggestion_field gallonsAvoided value)"
[ "$GA_VAL" = "0.4" ] || cv_fail "expected gallonsAvoided value 0.4 (10 mi / 25 mpg), got $GA_VAL" $LINENO
GP_EN="$(suggestion_field goalProgress isEnabled)"
[ "$GP_EN" = "false" ] || cv_fail "expected unapproved goalProgress hidden (isEnabled=false), got $GP_EN" $LINENO

cv_prereq "settings read back reflect per-metric approval" $LINENO
cv_http GET /api/users/me/settings "" 200 -H "$(auth)"
S_GA="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.dashboardGallonsAvoidedEnabled')"
S_GP="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.dashboardGoalProgressEnabled')"
[ "$S_GA" = "true" ] || cv_fail "expected settings dashboardGallonsAvoidedEnabled=true, got $S_GA" $LINENO
[ "$S_GP" = "false" ] || cv_fail "expected settings dashboardGoalProgressEnabled=false, got $S_GP" $LINENO

# Cleanup
cv_step Cleanup "delete the recorded ride and reset optional metric approvals" $LINENO
if [ -n "$RIDE_ID" ]; then
  cv_http DELETE "/api/rides/${RIDE_ID}" -H "$(auth)" || true
fi
cv_http PUT /api/users/me/settings '{"dashboardGallonsAvoidedEnabled":false,"dashboardGoalProgressEnabled":false}' -H "$(auth)" || true
echo "No user-delete endpoint exists; rider ${RIDER_NAME} remains (unique name)."

echo "CODEVALID_TEST_ASSERTION_OK:api_19853834_1"
