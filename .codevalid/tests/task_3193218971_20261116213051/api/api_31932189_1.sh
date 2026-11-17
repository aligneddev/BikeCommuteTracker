#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_31932189_1"
SUFFIX="$(date +%s%N)"
PIN="4826"

# Signs up a rider and prints its userId (auth is the X-User-Id header, see UserIdHeaderAuthenticationHandler.cs)
signup_rider() {
  local name="$1"
  cv_http POST /api/users/signup "$(jq -nc --arg n "$name" --arg p "$PIN" '{name:$n,pin:$p}')"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 from signup of $name got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
  fi
  SIGNED_UP_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')
}

# Records an expense (multipart form) for a rider, sets CREATED_ID
record_expense() {
  local uid="$1" date="$2" amount="$3" notes="$4"
  cv_http POST /api/expenses \
    -H "X-User-Id: $uid" -F "expenseDate=$date" -F "amount=$amount" -F "notes=$notes"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 recording expense $date/$amount got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
  fi
  CREATED_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId')
}

# Given
cv_step Given "rider A with three expenses on different dates and rider B with one expense" $LINENO
cv_prereq "sign up rider A and rider B" $LINENO
signup_rider "Exp Hist A $SUFFIX"; RIDER_A="$SIGNED_UP_ID"
signup_rider "Exp Hist B $SUFFIX"; RIDER_B="$SIGNED_UP_ID"

cv_prereq "record rider A expenses (inserted out of date order)" $LINENO
record_expense "$RIDER_A" "2025-02-14" "12.50" "middle $SUFFIX"; A_MID="$CREATED_ID"
record_expense "$RIDER_A" "2025-01-05" "7.25" "oldest $SUFFIX"; A_OLD="$CREATED_ID"
record_expense "$RIDER_A" "2025-03-20" "30.00" "newest $SUFFIX"; A_NEW="$CREATED_ID"

cv_prereq "record rider B expense" $LINENO
record_expense "$RIDER_B" "2025-02-28" "99.99" "other rider $SUFFIX"; B_EXP="$CREATED_ID"

# When
cv_step When "rider A requests the expense history" $LINENO
cv_http GET /api/expenses 200 -H "X-User-Id: $RIDER_A"
HISTORY="$CV_HTTP_BODY"

# Then
cv_step Then "only rider A's expenses are returned newest first with a total of all of them" $LINENO
IDS=$(printf '%s' "$HISTORY" | jq -c '[.expenses[].expenseId]')
EXPECTED_IDS="[$A_NEW,$A_MID,$A_OLD]"
if [ "$IDS" != "$EXPECTED_IDS" ]; then
  cv_fail "expected expense ids newest first $EXPECTED_IDS got $IDS" $LINENO
fi
if printf '%s' "$HISTORY" | jq -e --argjson b "$B_EXP" 'any(.expenses[]; .expenseId == $b)' >/dev/null; then
  cv_fail "expected rider B's expense $B_EXP not in rider A's history, but it was returned" $LINENO
fi
DATES=$(printf '%s' "$HISTORY" | jq -c '[.expenses[].expenseDate[0:10]]')
if [ "$DATES" != '["2025-03-20","2025-02-14","2025-01-05"]' ]; then
  cv_fail "expected dates [2025-03-20,2025-02-14,2025-01-05] got $DATES" $LINENO
fi
COUNT=$(printf '%s' "$HISTORY" | jq -r '.expenseCount')
if [ "$COUNT" != "3" ]; then
  cv_fail "expected expenseCount 3 got $COUNT" $LINENO
fi
if ! printf '%s' "$HISTORY" | jq -e '(.totalAmount * 100 | round) == 4975' >/dev/null; then
  cv_fail "expected totalAmount 49.75 got $(printf '%s' "$HISTORY" | jq -r '.totalAmount')" $LINENO
fi

# Cleanup
cv_step Cleanup "delete the expenses created for both riders" $LINENO
for id in "$A_NEW" "$A_MID" "$A_OLD"; do
  cv_http DELETE "/api/expenses/$id" -H "X-User-Id: $RIDER_A"
done
cv_http DELETE "/api/expenses/$B_EXP" -H "X-User-Id: $RIDER_B"

echo "CODEVALID_TEST_ASSERTION_OK:api_31932189_1"
