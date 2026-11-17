#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

CASE_ID="api_81323169_1"
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="ExpEditRider_${SUFFIX}"
RIDER_PIN="4821"

ORIG_DATE="2026-03-10"
ORIG_AMOUNT="12.50"
ORIG_NOTE="Original note ${SUFFIX}"

NEW_DATE="2026-03-15"
NEW_AMOUNT="27.75"
NEW_NOTE="Updated chain lube ${SUFFIX}"

USER_ID=""
EXPENSE_ID=""

# Given
cv_step Given "register a rider, record an expense and read it from the history list with its version" $LINENO

cv_prereq "sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
_cv_is_int "$USER_ID" || cv_fail "expected numeric userId from signup got '$USER_ID'" $LINENO
AUTH=(-H "X-User-Id: ${USER_ID}")

cv_prereq "record an expense (multipart form)" $LINENO
cv_http POST /api/expenses 201 "${AUTH[@]}" \
  -F "expenseDate=${ORIG_DATE}" -F "amount=${ORIG_AMOUNT}" -F "notes=${ORIG_NOTE}"
EXPENSE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId')"
_cv_is_int "$EXPENSE_ID" || cv_fail "expected numeric expenseId from create got '$EXPENSE_ID'" $LINENO

cv_prereq "read history list to get the row's current version" $LINENO
cv_http GET /api/expenses 200 "${AUTH[@]}"
ROW="$(printf '%s' "$CV_HTTP_BODY" | jq -c --argjson id "$EXPENSE_ID" '.expenses[] | select(.expenseId == $id)')"
[ -n "$ROW" ] || cv_fail "expected expense $EXPENSE_ID in history list got none" $LINENO
VERSION="$(printf '%s' "$ROW" | jq -r '.version')"
_cv_is_int "$VERSION" || cv_fail "expected numeric version on history row got '$VERSION'" $LINENO

# When
cv_step When "save the inline edit with new date, amount and note at the current version" $LINENO
EDIT_BODY="$(jq -nc --arg d "${NEW_DATE}T00:00:00" --argjson a "$NEW_AMOUNT" --arg n "$NEW_NOTE" --argjson v "$VERSION" \
  '{expenseDate:$d, amount:$a, notes:$n, expectedVersion:$v}')"
cv_http PUT "/api/expenses/${EXPENSE_ID}" "$EDIT_BODY" "${AUTH[@]}"
EDIT_STATUS="$CV_HTTP_STATUS"
EDIT_RESP="$CV_HTTP_BODY"

# Then
cv_step Then "save succeeded and the history row shows the updated date, amount and note" $LINENO
[ "$EDIT_STATUS" = "200" ] || cv_fail "expected HTTP 200 from PUT /api/expenses/${EXPENSE_ID} got $EDIT_STATUS: $EDIT_RESP" $LINENO
RESP_ID="$(printf '%s' "$EDIT_RESP" | jq -r '.expenseId')"
[ "$RESP_ID" = "$EXPENSE_ID" ] || cv_fail "expected expenseId $EXPENSE_ID in edit response got $RESP_ID" $LINENO
NEW_VERSION="$(printf '%s' "$EDIT_RESP" | jq -r '.newVersion')"
[ "$NEW_VERSION" = "$((VERSION + 1))" ] || cv_fail "expected newVersion $((VERSION + 1)) got $NEW_VERSION" $LINENO

cv_http GET /api/expenses 200 "${AUTH[@]}"
ROW="$(printf '%s' "$CV_HTTP_BODY" | jq -c --argjson id "$EXPENSE_ID" '.expenses[] | select(.expenseId == $id)')"
[ -n "$ROW" ] || cv_fail "expected edited expense $EXPENSE_ID still in history list got none" $LINENO
COUNT="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseCount')"
[ "$COUNT" = "1" ] || cv_fail "expected 1 expense in history (edit replaces row view) got $COUNT" $LINENO

GOT_DATE="$(printf '%s' "$ROW" | jq -r '.expenseDate' | cut -c1-10)"
[ "$GOT_DATE" = "$NEW_DATE" ] || cv_fail "expected expenseDate $NEW_DATE got $GOT_DATE" $LINENO
GOT_AMOUNT_OK="$(printf '%s' "$ROW" | jq -r --argjson a "$NEW_AMOUNT" '.amount == $a')"
[ "$GOT_AMOUNT_OK" = "true" ] || cv_fail "expected amount $NEW_AMOUNT got $(printf '%s' "$ROW" | jq -r '.amount')" $LINENO
GOT_NOTE="$(printf '%s' "$ROW" | jq -r '.notes')"
[ "$GOT_NOTE" = "$NEW_NOTE" ] || cv_fail "expected notes '$NEW_NOTE' got '$GOT_NOTE'" $LINENO
GOT_VERSION="$(printf '%s' "$ROW" | jq -r '.version')"
[ "$GOT_VERSION" = "$((VERSION + 1))" ] || cv_fail "expected row version $((VERSION + 1)) got $GOT_VERSION" $LINENO

# Cleanup
cv_step Cleanup "delete the expense created by this test" $LINENO
cv_http DELETE "/api/expenses/${EXPENSE_ID}" "${AUTH[@]}"
echo "cleanup delete status: $CV_HTTP_STATUS"

echo "CODEVALID_TEST_ASSERTION_OK:api_81323169_1"
