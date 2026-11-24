#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case: api_90146664_1 - Pasted monthly summary becomes evenly spread weekday rides
BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_90146664_1"
SUFFIX="$(date +%s%N)"

# Expected distribution computed from the specification:
# list Mon-Fri dates of May 2025, stride = max(1, floor(count/days)), pick weekdays[i*stride-1].
expected_dates() {
  local year=$1 month=$2 days=$3 d dow count stride i
  local -a wd=()
  for d in $(seq 1 31); do
    local ds; ds=$(printf '%04d-%02d-%02d' "$year" "$month" "$d")
    if ! date -d "$ds" +%F >/dev/null 2>&1; then break; fi
    [ "$(date -d "$ds" +%m)" = "$(printf '%02d' "$month")" ] || break
    dow=$(date -d "$ds" +%u)
    if [ "$dow" -le 5 ]; then wd+=("$ds"); fi
  done
  count=${#wd[@]}
  stride=$(( count / days )); [ "$stride" -lt 1 ] && stride=1
  for i in $(seq 1 "$days"); do echo "${wd[$(( i * stride - 1 ))]}"; done
}

# Given
cv_step Given "Sign up a rider and prepare pasted tab-delimited Month/Miles/Days text with 'May 96 8'" $LINENO
cv_prereq "Create rider" $LINENO
cv_http POST /api/users/signup "{\"name\":\"MonthlyRider-${SUFFIX}\",\"pin\":\"1234\"}" 201
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "expected userId from signup got '$CV_HTTP_BODY'" $LINENO
fi
AUTH=(-H "X-User-Id: ${RIDER_ID}")

PASTED="$(printf 'Month\tMiles\tDays\nMay\t96\t8\n')"
CONTENT_B64="$(printf '%s\n' "$PASTED" | base64 | tr -d '\n')"
mapfile -t EXPECTED < <(expected_dates 2025 5 8)
echo "expected dates: ${EXPECTED[*]}"

cv_prereq "Preview the pasted text with start year 2025" $LINENO
cv_http POST /api/monthly-imports/preview "{\"fileName\":\"pasted.txt\",\"contentBase64\":\"${CONTENT_B64}\",\"startYear\":2025}" 200 "${AUTH[@]}"
PREVIEW="$CV_HTTP_BODY"
JOB_ID="$(printf '%s' "$PREVIEW" | jq -r '.importJobId')"
if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  cv_fail "expected importJobId in preview got '$PREVIEW'" $LINENO
fi

# Preview must list every generated ride with date, miles and duplicate status
PV_COUNT="$(printf '%s' "$PREVIEW" | jq '[.monthRows[].generatedRides[]] | length')"
[ "$PV_COUNT" = "8" ] || cv_fail "expected 8 previewed rides got $PV_COUNT" $LINENO
PV_TOTAL="$(printf '%s' "$PREVIEW" | jq -r '.totalGeneratedRides')"
[ "$PV_TOTAL" = "8" ] || cv_fail "expected totalGeneratedRides 8 got $PV_TOTAL" $LINENO
PV_MISSING="$(printf '%s' "$PREVIEW" | jq '[.monthRows[].generatedRides[] | select((.date|type)!="string" or (.miles|type)!="number" or (.isDuplicate|type)!="boolean")] | length')"
[ "$PV_MISSING" = "0" ] || cv_fail "expected each previewed ride to have date, miles and isDuplicate; $PV_MISSING lacked them" $LINENO
mapfile -t PV_DATES < <(printf '%s' "$PREVIEW" | jq -r '[.monthRows[].generatedRides[].date] | sort | .[]')
[ "${PV_DATES[*]}" = "${EXPECTED[*]}" ] || cv_fail "expected preview dates '${EXPECTED[*]}' got '${PV_DATES[*]}'" $LINENO
PV_SUM="$(printf '%s' "$PREVIEW" | jq '[.monthRows[].generatedRides[].miles] | add * 100 | round')"
[ "$PV_SUM" = "9600" ] || cv_fail "expected preview miles to total 96 got $PV_SUM/100" $LINENO
PV_PER="$(printf '%s' "$PREVIEW" | jq -c '[.monthRows[].generatedRides[].miles] | unique')"
[ "$PV_PER" = "[12]" ] || cv_fail "expected each previewed ride to be 12 miles got $PV_PER" $LINENO
PV_DUP="$(printf '%s' "$PREVIEW" | jq '[.monthRows[].generatedRides[] | select(.isDuplicate)] | length')"
[ "$PV_DUP" = "0" ] || cv_fail "expected no duplicates for a fresh rider got $PV_DUP" $LINENO

# When
cv_step When "Confirm the previewed monthly import" $LINENO
cv_http POST /api/monthly-imports/start "{\"importJobId\":${JOB_ID},\"overrideAllDuplicates\":false,\"resolutions\":[]}" 202 "${AUTH[@]}"

# Then
cv_step Then "Import completes and ride history holds exactly 8 weekday May 2025 rides totalling 96 miles" $LINENO
STATUS=""
for _ in $(seq 1 30); do
  cv_http GET "/api/monthly-imports/${JOB_ID}/status" 200 "${AUTH[@]}"
  STATUS="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.status')"
  case "$STATUS" in completed|failed|cancelled) break ;; esac
  sleep 1
done
[ "$STATUS" = "completed" ] || cv_fail "expected import status completed got '$STATUS'" $LINENO
IMPORTED="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.importedRows')"
[ "$IMPORTED" = "8" ] || cv_fail "expected importedRows 8 got $IMPORTED" $LINENO

cv_http GET "/api/rides/history?from=2025-05-01&to=2025-05-31&pageSize=200" 200 "${AUTH[@]}"
HIST="$CV_HTTP_BODY"
H_COUNT="$(printf '%s' "$HIST" | jq '.rides | length')"
[ "$H_COUNT" = "8" ] || cv_fail "expected 8 rides in May 2025 history got $H_COUNT" $LINENO
mapfile -t H_DATES < <(printf '%s' "$HIST" | jq -r '[.rides[].rideDateTimeLocal[0:10]] | sort | .[]')
for d in "${H_DATES[@]}"; do
  case "$d" in 2025-05-*) ;; *) cv_fail "expected ride in May 2025 got $d" $LINENO ;; esac
  dow="$(date -d "$d" +%u)"
  [ "$dow" -le 5 ] || cv_fail "expected weekday ride got $d (day-of-week $dow)" $LINENO
done
[ "${H_DATES[*]}" = "${EXPECTED[*]}" ] || cv_fail "expected history dates '${EXPECTED[*]}' got '${H_DATES[*]}'" $LINENO
H_SUM="$(printf '%s' "$HIST" | jq '[.rides[].miles] | add * 100 | round')"
[ "$H_SUM" = "9600" ] || cv_fail "expected history miles total 96 got $H_SUM/100" $LINENO
H_TOTAL_ALL="$(printf '%s' "$HIST" | jq -r '.totalRows')"
[ "$H_TOTAL_ALL" = "8" ] || cv_fail "expected totalRows 8 got $H_TOTAL_ALL" $LINENO

# Cleanup
cv_step Cleanup "Delete the rides created by the import" $LINENO
for rid in $(printf '%s' "$HIST" | jq -r '.rides[].rideId'); do
  cv_http DELETE "/api/rides/${rid}" "${AUTH[@]}"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_90146664_1"
