#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="cvimp${SUFFIX: -10}"
RIDER_PIN="4821"
CASE_ID="api_85162628_1"

auth() { printf 'X-User-Id: %s' "$RIDER_ID"; }

# Given
cv_step Given "a rider with a validated CSV import awaiting confirmation" $LINENO
cv_prereq "sign up rider $RIDER_NAME" $LINENO
cv_http POST /api/users/signup "{\"name\":\"$RIDER_NAME\",\"pin\":\"$RIDER_PIN\"}" 201
RIDER_ID=$(jq -r '.userId' <<<"$CV_HTTP_BODY")
[ -n "$RIDER_ID" ] && [ "$RIDER_ID" != "null" ] || cv_fail "expected userId from signup got $CV_HTTP_BODY" $LINENO

CSV=$'Date,Miles,Time,Temp,Tags,Notes\n2024-03-03,5.25,25,60,commute,cv row one\n2024-03-04,6.5,30,61,commute,cv row two\n2024-03-05,7.75,35,62,commute,cv row three\n'
CSV_B64=$(printf '%s' "$CSV" | base64 | tr -d '\n')
cv_prereq "preview CSV import" $LINENO
cv_http POST /api/imports/preview "{\"fileName\":\"rides-$SUFFIX.csv\",\"contentBase64\":\"$CSV_B64\"}" 200 -H "$(auth)"
JOB_ID=$(jq -r '.importJobId' <<<"$CV_HTTP_BODY")
VALID_ROWS=$(jq -r '.validRows' <<<"$CV_HTTP_BODY")
[ "$VALID_ROWS" = "3" ] || cv_fail "expected 3 valid preview rows got $VALID_ROWS ($CV_HTTP_BODY)" $LINENO
cv_http GET "/api/imports/$JOB_ID/status" 200 -H "$(auth)"
PRE_STATUS=$(jq -r '.status' <<<"$CV_HTTP_BODY")
[ "$PRE_STATUS" = "awaiting-confirmation" ] || cv_fail "expected job awaiting-confirmation got $PRE_STATUS" $LINENO

# When
cv_step When "the rider confirms the import" $LINENO
cv_http POST /api/imports/start "{\"importJobId\":$JOB_ID,\"overrideAllDuplicates\":false,\"resolutions\":[]}" -H "$(auth)"
START_STATUS_CODE=$CV_HTTP_STATUS
START_BODY=$CV_HTTP_BODY

# Then
cv_step Then "import is processing and cannot be triggered a second time" $LINENO
[ "$START_STATUS_CODE" = "202" ] || cv_fail "expected 202 from start got $START_STATUS_CODE ($START_BODY)" $LINENO
STARTED=$(jq -r '.status' <<<"$START_BODY")
[ "$STARTED" = "processing" ] || cv_fail "expected start status processing got $STARTED" $LINENO
[ "$(jq -r '.importJobId' <<<"$START_BODY")" = "$JOB_ID" ] || cv_fail "expected start response for job $JOB_ID got $START_BODY" $LINENO

# A second confirmation (start button pressed again) must be refused.
cv_http POST /api/imports/start "{\"importJobId\":$JOB_ID,\"overrideAllDuplicates\":false,\"resolutions\":[]}" -H "$(auth)"
case "$CV_HTTP_STATUS" in
  2*) cv_fail "expected second start to be refused got $CV_HTTP_STATUS ($CV_HTTP_BODY)" $LINENO ;;
esac

# Wait for processing to finish, then check rows were imported exactly once.
FINAL=""
for _ in $(seq 1 30); do
  cv_http GET "/api/imports/$JOB_ID/status" 200 -H "$(auth)"
  FINAL=$(jq -r '.status' <<<"$CV_HTTP_BODY")
  case "$FINAL" in processing) sleep 1 ;; *) break ;; esac
done
case "$FINAL" in processing|completed) ;; *) cv_fail "expected job processing or completed got $FINAL ($CV_HTTP_BODY)" $LINENO ;; esac
[ "$(jq -r '.totalRows' <<<"$CV_HTTP_BODY")" = "3" ] || cv_fail "expected totalRows 3 got $CV_HTTP_BODY" $LINENO
if [ "$FINAL" = "completed" ]; then
  IMPORTED=$(jq -r '.importedRows' <<<"$CV_HTTP_BODY")
  [ "$IMPORTED" = "3" ] || cv_fail "expected importedRows 3 got $IMPORTED" $LINENO
  cv_http GET "/api/rides/history?page=1&pageSize=100" 200 -H "$(auth)"
  COUNT=$(jq '[.rides[] | select((.note // "") | startswith("cv row"))] | length' <<<"$CV_HTTP_BODY")
  [ "$COUNT" = "3" ] || cv_fail "expected 3 imported rides (no double import) got $COUNT" $LINENO
fi

# Cleanup
cv_step Cleanup "delete imported rides" $LINENO
cv_http GET "/api/rides/history?page=1&pageSize=100" -H "$(auth)"
if [ "$CV_HTTP_STATUS" = "200" ]; then
  for rid in $(jq -r '.rides[].rideId' <<<"$CV_HTTP_BODY"); do
    cv_http DELETE "/api/rides/$rid" -H "$(auth)" || true
  done
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_85162628_1"
