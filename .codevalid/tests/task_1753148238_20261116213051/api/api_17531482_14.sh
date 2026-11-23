#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
RIDER_NAME="DiffRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""
RIDE_IDS=()

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "register rider and record rides with difficulty in March across two years, July, and an unrated January ride" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

cv_prereq "record March 2024 ride with difficulty 2" $LINENO
cv_http POST /api/rides '{"rideDateTimeLocal":"2024-03-15T08:00:00","miles":10,"difficulty":2}' 201 -H "X-User-Id: $USER_ID"
RIDE1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE1_ID" ] || cv_fail "ride 1 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE1_ID")

cv_prereq "record March 2025 ride with difficulty 4" $LINENO
cv_http POST /api/rides '{"rideDateTimeLocal":"2025-03-20T08:00:00","miles":12,"difficulty":4}' 201 -H "X-User-Id: $USER_ID"
RIDE2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE2_ID" ] || cv_fail "ride 2 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE2_ID")

cv_prereq "record July 2025 ride with difficulty 5" $LINENO
cv_http POST /api/rides '{"rideDateTimeLocal":"2025-07-10T08:00:00","miles":10,"difficulty":5}' 201 -H "X-User-Id: $USER_ID"
RIDE3_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE3_ID" ] || cv_fail "ride 3 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE3_ID")

cv_prereq "record January 2025 ride with no difficulty or wind data" $LINENO
cv_http POST /api/rides '{"rideDateTimeLocal":"2025-01-12T08:00:00","miles":6}' 201 -H "X-User-Id: $USER_ID"
RIDE4_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE4_ID" ] || cv_fail "ride 4 did not return rideId" $LINENO
RIDE_IDS+=("$RIDE4_ID")

# When
cv_step When "fetch advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify difficultyByMonth combines March across years, includes July, and excludes months without difficulty or wind data" $LINENO

IS_EMPTY="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.isEmpty')"
[ "$IS_EMPTY" = "false" ] || cv_fail "expected difficultySection.isEmpty to be false, got ${IS_EMPTY}" $LINENO

MONTH_COUNT="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.difficultyByMonth | length')"
[ "$MONTH_COUNT" = "2" ] || cv_fail "expected exactly 2 months in difficultyByMonth (March and July), got ${MONTH_COUNT}" $LINENO

MARCH_JSON="$(printf '%s' "$DASH_BODY" | jq -c '.difficultySection.difficultyByMonth[] | select(.monthNumber == 3)')"
[ -n "$MARCH_JSON" ] || cv_fail "expected March (monthNumber 3) entry in difficultyByMonth" $LINENO
MARCH_NAME="$(printf '%s' "$MARCH_JSON" | jq -r '.monthName')"
[ "$MARCH_NAME" = "March" ] || cv_fail "expected March monthName to be March, got ${MARCH_NAME}" $LINENO
MARCH_RIDES="$(printf '%s' "$MARCH_JSON" | jq -r '.rideCount')"
[ "$MARCH_RIDES" = "2" ] || cv_fail "expected March rideCount across both years to be 2, got ${MARCH_RIDES}" $LINENO
check_num_close "$MARCH_JSON" '.averageDifficulty' 3.0 0.1 \
  || cv_fail "expected March averageDifficulty=3.0 got $(printf '%s' "$MARCH_JSON" | jq -r '.averageDifficulty')" $LINENO

JULY_JSON="$(printf '%s' "$DASH_BODY" | jq -c '.difficultySection.difficultyByMonth[] | select(.monthNumber == 7)')"
[ -n "$JULY_JSON" ] || cv_fail "expected July (monthNumber 7) entry in difficultyByMonth" $LINENO
JULY_NAME="$(printf '%s' "$JULY_JSON" | jq -r '.monthName')"
[ "$JULY_NAME" = "July" ] || cv_fail "expected July monthName to be July, got ${JULY_NAME}" $LINENO
JULY_RIDES="$(printf '%s' "$JULY_JSON" | jq -r '.rideCount')"
[ "$JULY_RIDES" = "1" ] || cv_fail "expected July rideCount to be 1, got ${JULY_RIDES}" $LINENO
check_num_close "$JULY_JSON" '.averageDifficulty' 5.0 0.1 \
  || cv_fail "expected July averageDifficulty=5.0 got $(printf '%s' "$JULY_JSON" | jq -r '.averageDifficulty')" $LINENO

OTHER_MONTHS="$(printf '%s' "$DASH_BODY" | jq -r '[.difficultySection.difficultyByMonth[] | select(.monthNumber != 3 and .monthNumber != 7)] | length')"
[ "$OTHER_MONTHS" = "0" ] || cv_fail "expected months without difficulty or wind data to be excluded, found ${OTHER_MONTHS} extra month(s)" $LINENO

check_num_close "$DASH_BODY" '.difficultySection.overallAverageDifficulty' 3.7 0.1 \
  || cv_fail "expected overallAverageDifficulty=3.7 got $(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.overallAverageDifficulty')" $LINENO

TOP_MONTH="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.mostDifficultMonths[0].monthNumber')"
[ "$TOP_MONTH" = "7" ] || cv_fail "expected mostDifficultMonths[0] to be July (7), got ${TOP_MONTH}" $LINENO

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_14"
