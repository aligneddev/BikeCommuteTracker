#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_77095701_7"
SUFFIX="$(date +%s%N)"
RIDER_NAME="cv-dup7-${SUFFIX}"
RIDER_PIN="5937"
RIDE_DATE="2025-07-14"
CREATED_RIDE_IDS=()
JOB_ID=""

record_ride() { # $1=json body
  cv_http POST /api/rides/ "$1" 201 -H "X-User-Id: ${USER_ID}"
  local id
  id=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')
  [ -n "$id" ] || cv_fail "expected rideId from POST /api/rides got: ${CV_HTTP_BODY}" $LINENO
  CREATED_RIDE_IDS+=("$id")
}

# find the value of the first key (case-insensitive regex) in a JSON object; prints "__missing__" if none
field_of() { # $1=json object $2=key regex
  printf '%s' "$1" | jq -r --arg re "$2" '
    [to_entries[] | select(.key | test($re; "i"))] as $m
    | if ($m | length) == 0 then "__missing__" else ($m[0].value | tostring) end'
}

# Given
cv_step Given "Rider has two rides on ${RIDE_DATE} with 9.5 miles and Temp 60, plus a CSV row matching both" $LINENO
cv_prereq "Sign up a unique rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 201
USER_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')
[ -n "$USER_ID" ] || cv_fail "expected userId from signup got: ${CV_HTTP_BODY}" $LINENO

cv_prereq "Record two existing rides on the same date with the same miles and Temp" $LINENO
record_ride "{\"rideDateTimeLocal\":\"${RIDE_DATE}T07:30:00\",\"miles\":9.5,\"rideMinutes\":35,\"temperature\":60,\"note\":\"morning commute ${SUFFIX}\"}"
RIDE_A="${CREATED_RIDE_IDS[0]}"
record_ride "{\"rideDateTimeLocal\":\"${RIDE_DATE}T17:45:00\",\"miles\":9.5,\"rideMinutes\":42,\"temperature\":60,\"note\":\"evening commute ${SUFFIX}\"}"
RIDE_B="${CREATED_RIDE_IDS[1]}"

CSV=$(printf 'Date,Miles,Time,Temp,Tags,Notes\n%s,9.5,38,60,commute,csv row %s\n' "$RIDE_DATE" "$SUFFIX")
CSV_B64=$(printf '%s' "$CSV" | base64 | tr -d '\n')

# When
cv_step When "Upload the CSV for import preview" $LINENO
cv_http POST /api/imports/preview "{\"fileName\":\"dup-${SUFFIX}.csv\",\"contentBase64\":\"${CSV_B64}\"}" 200 -H "X-User-Id: ${USER_ID}"
PREVIEW_BODY="$CV_HTTP_BODY"
JOB_ID=$(printf '%s' "$PREVIEW_BODY" | jq -r '.importJobId // empty')

# Then
cv_step Then "Import pauses for resolution and the duplicate row carries the CSV row and both matching rides with all fields" $LINENO
[ -n "$JOB_ID" ] || cv_fail "expected importJobId in preview got: ${PREVIEW_BODY}" $LINENO
REQ_RES=$(printf '%s' "$PREVIEW_BODY" | jq -r '.requiresDuplicateResolution')
DUP_ROWS=$(printf '%s' "$PREVIEW_BODY" | jq -r '.duplicateRows')
[ "$REQ_RES" = "true" ] || cv_fail "expected requiresDuplicateResolution true got ${REQ_RES}" $LINENO
[ "$DUP_ROWS" = "1" ] || cv_fail "expected duplicateRows 1 got ${DUP_ROWS}" $LINENO

ROW=$(printf '%s' "$PREVIEW_BODY" | jq -c '.rows[0]')
# CSV row side of the dialog
[ "$(printf '%s' "$ROW" | jq -r '.date')" = "$RIDE_DATE" ] || cv_fail "expected CSV row date ${RIDE_DATE} got $(printf '%s' "$ROW" | jq -r '.date')" $LINENO
[ "$(printf '%s' "$ROW" | jq -r '.miles|tonumber')" = "9.5" ] || cv_fail "expected CSV row miles 9.5 got $(printf '%s' "$ROW" | jq -r '.miles')" $LINENO
[ "$(printf '%s' "$ROW" | jq -r '.rideMinutes')" = "38" ] || cv_fail "expected CSV row time 38 got $(printf '%s' "$ROW" | jq -r '.rideMinutes')" $LINENO
[ "$(printf '%s' "$ROW" | jq -r '.temperature|tonumber')" = "60" ] || cv_fail "expected CSV row temp 60 got $(printf '%s' "$ROW" | jq -r '.temperature')" $LINENO
[ "$(printf '%s' "$ROW" | jq -r '.tags')" = "commute" ] || cv_fail "expected CSV row tags commute got $(printf '%s' "$ROW" | jq -r '.tags')" $LINENO
[ "$(printf '%s' "$ROW" | jq -r '.notes')" = "csv row ${SUFFIX}" ] || cv_fail "expected CSV row notes got $(printf '%s' "$ROW" | jq -r '.notes')" $LINENO

MATCH_COUNT=$(printf '%s' "$ROW" | jq '(.duplicateMatches // []) | length')
[ "$MATCH_COUNT" = "2" ] || cv_fail "expected 2 matching existing rides got ${MATCH_COUNT}" $LINENO
MATCH_IDS=$(printf '%s' "$ROW" | jq -r '[.duplicateMatches[].existingRideId] | sort | map(tostring) | join(",")')
EXPECTED_IDS=$(printf '%s\n%s\n' "$RIDE_A" "$RIDE_B" | sort -n | paste -sd, -)
[ "$MATCH_IDS" = "$EXPECTED_IDS" ] || cv_fail "expected matches for rides ${EXPECTED_IDS} got ${MATCH_IDS}" $LINENO

for rid in "$RIDE_A" "$RIDE_B"; do
  M=$(printf '%s' "$ROW" | jq -c --argjson id "$rid" '.duplicateMatches[] | select(.existingRideId == $id)')
  if [ "$rid" = "$RIDE_A" ]; then EXP_MIN=35; EXP_NOTE="morning commute ${SUFFIX}"; else EXP_MIN=42; EXP_NOTE="evening commute ${SUFFIX}"; fi
  D=$(field_of "$M" 'date')
  case "$D" in "${RIDE_DATE}"*) ;; *) cv_fail "expected existing ride ${rid} date ${RIDE_DATE} got ${D}" $LINENO ;; esac
  MI=$(field_of "$M" 'miles')
  [ "$MI" != "__missing__" ] && [ "$(printf '%s' "$MI" | jq -r 'tonumber')" = "9.5" ] || cv_fail "expected existing ride ${rid} miles 9.5 got ${MI}" $LINENO
  T=$(field_of "$M" 'minutes|time')
  [ "$T" = "$EXP_MIN" ] || cv_fail "expected existing ride ${rid} time ${EXP_MIN} in duplicate match got ${T} (match: ${M})" $LINENO
  TP=$(field_of "$M" 'temp')
  [ "$TP" != "__missing__" ] && [ "$(printf '%s' "$TP" | jq -r 'tonumber' 2>/dev/null)" = "60" ] || cv_fail "expected existing ride ${rid} temp 60 in duplicate match got ${TP} (match: ${M})" $LINENO
  TG=$(field_of "$M" 'tag')
  [ "$TG" != "__missing__" ] || cv_fail "expected existing ride ${rid} tags field in duplicate match got none (match: ${M})" $LINENO
  N=$(field_of "$M" 'note')
  [ "$N" = "$EXP_NOTE" ] || cv_fail "expected existing ride ${rid} notes '${EXP_NOTE}' in duplicate match got ${N} (match: ${M})" $LINENO
done

# Cleanup
cv_step Cleanup "Cancel the previewed import job and delete created rides" $LINENO
if [ -n "${JOB_ID}" ]; then
  cv_http POST "/api/imports/${JOB_ID}/cancel" -H "X-User-Id: ${USER_ID}" || true
fi
for id in "${CREATED_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "X-User-Id: ${USER_ID}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_77095701_7"
