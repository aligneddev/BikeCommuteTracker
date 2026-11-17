#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case: api_77015292_11 - Note indicator appears only on rides with notes
# API side of the criterion: the history grid data carries the saved note text only on the
# ride that has one, so the info icon / overlay can be driven from it.
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="HistNote-${SUFFIX}"
PIN="1234"
NOTE_TEXT="Headwind on the bridge <b>&</b> \"wet\" roads ${SUFFIX}"
TODAY=$(date +%Y-%m-%d)

# Given
cv_step Given "Sign up rider and record one ride with a note and one without" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${PIN}\"}" 201
RIDER_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')
[[ "$RIDER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId got '${RIDER_ID}'" $LINENO

cv_prereq "Record ride with a saved note" $LINENO
BODY=$(jq -nc --arg d "${TODAY}T07:15:00" --arg n "$NOTE_TEXT" \
  '{rideDateTimeLocal:$d, miles:4.2, rideMinutes:20, note:$n, weatherUserOverridden:true}')
cv_http POST /api/rides "$BODY" 201 -H "X-User-Id: ${RIDER_ID}"
NOTE_RIDE_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')
[[ "$NOTE_RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected rideId for noted ride got '${NOTE_RIDE_ID}'" $LINENO

cv_prereq "Record ride without a note" $LINENO
cv_http POST /api/rides "{\"rideDateTimeLocal\":\"${TODAY}T17:45:00\",\"miles\":4.8,\"rideMinutes\":22,\"weatherUserOverridden\":true}" 201 -H "X-User-Id: ${RIDER_ID}"
PLAIN_RIDE_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')
[[ "$PLAIN_RIDE_ID" =~ ^[0-9]+$ ]] || cv_fail "expected rideId for plain ride got '${PLAIN_RIDE_ID}'" $LINENO

# When
cv_step When "Rider loads ride history grid" $LINENO
cv_http GET /api/rides/history 200 -H "X-User-Id: ${RIDER_ID}"
HIST="$CV_HTTP_BODY"

# Then
cv_step Then "Only the noted ride carries note text (exact, unaltered); the other has none" $LINENO
COUNT=$(printf '%s' "$HIST" | jq '.rides | length')
[ "$COUNT" -eq 2 ] || cv_fail "expected 2 rides in grid got ${COUNT}" $LINENO

NOTED=$(printf '%s' "$HIST" | jq -c --argjson id "$NOTE_RIDE_ID" '.rides[] | select(.rideId == $id)')
PLAIN=$(printf '%s' "$HIST" | jq -c --argjson id "$PLAIN_RIDE_ID" '.rides[] | select(.rideId == $id)')
[ -n "$NOTED" ] || cv_fail "expected noted ride ${NOTE_RIDE_ID} in grid, not found" $LINENO
[ -n "$PLAIN" ] || cv_fail "expected plain ride ${PLAIN_RIDE_ID} in grid, not found" $LINENO

GOT_NOTE=$(printf '%s' "$NOTED" | jq -r '.note // ""')
[ "$GOT_NOTE" = "$NOTE_TEXT" ] || cv_fail "expected note '${NOTE_TEXT}' on ride ${NOTE_RIDE_ID} got '${GOT_NOTE}'" $LINENO

PLAIN_NOTE=$(printf '%s' "$PLAIN" | jq -r '.note // ""')
[ -z "$PLAIN_NOTE" ] || cv_fail "expected no note on ride ${PLAIN_RIDE_ID} (no indicator) got '${PLAIN_NOTE}'" $LINENO

WITH_NOTES=$(printf '%s' "$HIST" | jq '[.rides[] | select((.note // "") != "")] | length')
[ "$WITH_NOTES" -eq 1 ] || cv_fail "expected exactly 1 row with a note got ${WITH_NOTES}" $LINENO

# Cleanup
cv_step Cleanup "Delete rides created by this test" $LINENO
cv_http DELETE "/api/rides/${NOTE_RIDE_ID}" -H "X-User-Id: ${RIDER_ID}"
cv_http DELETE "/api/rides/${PLAIN_RIDE_ID}" -H "X-User-Id: ${RIDER_ID}"

echo "CODEVALID_TEST_ASSERTION_OK:api_77015292_11"
