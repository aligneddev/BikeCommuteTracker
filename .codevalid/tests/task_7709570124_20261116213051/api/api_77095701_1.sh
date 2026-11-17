#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_77095701_1"
SUFFIX="$(date +%s%N)"
RIDER_NAME="cv-dup1-${SUFFIX}"
RIDER_PIN="4826"
RIDE_DATE="2025-06-10"
OTHER_DATE="2025-06-11"
CREATED_RIDE_IDS=()
JOB_ID=""

record_ride() { # $1=json body
  cv_http POST /api/rides/ "$1" 201 -H "X-User-Id: ${USER_ID}"
  local id
  id=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')
  [ -n "$id" ] || cv_fail "expected rideId from POST /api/rides got: ${CV_HTTP_BODY}" $LINENO
  CREATED_RIDE_IDS+=("$id")
}

# Given
cv_step Given "Rider exists with one ride on ${RIDE_DATE} (10 miles, Temp 50) and a CSV whose rows never match date+miles+Temp" $LINENO
cv_prereq "Sign up a unique rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 201
USER_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')
[ -n "$USER_ID" ] || cv_fail "expected userId from signup got: ${CV_HTTP_BODY}" $LINENO

cv_prereq "Record the existing ride" $LINENO
record_ride "{\"rideDateTimeLocal\":\"${RIDE_DATE}T08:00:00\",\"miles\":10,\"rideMinutes\":40,\"temperature\":50,\"note\":\"existing ride\"}"

# Row 1: same date, different miles. Row 2: same date + same miles, different Temp.
# Row 3: different date entirely.
CSV=$(printf 'Date,Miles,Time,Temp,Tags,Notes\n%s,12.5,45,50,commute,different miles\n%s,10,40,65,commute,different temp\n%s,7,30,55,errand,other date\n' \
  "$RIDE_DATE" "$RIDE_DATE" "$OTHER_DATE")
CSV_B64=$(printf '%s' "$CSV" | base64 | tr -d '\n')

# When
cv_step When "Upload the CSV for preview, then start the import without any resolutions" $LINENO
cv_http POST /api/imports/preview "{\"fileName\":\"rides-${SUFFIX}.csv\",\"contentBase64\":\"${CSV_B64}\"}" 200 -H "X-User-Id: ${USER_ID}"
PREVIEW_BODY="$CV_HTTP_BODY"
JOB_ID=$(printf '%s' "$PREVIEW_BODY" | jq -r '.importJobId // empty')
[ -n "$JOB_ID" ] || cv_fail "expected importJobId in preview got: ${PREVIEW_BODY}" $LINENO
cv_http POST /api/imports/start "{\"importJobId\":${JOB_ID},\"overrideAllDuplicates\":false,\"resolutions\":[]}" 202 -H "X-User-Id: ${USER_ID}"

# Then
cv_step Then "No duplicate prompt; job completes with all 3 rows imported and 4 rides in history" $LINENO
DUP_ROWS=$(printf '%s' "$PREVIEW_BODY" | jq -r '.duplicateRows')
REQ_RES=$(printf '%s' "$PREVIEW_BODY" | jq -r '.requiresDuplicateResolution')
VALID_ROWS=$(printf '%s' "$PREVIEW_BODY" | jq -r '.validRows')
MATCHED=$(printf '%s' "$PREVIEW_BODY" | jq '[.rows[] | (.duplicateMatches // []) | length] | add // 0')
[ "$VALID_ROWS" = "3" ] || cv_fail "expected 3 valid rows in preview got ${VALID_ROWS}" $LINENO
[ "$DUP_ROWS" = "0" ] || cv_fail "expected duplicateRows 0 (no date+miles+Temp match) got ${DUP_ROWS}" $LINENO
[ "$REQ_RES" = "false" ] || cv_fail "expected requiresDuplicateResolution false got ${REQ_RES}" $LINENO
[ "$MATCHED" = "0" ] || cv_fail "expected no duplicateMatches on any row got ${MATCHED}" $LINENO

STATUS=""
for _ in $(seq 1 40); do
  cv_http GET "/api/imports/${JOB_ID}/status" 200 -H "X-User-Id: ${USER_ID}"
  STATUS=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.status')
  case "$STATUS" in completed|failed|cancelled) break ;; esac
  sleep 0.5
done
[ "$STATUS" = "completed" ] || cv_fail "expected import status completed got ${STATUS}" $LINENO
IMPORTED=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.importedRows')
SKIPPED=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.skippedRows')
FAILED=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.failedRows')
[ "$IMPORTED" = "3" ] || cv_fail "expected importedRows 3 got ${IMPORTED}" $LINENO
[ "$SKIPPED" = "0" ] || cv_fail "expected skippedRows 0 got ${SKIPPED}" $LINENO
[ "$FAILED" = "0" ] || cv_fail "expected failedRows 0 got ${FAILED}" $LINENO

cv_http GET "/api/rides/history?from=${RIDE_DATE}&to=${OTHER_DATE}&page=1&pageSize=50" 200 -H "X-User-Id: ${USER_ID}"
TOTAL=$(printf '%s' "$CV_HTTP_BODY" | jq '.rides | length')
[ "$TOTAL" = "4" ] || cv_fail "expected 4 rides in history (1 existing + 3 imported) got ${TOTAL}" $LINENO
HAS_125=$(printf '%s' "$CV_HTTP_BODY" | jq '[.rides[] | select((.miles|tonumber) == 12.5)] | length')
HAS_10_65=$(printf '%s' "$CV_HTTP_BODY" | jq '[.rides[] | select((.miles|tonumber) == 10 and ((.temperature // 0)|tonumber) == 65)] | length')
HAS_7=$(printf '%s' "$CV_HTTP_BODY" | jq '[.rides[] | select((.miles|tonumber) == 7)] | length')
[ "$HAS_125" = "1" ] || cv_fail "expected one imported 12.5-mile ride got ${HAS_125}" $LINENO
[ "$HAS_10_65" = "1" ] || cv_fail "expected one imported 10-mile ride with Temp 65 got ${HAS_10_65}" $LINENO
[ "$HAS_7" = "1" ] || cv_fail "expected one imported 7-mile ride got ${HAS_7}" $LINENO
ALL_IDS=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rides[].rideId')

# Cleanup
cv_step Cleanup "Delete the rides this script created" $LINENO
for id in $ALL_IDS "${CREATED_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "X-User-Id: ${USER_ID}" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_77095701_1"
