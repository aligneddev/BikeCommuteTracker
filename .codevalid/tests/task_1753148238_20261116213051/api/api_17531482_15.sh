#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
RIDER_NAME="WindDiffRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_IDS=()

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider and record one ride with no stored difficulty and +3 wind resistance rating, and one ride with stored difficulty 2" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "record April ride with no stored difficulty and 15 mph direct headwind (North, 0 deg -> windResistanceRating=+3 -> derived difficulty=5)" $LINENO
RIDE1_BODY='{"rideDateTimeLocal":"2025-04-10T08:00:00","miles":12,"primaryTravelDirection":"North","windSpeedMph":15,"windDirectionDeg":0,"weatherUserOverridden":true}'
cv_http POST /api/rides "$RIDE1_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE1_ID" ] || cv_fail "ride 1 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE1_ID")

cv_prereq "confirm ride 1 stored difficulty is null and windResistanceRating is +3" $LINENO
cv_http GET /api/rides/history "" 200 -H "X-User-Id: $USER_ID"
RIDE1_DIFF="$(printf '%s' "$CV_HTTP_BODY" | jq -r --argjson id "$RIDE1_ID" '.rides[] | select(.rideId == $id) | .difficulty')"
RIDE1_WIND="$(printf '%s' "$CV_HTTP_BODY" | jq -r --argjson id "$RIDE1_ID" '.rides[] | select(.rideId == $id) | .windResistanceRating')"
[ "$RIDE1_DIFF" = "null" ] || cv_fail "expected ride 1 stored difficulty to be null, got ${RIDE1_DIFF}" $LINENO
[ "$RIDE1_WIND" = "3" ] || cv_fail "expected ride 1 windResistanceRating to be 3, got ${RIDE1_WIND}" $LINENO

cv_prereq "record August ride with stored difficulty 2" $LINENO
RIDE2_BODY='{"rideDateTimeLocal":"2025-08-10T08:00:00","miles":10,"difficulty":2}'
cv_http POST /api/rides "$RIDE2_BODY" 201 -H "X-User-Id: $USER_ID"
RIDE2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE2_ID" ] || cv_fail "ride 2 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE2_ID")

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify April uses derived difficulty 5 (from +3 wind rating), August uses stored difficulty 2, and overall average is 3.5" $LINENO

IS_EMPTY="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.isEmpty')"
[ "$IS_EMPTY" = "false" ] || cv_fail "expected difficultySection.isEmpty to be false, got ${IS_EMPTY}" $LINENO

MONTH_COUNT="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.difficultyByMonth | length')"
[ "$MONTH_COUNT" = "2" ] || cv_fail "expected exactly 2 months in difficultyByMonth (April and August), got ${MONTH_COUNT}" $LINENO

APRIL_JSON="$(printf '%s' "$DASH_BODY" | jq -c '.difficultySection.difficultyByMonth[] | select(.monthNumber == 4)')"
[ -n "$APRIL_JSON" ] || cv_fail "expected April (monthNumber 4) in difficultyByMonth" $LINENO
check_num_close "$APRIL_JSON" '.averageDifficulty' 5.0 0.1 \
  || cv_fail "expected April averageDifficulty=5.0 (derived from +3 wind rating) got $(printf '%s' "$APRIL_JSON" | jq -r '.averageDifficulty')" $LINENO

AUGUST_JSON="$(printf '%s' "$DASH_BODY" | jq -c '.difficultySection.difficultyByMonth[] | select(.monthNumber == 8)')"
[ -n "$AUGUST_JSON" ] || cv_fail "expected August (monthNumber 8) in difficultyByMonth" $LINENO
check_num_close "$AUGUST_JSON" '.averageDifficulty' 2.0 0.1 \
  || cv_fail "expected August averageDifficulty=2.0 (stored difficulty) got $(printf '%s' "$AUGUST_JSON" | jq -r '.averageDifficulty')" $LINENO

check_num_close "$DASH_BODY" '.difficultySection.overallAverageDifficulty' 3.5 0.1 \
  || cv_fail "expected overallAverageDifficulty=3.5 ((5+2)/2) got $(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.overallAverageDifficulty')" $LINENO

TOP_MONTH="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.mostDifficultMonths[0].monthNumber')"
[ "$TOP_MONTH" = "4" ] || cv_fail "expected mostDifficultMonths[0] to be April (4), got ${TOP_MONTH}" $LINENO

BIN_PLUS3="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.windResistanceDistribution[] | select(.rating == 3) | .rideCount')"
[ "$BIN_PLUS3" = "1" ] || cv_fail "expected windResistanceDistribution bin +3 rideCount to be 1, got ${BIN_PLUS3}" $LINENO

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_15"
