#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_82844448_1"
SUFFIX="$(date +%s%N)"
RIDER_NAME="mi-nodup-${SUFFIX}"
RIDER_PIN="4821"
CREATED_RIDE_IDS=()

auth() { printf 'X-User-Id: %s' "$RIDER_ID"; }

# Given
cv_step Given "register a rider with a manual ride outside the import month" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 201
RIDER_ID=$(jq -r '.userId' <<<"$CV_HTTP_BODY")
[ -n "$RIDER_ID" ] && [ "$RIDER_ID" != "null" ] || cv_fail "expected userId from signup got '${RIDER_ID}'" $LINENO

cv_prereq "record manual ride on 2025-06-15 (not in May 2025)" $LINENO
cv_http POST /api/rides/ '{"rideDateTimeLocal":"2025-06-15T08:00:00","miles":7.5}' 201 -H "$(auth)"
MANUAL_RIDE_ID=$(jq -r '.rideId' <<<"$CV_HTTP_BODY")
[ -n "$MANUAL_RIDE_ID" ] && [ "$MANUAL_RIDE_ID" != "null" ] || cv_fail "expected rideId from manual ride got '${MANUAL_RIDE_ID}'" $LINENO
CREATED_RIDE_IDS+=("$MANUAL_RIDE_ID")

CONTENT_B64=$(printf 'Month\tMiles\tDays\nMay\t96\t8\n' | base64 | tr -d '\n')

# When
cv_step When "preview the May 2025 monthly summary import and confirm it" $LINENO
cv_http POST /api/monthly-imports/preview "{\"fileName\":\"may-${SUFFIX}.txt\",\"contentBase64\":\"${CONTENT_B64}\",\"startYear\":2025}" 200 -H "$(auth)"
PREVIEW_BODY="$CV_HTTP_BODY"
JOB_ID=$(jq -r '.importJobId' <<<"$PREVIEW_BODY")
[ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ] || cv_fail "expected importJobId from preview got '${JOB_ID}'" $LINENO
cv_http POST /api/monthly-imports/start "{\"importJobId\":${JOB_ID},\"overrideAllDuplicates\":false,\"resolutions\":[]}" 202 -H "$(auth)"

# Then
cv_step Then "no preview row is a duplicate and a ride exists for every generated date" $LINENO
TOTAL=$(jq -r '.totalGeneratedRides' <<<"$PREVIEW_BODY")
[ "$TOTAL" = "8" ] || cv_fail "expected 8 generated rides got ${TOTAL}" $LINENO
DUPS=$(jq -r '.duplicateRides' <<<"$PREVIEW_BODY")
[ "$DUPS" = "0" ] || cv_fail "expected duplicateRides 0 got ${DUPS}" $LINENO
REQ=$(jq -r '.requiresDuplicateResolution' <<<"$PREVIEW_BODY")
[ "$REQ" = "false" ] || cv_fail "expected requiresDuplicateResolution false got ${REQ}" $LINENO
FLAGGED=$(jq '[.monthRows[].generatedRides[] | select(.isDuplicate != false)] | length' <<<"$PREVIEW_BODY")
[ "$FLAGGED" = "0" ] || cv_fail "expected no generated ride flagged duplicate got ${FLAGGED}" $LINENO
mapfile -t GEN_DATES < <(jq -r '.monthRows[].generatedRides[].date' <<<"$PREVIEW_BODY" | sort)
[ "${#GEN_DATES[@]}" = "8" ] || cv_fail "expected 8 generated dates in preview got ${#GEN_DATES[@]}" $LINENO

STATUS=""
for _ in $(seq 1 40); do
  cv_http GET "/api/monthly-imports/${JOB_ID}/status" 200 -H "$(auth)"
  STATUS=$(jq -r '.status' <<<"$CV_HTTP_BODY")
  case "$STATUS" in completed|failed|cancelled) break ;; esac
  sleep 0.5
done
[ "$STATUS" = "completed" ] || cv_fail "expected import status completed got ${STATUS}" $LINENO
IMPORTED=$(jq -r '.importedRows' <<<"$CV_HTTP_BODY")
[ "$IMPORTED" = "8" ] || cv_fail "expected importedRows 8 got ${IMPORTED}" $LINENO

cv_http GET "/api/rides/history?from=2025-05-01&to=2025-05-31&page=1&pageSize=200" 200 -H "$(auth)"
HISTORY="$CV_HTTP_BODY"
for d in "${GEN_DATES[@]}"; do
  n=$(jq --arg d "$d" '[.rides[] | select(.rideDateTimeLocal | startswith($d))] | length' <<<"$HISTORY")
  [ "$n" -ge 1 ] || cv_fail "expected a ride on generated date ${d} got none" $LINENO
done
MAY_COUNT=$(jq '.rides | length' <<<"$HISTORY")
[ "$MAY_COUNT" = "8" ] || cv_fail "expected 8 rides in May 2025 got ${MAY_COUNT}" $LINENO
mapfile -t IMPORTED_IDS < <(jq -r '.rides[].rideId' <<<"$HISTORY")
CREATED_RIDE_IDS+=("${IMPORTED_IDS[@]}")

cv_http GET "/api/rides/history?from=2025-06-01&to=2025-06-30&page=1&pageSize=200" 200 -H "$(auth)"
MANUAL_LEFT=$(jq --argjson id "$MANUAL_RIDE_ID" '[.rides[] | select(.rideId == $id)] | length' <<<"$CV_HTTP_BODY")
[ "$MANUAL_LEFT" = "1" ] || cv_fail "expected manual ride ${MANUAL_RIDE_ID} unchanged got ${MANUAL_LEFT} matches" $LINENO

# Cleanup
cv_step Cleanup "delete rides created by this test" $LINENO
for id in "${CREATED_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${id}" -H "$(auth)" || true
done

echo "CODEVALID_TEST_ASSERTION_OK:api_82844448_1"
