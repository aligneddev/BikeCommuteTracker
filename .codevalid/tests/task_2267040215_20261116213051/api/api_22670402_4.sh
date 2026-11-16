#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case api_22670402_4: logged-in rider downloads the sample CSV; it has a header for every
# supported column, realistic example rows and a legend (Difficulty 1-5, compass directions).
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="CsvSample${SUFFIX: -12}"
RIDER_PIN="5937"

# Given
cv_step Given "a signed-up (logged-in) rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$RIDER_ID" ] && [ "$RIDER_ID" != "null" ] || cv_fail "expected userId from signup got '$RIDER_ID'" $LINENO
cv_prereq "identify (log in) the rider" $LINENO
cv_http POST /api/users/identify "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 200

# When
cv_step When "rider downloads the sample CSV" $LINENO
cv_http GET /api/rides/csv-sample "" 200 -H "X-User-Id: $RIDER_ID"

# Then
cv_step Then "sample CSV has every supported column header, example rows and a legend of valid values" $LINENO
grep -qi '^content-type: *text/csv' "$CV_HTTP_HEADERS_FILE" || cv_fail "expected Content-Type text/csv got '$(grep -i '^content-type' "$CV_HTTP_HEADERS_FILE" | tr -d '\r')'" $LINENO
CSV="$(tr -d '\r' < "$CV_HTTP_BODY_FILE" | sed '1s/^\xEF\xBB\xBF//')"
HEADER_LINE="$(printf '%s\n' "$CSV" | grep -v '^#' | grep -v '^[[:space:]]*$' | head -n 1)"
[ -n "$HEADER_LINE" ] || cv_fail "expected a header row in sample CSV got none" $LINENO
HEADERS_UP="$(printf '%s' "$HEADER_LINE" | tr '[:lower:]' '[:upper:]' | tr ',' '\n' | sed 's/^ *//;s/ *$//;s/"//g')"
for col in DATE MILES TIME TEMP TAGS NOTES DIFFICULTY; do
  printf '%s\n' "$HEADERS_UP" | grep -qx "$col" || cv_fail "expected header column '$col' in sample CSV header got '$HEADER_LINE'" $LINENO
done
printf '%s\n' "$HEADERS_UP" | grep -qxE 'PRIMARYTRAVELDIRECTION|DIRECTION' || cv_fail "expected PrimaryTravelDirection/Direction column in header got '$HEADER_LINE'" $LINENO

DATA_ROWS="$(printf '%s\n' "$CSV" | grep -v '^#' | grep -v '^[[:space:]]*$' | tail -n +2)"
ROW_COUNT="$(printf '%s\n' "$DATA_ROWS" | grep -c . || true)"
[ "$ROW_COUNT" -ge 2 ] || cv_fail "expected at least 2 example rows got $ROW_COUNT" $LINENO
DATE_IDX="$(printf '%s\n' "$HEADERS_UP" | grep -nx DATE | cut -d: -f1)"
MILES_IDX="$(printf '%s\n' "$HEADERS_UP" | grep -nx MILES | cut -d: -f1)"
while IFS= read -r row; do
  d="$(printf '%s' "$row" | cut -d, -f"$DATE_IDX")"
  m="$(printf '%s' "$row" | cut -d, -f"$MILES_IDX")"
  printf '%s' "$d" | grep -qE '^([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}|[0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})$' || cv_fail "expected realistic Date in example row got '$d' in '$row'" $LINENO
  awk -v m="$m" 'BEGIN{ exit !(m+0 > 0 && m+0 <= 200) }' || cv_fail "expected Miles in (0,200] in example row got '$m' in '$row'" $LINENO
done <<< "$DATA_ROWS"

LEGEND="$(printf '%s\n' "$CSV" | grep '^#' || true)"
[ -n "$LEGEND" ] || cv_fail "expected a legend/comment of valid values in sample CSV got none" $LINENO
DIFF_LINE="$(printf '%s\n' "$LEGEND" | grep -i 'difficulty' || true)"
printf '%s' "$DIFF_LINE" | grep -qE '\b1\b' && printf '%s' "$DIFF_LINE" | grep -qE '\b5\b' || cv_fail "expected legend to state Difficulty 1 to 5 got '$DIFF_LINE'" $LINENO
DIR_LINE="$(printf '%s\n' "$LEGEND" | grep -i 'direction' || true)"
[ -n "$DIR_LINE" ] || cv_fail "expected a legend line for travel direction got none" $LINENO
for c in NE SE SW NW; do
  printf '%s' "$DIR_LINE" | grep -qw "$c" || cv_fail "expected compass direction '$c' in legend got '$DIR_LINE'" $LINENO
done
for pair in "N|North" "E|East" "S|South" "W|West"; do
  printf '%s' "$DIR_LINE" | grep -qwiE "$pair" || cv_fail "expected compass direction '$pair' in legend got '$DIR_LINE'" $LINENO
done

# Cleanup
cv_step Cleanup "nothing to remove; downloading the sample creates no data (no user-delete endpoint exists)" $LINENO

echo "CODEVALID_TEST_ASSERTION_OK:api_22670402_4"
