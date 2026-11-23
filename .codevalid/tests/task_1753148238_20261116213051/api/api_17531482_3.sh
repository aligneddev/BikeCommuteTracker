#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_SUFFIX="$(date +%s%N)-$$"
RIDER_NAME="EmptyRider_${CASE_SUFFIX}"
RIDER_PIN="1234"
USER_ID=""

# Given
cv_step Given "register a new rider with no rides and no expenses" $LINENO

cv_prereq "sign up unique rider" $LINENO
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "signup did not return userId" $LINENO

# When
cv_step When "fetch advanced dashboard for rider with no rides" $LINENO
cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER_ID"
DASH_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "verify all windows, CO2, and riding time return zero or null placeholders with no errors or NaN" $LINENO

printf '%s' "$DASH_BODY" | jq -e '.' >/dev/null || cv_fail "response body is not valid JSON" $LINENO
if printf '%s' "$DASH_BODY" | grep -qiE 'NaN|Infinity'; then
  cv_fail "response body contains NaN or Infinity: ${DASH_BODY}" $LINENO
fi

TOTAL_MINUTES="$(printf '%s' "$DASH_BODY" | jq -r '.totalRideMinutes')"
[ "$TOTAL_MINUTES" = "0" ] || cv_fail "expected totalRideMinutes to be 0, got ${TOTAL_MINUTES}" $LINENO

if ! printf '%s' "$DASH_BODY" | jq -e '(.co2SavedPerMileLbs != null) and (((.co2SavedPerMileLbs - 0.90) | fabs) <= 0.001)' >/dev/null; then
  ACTUAL_FACTOR="$(printf '%s' "$DASH_BODY" | jq -r '.co2SavedPerMileLbs')"
  cv_fail "expected co2SavedPerMileLbs to be 0.90, got ${ACTUAL_FACTOR}" $LINENO
fi

for win in weekly monthly yearly allTime; do
  if ! printf '%s' "$DASH_BODY" | jq -e ".savingsWindows.${win} | (.rideCount == 0 and .totalMiles == 0 and (.co2Saved | type == \"number\") and .co2Saved == 0 and (.totalExpenses | type == \"number\") and .totalExpenses == 0 and .fuelCostEstimated == false)" >/dev/null; then
    WIN_JSON="$(printf '%s' "$DASH_BODY" | jq -c ".savingsWindows.${win}")"
    cv_fail "expected zero counters and co2Saved=0 for savingsWindows.${win}, got ${WIN_JSON}" $LINENO
  fi
  for field in gallonsSaved fuelCostAvoided mileageRateSavings combinedSavings oilChangeSavings netSavings; do
    if ! printf '%s' "$DASH_BODY" | jq -e ".savingsWindows.${win}.${field} | (. == null or (. | type == \"number\" and . == 0))" >/dev/null; then
      ACTUAL_FIELD="$(printf '%s' "$DASH_BODY" | jq -r ".savingsWindows.${win}.${field}")"
      cv_fail "expected savingsWindows.${win}.${field} to be null or 0, got ${ACTUAL_FIELD}" $LINENO
    fi
  done
done

DIFF_EMPTY="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.isEmpty')"
[ "$DIFF_EMPTY" = "true" ] || cv_fail "expected difficultySection.isEmpty to be true, got ${DIFF_EMPTY}" $LINENO

DIFF_MONTHS="$(printf '%s' "$DASH_BODY" | jq -r '.difficultySection.difficultyByMonth | length')"
[ "$DIFF_MONTHS" = "0" ] || cv_fail "expected difficultySection.difficultyByMonth length 0, got ${DIFF_MONTHS}" $LINENO

# Cleanup
cv_step Cleanup "no rides or expenses were created to remove" $LINENO

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_3"
