#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

CASE_ID="api_37441830_2"
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="ExpenseRider${SUFFIX}"
RIDER_PIN="4821"
EXPENSE_DATE="2026-11-10"
EXPENSE_AMOUNT="42.75"
EXPENSE_NOTE="Chain and brake pads ${SUFFIX}"
WORK_DIR="$(mktemp -d)"
RECEIPT_FILE="${WORK_DIR}/receipt.png"
DOWNLOADED_FILE="${WORK_DIR}/downloaded.png"
RECEIPT_SIZE=$((2 * 1024 * 1024))
EXPENSE_ID=""
RIDER_ID=""

cleanup_tmp() { rm -rf "$WORK_DIR"; }
trap cleanup_tmp EXIT

# Given
cv_step Given "a signed-up, identified rider and a 2 MB PNG receipt file" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "$(jq -cn --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup got $CV_HTTP_STATUS" $LINENO

cv_prereq "identify rider (sign in)" $LINENO
cv_http POST /api/users/identify "$(jq -cn --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 from identify got $CV_HTTP_STATUS" $LINENO
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$RIDER_ID" ] || cv_fail "expected userId in identify response got: $CV_HTTP_BODY" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

cv_prereq "build a 2 MB PNG receipt" $LINENO
{
  printf '\x89PNG\r\n\x1a\n'
  head -c $((RECEIPT_SIZE - 8)) /dev/urandom
} > "$RECEIPT_FILE"
ACTUAL_SIZE="$(stat -c %s "$RECEIPT_FILE")"
[ "$ACTUAL_SIZE" = "$RECEIPT_SIZE" ] || cv_fail "expected receipt of ${RECEIPT_SIZE} bytes got ${ACTUAL_SIZE}" $LINENO
RECEIPT_SHA="$(sha256sum "$RECEIPT_FILE" | cut -d' ' -f1)"

# When
cv_step When "rider submits the expense with date, amount, note and PNG receipt" $LINENO
cv_http POST /api/expenses "${AUTH[@]}" \
  -F "expenseDate=${EXPENSE_DATE}" \
  -F "amount=${EXPENSE_AMOUNT}" \
  -F "notes=${EXPENSE_NOTE}" \
  -F "receipt=@${RECEIPT_FILE};type=image/png;filename=receipt.png"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 confirmation from POST /api/expenses got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
EXPENSE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"

# Then
cv_step Then "confirmation reports receipt attached; list shows same values with receipt; receipt is retrievable" $LINENO
[ -n "$EXPENSE_ID" ] || cv_fail "expected expenseId in confirmation got: $CV_HTTP_BODY" $LINENO
ATTACHED="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.receiptAttached')"
[ "$ATTACHED" = "true" ] || cv_fail "expected receiptAttached=true got ${ATTACHED}" $LINENO
RECEIPT_ERR="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.receiptError // empty')"
[ -z "$RECEIPT_ERR" ] || cv_fail "expected no receiptError got: ${RECEIPT_ERR}" $LINENO
CONF_RIDER="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.riderId')"
[ "$CONF_RIDER" = "$RIDER_ID" ] || cv_fail "expected confirmation riderId ${RIDER_ID} got ${CONF_RIDER}" $LINENO

cv_http GET /api/expenses "${AUTH[@]}"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 from GET /api/expenses got $CV_HTTP_STATUS" $LINENO
ROW="$(printf '%s' "$CV_HTTP_BODY" | jq -c --argjson id "$EXPENSE_ID" '[.expenses[] | select(.expenseId == $id)] | first // empty')"
[ -n "$ROW" ] || cv_fail "expected expense ${EXPENSE_ID} in expense list got: $CV_HTTP_BODY" $LINENO
ROW_DATE="$(printf '%s' "$ROW" | jq -r '.expenseDate')"
case "$ROW_DATE" in "${EXPENSE_DATE}"*) ;; *) cv_fail "expected expenseDate ${EXPENSE_DATE} got ${ROW_DATE}" $LINENO ;; esac
AMOUNT_OK="$(printf '%s' "$ROW" | jq --argjson a "$EXPENSE_AMOUNT" '.amount == $a')"
[ "$AMOUNT_OK" = "true" ] || cv_fail "expected amount ${EXPENSE_AMOUNT} got $(printf '%s' "$ROW" | jq -r '.amount')" $LINENO
ROW_NOTE="$(printf '%s' "$ROW" | jq -r '.notes')"
[ "$ROW_NOTE" = "$EXPENSE_NOTE" ] || cv_fail "expected notes '${EXPENSE_NOTE}' got '${ROW_NOTE}'" $LINENO
ROW_RECEIPT="$(printf '%s' "$ROW" | jq -r '.hasReceipt')"
[ "$ROW_RECEIPT" = "true" ] || cv_fail "expected hasReceipt=true in list got ${ROW_RECEIPT}" $LINENO
ROW_VERSION="$(printf '%s' "$ROW" | jq -r '.version')"
[ "$ROW_VERSION" = "1" ] || cv_fail "expected version 1 for new expense got ${ROW_VERSION}" $LINENO
COUNT="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseCount')"
[ "$COUNT" = "1" ] || cv_fail "expected expenseCount 1 for new rider got ${COUNT}" $LINENO

RECEIPT_URL="${BASE_URL}/api/expenses/${EXPENSE_ID}/receipt"
RECEIPT_HEADERS="${WORK_DIR}/receipt_headers.txt"
echo "REQUEST_HEADERS:"; echo "GET ${RECEIPT_URL} (X-User-Id: ${RIDER_ID})"
RCODE="$(curl -sS -H "X-User-Id: ${RIDER_ID}" -D "$RECEIPT_HEADERS" -o "$DOWNLOADED_FILE" -w '%{http_code}' "$RECEIPT_URL" || echo 000)"
cv_http GET "$RECEIPT_URL" "$RCODE"
echo "RESPONSE_HEADERS:"; cat "$RECEIPT_HEADERS"
echo "RESPONSE_BODY: <binary, $(stat -c %s "$DOWNLOADED_FILE") bytes>"
[ "$RCODE" = "200" ] || cv_fail "expected 200 from GET receipt got $RCODE" $LINENO
CV_HTTP_HEADERS_FILE="$RECEIPT_HEADERS"
DL_SIZE="$(stat -c %s "$DOWNLOADED_FILE")"
[ "$DL_SIZE" = "$RECEIPT_SIZE" ] || cv_fail "expected linked receipt of ${RECEIPT_SIZE} bytes got ${DL_SIZE}" $LINENO
DL_SHA="$(sha256sum "$DOWNLOADED_FILE" | cut -d' ' -f1)"
[ "$DL_SHA" = "$RECEIPT_SHA" ] || cv_fail "expected linked receipt content to match uploaded file (sha ${RECEIPT_SHA}) got ${DL_SHA}" $LINENO
grep -qi '^content-type: image/png' "$CV_HTTP_HEADERS_FILE" || cv_fail "expected receipt content-type image/png got $(grep -i '^content-type' "$CV_HTTP_HEADERS_FILE" || echo none)" $LINENO

# Cleanup
cv_step Cleanup "delete the created expense and its receipt" $LINENO
if [ -n "$EXPENSE_ID" ]; then
  cv_http DELETE "/api/expenses/${EXPENSE_ID}/receipt" "${AUTH[@]}"
  cv_http DELETE "/api/expenses/${EXPENSE_ID}" "${AUTH[@]}"
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_37441830_2"
