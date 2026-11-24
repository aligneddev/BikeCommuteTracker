#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_90053023_1"
SUFFIX="$(date +%s%N)"
RIDER_NAME="del-rider-${SUFFIX}"
RIDER_PIN="4821"

ride_body() {
  # $1 = local datetime, $2 = miles, $3 = note
  jq -cn --arg dt "$1" --argjson miles "$2" --arg note "$3" \
    '{rideDateTimeLocal: $dt, miles: $miles, note: $note, weatherUserOverridden: true}'
}

# Given
cv_step Given "A signed-up rider with three recorded rides" $LINENO
cv_prereq "Sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "$(jq -cn --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
RIDER_ID="$(jq -r '.userId' <<<"$CV_HTTP_BODY")"
[[ "$RIDER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId from signup got '${RIDER_ID}'" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

TODAY="$(date -u +%Y-%m-%d)"
declare -a RIDE_IDS=()
declare -a RIDE_MILES=(5.5 7.25 3.75)
for i in 0 1 2; do
  cv_prereq "Record ride $((i + 1))" $LINENO
  cv_http POST /api/rides/ "$(ride_body "${TODAY}T0$((7 + i)):15:00" "${RIDE_MILES[$i]}" "ride-$i-${SUFFIX}")" "${AUTH[@]}"
  [[ "$CV_HTTP_STATUS" == "201" ]] || cv_fail "expected 201 recording ride $((i + 1)) got ${CV_HTTP_STATUS}" $LINENO
  rid="$(jq -r '.rideId' <<<"$CV_HTTP_BODY")"
  [[ "$rid" =~ ^[0-9]+$ ]] || cv_fail "expected numeric rideId got '${rid}'" $LINENO
  RIDE_IDS+=("$rid")
done

cv_prereq "Read history before delete" $LINENO
cv_http GET "/api/rides/history?page=1&pageSize=100" 200 "${AUTH[@]}"
BEFORE_COUNT="$(jq '.rides | length' <<<"$CV_HTTP_BODY")"
[[ "$BEFORE_COUNT" == "3" ]] || cv_fail "expected 3 rides in history before delete got ${BEFORE_COUNT}" $LINENO
BEFORE_ROWS="$(jq -c --argjson del "${RIDE_IDS[1]}" '[.rides[] | select(.rideId != $del)] | sort_by(.rideId)' <<<"$CV_HTTP_BODY")"
BEFORE_ALL_MILES="$(jq '.summaries.allTime.miles' <<<"$CV_HTTP_BODY")"

TARGET_ID="${RIDE_IDS[1]}"
TARGET_MILES="${RIDE_MILES[1]}"
T_BEFORE="$(date -u +%s)"

# When
cv_step When "Rider confirms deletion of the second ride" $LINENO
cv_http DELETE "/api/rides/${TARGET_ID}" "${AUTH[@]}"
DELETE_STATUS="$CV_HTTP_STATUS"
DELETE_BODY="$CV_HTTP_BODY"
T_AFTER="$(date -u +%s)"

# Then
cv_step Then "Only the selected ride is gone, others intact, success response records ride and time" $LINENO
[[ "$DELETE_STATUS" == "200" ]] || cv_fail "expected 200 success from DELETE got ${DELETE_STATUS}: ${DELETE_BODY}" $LINENO
RESP_RIDE_ID="$(jq -r '.rideId' <<<"$DELETE_BODY")"
[[ "$RESP_RIDE_ID" == "$TARGET_ID" ]] || cv_fail "expected deleted rideId ${TARGET_ID} in response got ${RESP_RIDE_ID}" $LINENO
DELETED_AT="$(jq -r '.deletedAtUtc // empty' <<<"$DELETE_BODY")"
[[ -n "$DELETED_AT" ]] || cv_fail "expected deletedAtUtc timestamp in response got none" $LINENO
DELETED_EPOCH="$(date -u -d "$DELETED_AT" +%s 2>/dev/null || echo 0)"
if (( DELETED_EPOCH < T_BEFORE - 5 || DELETED_EPOCH > T_AFTER + 5 )); then
  cv_fail "expected deletedAtUtc within the delete call window got ${DELETED_AT}" $LINENO
fi
IDEMP="$(jq -r '.isIdempotent' <<<"$DELETE_BODY")"
[[ "$IDEMP" == "false" ]] || cv_fail "expected isIdempotent=false for a first deletion got ${IDEMP}" $LINENO

cv_http GET "/api/rides/history?page=1&pageSize=100" 200 "${AUTH[@]}"
AFTER_COUNT="$(jq '.rides | length' <<<"$CV_HTTP_BODY")"
[[ "$AFTER_COUNT" == "2" ]] || cv_fail "expected 2 rides after delete got ${AFTER_COUNT}" $LINENO
STILL="$(jq --argjson del "$TARGET_ID" '[.rides[] | select(.rideId == $del)] | length' <<<"$CV_HTTP_BODY")"
[[ "$STILL" == "0" ]] || cv_fail "expected deleted ride ${TARGET_ID} absent from history got it present" $LINENO
AFTER_ROWS="$(jq -c '.rides | sort_by(.rideId)' <<<"$CV_HTTP_BODY")"
[[ "$AFTER_ROWS" == "$BEFORE_ROWS" ]] || cv_fail "expected remaining rides unchanged ${BEFORE_ROWS} got ${AFTER_ROWS}" $LINENO
AFTER_ALL_MILES="$(jq '.summaries.allTime.miles' <<<"$CV_HTTP_BODY")"
EXPECTED_MILES="$(jq -n --argjson b "$BEFORE_ALL_MILES" --argjson m "$TARGET_MILES" '$b - $m')"
jq -en --argjson a "$AFTER_ALL_MILES" --argjson e "$EXPECTED_MILES" '(($a - $e) | fabs) < 0.001' >/dev/null \
  || cv_fail "expected all-time miles ${EXPECTED_MILES} after delete got ${AFTER_ALL_MILES}" $LINENO

# Cleanup
cv_step Cleanup "Delete the remaining rides created by this test" $LINENO
for rid in "${RIDE_IDS[0]}" "${RIDE_IDS[2]}"; do
  cv_http DELETE "/api/rides/${rid}" "${AUTH[@]}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_90053023_1"
