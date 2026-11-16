#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_31932189_6"
SUFFIX="$(date +%s%N)"
PIN="4826"
START_DATE="2025-04-10"
END_DATE="2025-04-20"

# Records an expense (multipart form) for the rider, sets CREATED_ID
record_expense() {
  local date="$1" amount="$2"
  cv_http POST /api/expenses \
    -H "X-User-Id: $RIDER" -F "expenseDate=$date" -F "amount=$amount" -F "notes=range $date $SUFFIX"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 recording expense $date/$amount got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
  fi
  CREATED_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId')
}

# Given
cv_step Given "a rider with expenses before, on start, inside, on end and after the range" $LINENO
cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "Exp Range $SUFFIX" --arg p "$PIN" '{name:$n,pin:$p}')"
if [ "$CV_HTTP_STATUS" != "201" ]; then
  cv_fail "expected 201 from signup got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
fi
RIDER=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')

cv_prereq "record five expenses around the range" $LINENO
record_expense "2025-04-09" "1.00";  E_BEFORE="$CREATED_ID"
record_expense "$START_DATE" "2.00"; E_START="$CREATED_ID"
record_expense "2025-04-15" "4.00";  E_INSIDE="$CREATED_ID"
record_expense "$END_DATE" "8.00";   E_END="$CREATED_ID"
record_expense "2025-04-21" "16.00"; E_AFTER="$CREATED_ID"

# When
cv_step When "rider requests expenses filtered by the start and end date" $LINENO
cv_http GET "/api/expenses?startDate=$START_DATE&endDate=$END_DATE" 200 -H "X-User-Id: $RIDER"
FILTERED="$CV_HTTP_BODY"

# Then
cv_step Then "only expenses on the start date, inside the range and on the end date are returned" $LINENO
IDS=$(printf '%s' "$FILTERED" | jq -c '[.expenses[].expenseId] | sort')
EXPECTED=$(jq -nc --argjson a "$E_START" --argjson b "$E_INSIDE" --argjson c "$E_END" '[$a,$b,$c] | sort')
if [ "$IDS" != "$EXPECTED" ]; then
  cv_fail "expected only start/inside/end expenses $EXPECTED got $IDS" $LINENO
fi
for out in "$E_BEFORE" "$E_AFTER"; do
  if printf '%s' "$FILTERED" | jq -e --argjson o "$out" 'any(.expenses[]; .expenseId == $o)' >/dev/null; then
    cv_fail "expected out-of-range expense $out not returned, but it was" $LINENO
  fi
done
DATES=$(printf '%s' "$FILTERED" | jq -c '[.expenses[].expenseDate[0:10]] | sort')
if [ "$DATES" != "[\"$START_DATE\",\"2025-04-15\",\"$END_DATE\"]" ]; then
  cv_fail "expected dates [$START_DATE,2025-04-15,$END_DATE] got $DATES" $LINENO
fi
COUNT=$(printf '%s' "$FILTERED" | jq -r '.expenseCount')
if [ "$COUNT" != "3" ]; then
  cv_fail "expected expenseCount 3 got $COUNT" $LINENO
fi
if ! printf '%s' "$FILTERED" | jq -e '(.totalAmount * 100 | round) == 1400' >/dev/null; then
  cv_fail "expected filtered totalAmount 14.00 got $(printf '%s' "$FILTERED" | jq -r '.totalAmount')" $LINENO
fi

# Cleanup
cv_step Cleanup "delete the rider's expenses" $LINENO
for id in "$E_BEFORE" "$E_START" "$E_INSIDE" "$E_END" "$E_AFTER"; do
  cv_http DELETE "/api/expenses/$id" -H "X-User-Id: $RIDER"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_31932189_6"
