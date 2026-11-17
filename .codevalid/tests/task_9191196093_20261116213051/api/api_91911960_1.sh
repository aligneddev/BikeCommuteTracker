#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

CASE_ID="api_91911960_1"
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="ExpDel_${SUFFIX}"
RIDER_PIN="4821"

# Multipart POST helper (expenses are created from form data, not JSON).
create_expense() {
  local user_id="$1" date="$2" amount="$3" notes="$4"
  cv_http POST /api/expenses 201 \
    -H "X-User-Id: ${user_id}" \
    -F "expenseDate=${date}" -F "amount=${amount}" -F "notes=${notes}"
}

# Given
cv_step Given "rider signs up and records two expenses without receipts" $LINENO
cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup got $CV_HTTP_STATUS" $LINENO
RIDER_ID="$(jq -r '.userId' <<<"$CV_HTTP_BODY")"
_cv_is_int "$RIDER_ID" || cv_fail "expected numeric userId got $RIDER_ID" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

cv_prereq "record expense to delete" $LINENO
create_expense "$RIDER_ID" "2026-03-10" "42.50" "chain ${SUFFIX}"
DEL_ID="$(jq -r '.expenseId' <<<"$CV_HTTP_BODY")"
[ "$(jq -r '.receiptAttached' <<<"$CV_HTTP_BODY")" = "false" ] || cv_fail "expected expense without receipt got $CV_HTTP_BODY" $LINENO
_cv_is_int "$DEL_ID" || cv_fail "expected numeric expenseId got $DEL_ID" $LINENO

cv_prereq "record expense to keep" $LINENO
create_expense "$RIDER_ID" "2026-03-11" "10.00" "tube ${SUFFIX}"
KEEP_ID="$(jq -r '.expenseId' <<<"$CV_HTTP_BODY")"

cv_prereq "both expenses appear in history before delete" $LINENO
cv_http GET /api/expenses 200 "${AUTH[@]}"
jq -e --argjson d "$DEL_ID" --argjson k "$KEEP_ID" \
  '[.expenses[].expenseId] | index($d) != null and index($k) != null' <<<"$CV_HTTP_BODY" >/dev/null \
  || cv_fail "expected expenses $DEL_ID and $KEEP_ID in history got $CV_HTTP_BODY" $LINENO

# When
cv_step When "rider deletes their own expense" $LINENO
cv_http DELETE "/api/expenses/${DEL_ID}" "${AUTH[@]}"
DELETE_STATUS="$CV_HTTP_STATUS"

# Then
cv_step Then "delete succeeded, expense gone from history, tombstone retained" $LINENO
case "$DELETE_STATUS" in
  2??) ;;
  *) cv_fail "expected 2xx success from DELETE /api/expenses/${DEL_ID} got $DELETE_STATUS" $LINENO ;;
esac

cv_http GET /api/expenses 200 "${AUTH[@]}"
jq -e --argjson d "$DEL_ID" '[.expenses[].expenseId] | index($d) == null' <<<"$CV_HTTP_BODY" >/dev/null \
  || cv_fail "expected deleted expense $DEL_ID absent from history got $CV_HTTP_BODY" $LINENO
jq -e --argjson k "$KEEP_ID" '[.expenses[].expenseId] | index($k) != null' <<<"$CV_HTTP_BODY" >/dev/null \
  || cv_fail "expected other expense $KEEP_ID still in history got $CV_HTTP_BODY" $LINENO
COUNT="$(jq -r '.expenseCount' <<<"$CV_HTTP_BODY")"
TOTAL="$(jq -r '.totalAmount' <<<"$CV_HTTP_BODY")"
[ "$COUNT" = "1" ] || cv_fail "expected expenseCount 1 after delete got $COUNT" $LINENO
jq -e '.totalAmount == 10' <<<"$CV_HTTP_BODY" >/dev/null || cv_fail "expected totalAmount 10 after delete got $TOTAL" $LINENO

cv_prereq "filtered history view also excludes the deleted expense" $LINENO
cv_http GET "/api/expenses?startDate=2026-03-10&endDate=2026-03-10" 200 "${AUTH[@]}"
jq -e '.expenseCount == 0' <<<"$CV_HTTP_BODY" >/dev/null \
  || cv_fail "expected no expenses on 2026-03-10 after delete got $CV_HTTP_BODY" $LINENO

# The event log is not exposed via API; the tombstone being retained (not the record
# removed) is observable as the app still knowing the expense as deleted, not unknown.
cv_prereq "tombstone retained: expense known as deleted rather than missing" $LINENO
cv_http DELETE "/api/expenses/${DEL_ID}" "${AUTH[@]}"
[ "$CV_HTTP_STATUS" != "404" ] \
  || cv_fail "expected deleted expense $DEL_ID retained as tombstone got 404 (record gone): $CV_HTTP_BODY" $LINENO

# Cleanup
cv_step Cleanup "delete remaining expense created by this test" $LINENO
cv_http DELETE "/api/expenses/${KEEP_ID}" "${AUTH[@]}" || true

echo "CODEVALID_TEST_ASSERTION_OK:api_91911960_1"
