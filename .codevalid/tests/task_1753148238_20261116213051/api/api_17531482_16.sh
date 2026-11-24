#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
RIDER_NAME="NoDiffDataRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_IDS=()

# Given
cv_step Given "register rider and record rides with no difficulty and no wind or travel-direction data" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "record March ride with miles only (no difficulty or wind data)" $LINENO
cv_http POST /api/rides '{"rideDateTimeLocal":"2025-03-10T08:00:00","miles":12}' 201 -H "X-User-Id: $USER_ID"
RIDE1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE1_ID" ] || cv_fail "ride 1 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE1_ID")

cv_prereq "record June ride with miles only (no difficulty or wind data)" $LINENO
cv_http POST /api/rides '{"rideDateTimeLocal":"2025-06-15T08:00:00","miles":18}' 201 -H "X-User-Id: $USER_ID"
RIDE2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE2_ID" ] || cv_fail "ride 2 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE2_ID")

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify difficultySection isEmpty is true, overallAverageDifficulty is null, and no month is included as zero" $LINENO

RIDE_COUNT="$(printf '%s' "$DASH_BODY" | jq -r '.savingsWindows.allTime.rideCount')"
[ "$RIDE_COUNT" = "2" ] || cv_fail "expected allTime.rideCount=2 so test proves rides exist without difficulty data, got ${RIDE_COUNT}" $LINENO

IS_EMPTY="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.isEmpty')"
[ "$IS_EMPTY" = "true" ] || cv_fail "expected difficultySection.isEmpty to be true (empty state), got ${IS_EMPTY}" $LINENO

OVERALL_AVG="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.overallAverageDifficulty')"
[ "$OVERALL_AVG" = "null" ] || cv_fail "expected difficultySection.overallAverageDifficulty to be null, got ${OVERALL_AVG}" $LINENO

MONTH_COUNT="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.difficultyByMonth | length')"
[ "$MONTH_COUNT" = "0" ] || cv_fail "expected difficultySection.difficultyByMonth to be empty (no month shown as zero), got length ${MONTH_COUNT}" $LINENO

MOST_DIFF_COUNT="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.mostDifficultMonths | length')"
[ "$MOST_DIFF_COUNT" = "0" ] || cv_fail "expected difficultySection.mostDifficultMonths to be empty, got length ${MOST_DIFF_COUNT}" $LINENO

NONZERO_BINS="$(printf '%s' "$DASH_BODY" | jq -r '[.difficultySection.windResistanceDistribution[] | select(.rideCount != 0)] | length')"
[ "$NONZERO_BINS" = "0" ] || cv_fail "expected all windResistanceDistribution bins to have rideCount 0, found ${NONZERO_BINS} non-zero bin(s)" $LINENO

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_16"
