#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

CASE_ID="api_50337938_1"
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="ConsistencyRider_${SUFFIX}"
RIDER_PIN="1234"
RIDE_IDS=()

# Given
cv_step Given "register rider, save MPG/mileage-rate settings and record two rides in the current week" $LINENO

cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
USER_ID="$(jq -r '.userId' <<<"$CV_HTTP_BODY")"
_cv_is_int "$USER_ID" || cv_fail "expected numeric userId from signup got '$USER_ID'" $LINENO
AUTH=(-H "X-User-Id: ${USER_ID}")

cv_prereq "save savings settings (MPG and mileage rate)" $LINENO
cv_http PUT /api/users/me/settings \
  '{"averageCarMpg":25,"yearlyGoalMiles":null,"oilChangePrice":null,"mileageRateCents":67,"locationLabel":null,"latitude":null,"longitude":null}' \
  200 "${AUTH[@]}"

# Rides dated "now" (container local time = UTC) so they fall in the current calendar week.
NOW_LOCAL="$(date -u -d '-5 seconds' +%Y-%m-%dT%H:%M:%S)"
NOW_LOCAL2="$(date -u -d '-3 seconds' +%Y-%m-%dT%H:%M:%S)"
for ts in "$NOW_LOCAL" "$NOW_LOCAL2"; do
  cv_prereq "record ride at $ts" $LINENO
  cv_http POST /api/rides/ \
    "$(jq -nc --arg t "$ts" '{rideDateTimeLocal:$t,miles:10,rideMinutes:40,gasPricePerGallon:3.5,weatherUserOverridden:true}')" \
    201 "${AUTH[@]}"
  rid="$(jq -r '.rideId' <<<"$CV_HTTP_BODY")"
  _cv_is_int "$rid" || cv_fail "expected numeric rideId got '$rid'" $LINENO
  RIDE_IDS+=("$rid")
done

# When
cv_step When "rider opens the advanced dashboard" $LINENO
cv_http GET /api/dashboard/advanced "" "${AUTH[@]}"

# Then
cv_step Then "suggestions include an enabled consistency card alongside computed savings" $LINENO
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 from /api/dashboard/advanced got $CV_HTTP_STATUS" $LINENO
BODY="$CV_HTTP_BODY"

WEEK_COUNT="$(jq -r '.savingsWindows.weekly.rideCount' <<<"$BODY")"
[ "$WEEK_COUNT" = "2" ] || cv_fail "expected weekly rideCount 2 got $WEEK_COUNT" $LINENO

COMBINED="$(jq -r '.savingsWindows.allTime.combinedSavings' <<<"$BODY")"
{ [ "$COMBINED" != "null" ] && jq -e '.savingsWindows.allTime.combinedSavings > 0' <<<"$BODY" >/dev/null; } \
  || cv_fail "expected positive all-time combinedSavings next to suggestions got $COMBINED" $LINENO

CONS_COUNT="$(jq '[.suggestions[]? | select(.suggestionKey=="consistency")] | length' <<<"$BODY")"
[ "$CONS_COUNT" = "1" ] || cv_fail "expected exactly one consistency suggestion got $CONS_COUNT" $LINENO

CONS_ENABLED="$(jq -r '.suggestions[] | select(.suggestionKey=="consistency") | .isEnabled' <<<"$BODY")"
[ "$CONS_ENABLED" = "true" ] || cv_fail "expected consistency suggestion isEnabled=true got $CONS_ENABLED" $LINENO

CONS_TITLE="$(jq -r '.suggestions[] | select(.suggestionKey=="consistency") | .title // ""' <<<"$BODY")"
CONS_DESC="$(jq -r '.suggestions[] | select(.suggestionKey=="consistency") | .description // ""' <<<"$BODY")"
[ -n "$CONS_TITLE" ] || cv_fail "expected non-empty consistency title got empty" $LINENO
[ -n "$CONS_DESC" ] || cv_fail "expected non-empty consistency description got empty" $LINENO
grep -q "2" <<<"$CONS_DESC" || cv_fail "expected consistency description to reflect the 2 rides this week got '$CONS_DESC'" $LINENO

BAD_KEYS="$(jq -r '[.suggestions[].suggestionKey | select(. != "consistency" and . != "milestone" and . != "comeback")] | join(",")' <<<"$BODY")"
[ -z "$BAD_KEYS" ] || cv_fail "expected only MVP suggestion types got extra: $BAD_KEYS" $LINENO

# Cleanup
cv_step Cleanup "delete the rides created by this test" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "${AUTH[@]}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_50337938_1"
