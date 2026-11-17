#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Row matching a saved expense on date and amount is flagged in preview.
# Endpoints: POST /api/users/signup, POST /api/expenses, POST /api/expense-imports/preview,
#            GET /api/expenses, DELETE /api/expense-imports/{jobId}, DELETE /api/expenses/{id}
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="dupflag_${SUFFIX}"
RIDER_PIN="4321"
CSV_FILE="${TMPDIR:-/tmp}/expense_import_${SUFFIX}.csv"
EXISTING_NOTE="Bike tune-up ${SUFFIX}"
INCOMING_NOTE="Shop visit ${SUFFIX}"
JOB_ID=""
EXISTING_ID=""

num_eq() { # num_eq <a> <b> -> success when numerically equal
  jq -n --arg a "$1" --arg b "$2" '($a|tonumber) == ($b|tonumber)' | grep -q true
}

# Given
cv_step Given "rider with saved expense 2024-03-10 \$25.00 and a CSV containing a matching row" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}" 201
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER_ID" ] || cv_fail "expected userId in signup response got: $CV_HTTP_BODY" $LINENO
AUTH=(-H "X-User-Id: ${USER_ID}")

cv_prereq "record saved expense 2024-03-10 25.00" $LINENO
cv_http POST /api/expenses 201 "${AUTH[@]}" \
  -F "expenseDate=2024-03-10" -F "amount=25.00" -F "notes=${EXISTING_NOTE}"
EXISTING_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
[ -n "$EXISTING_ID" ] || cv_fail "expected expenseId from POST /api/expenses got: $CV_HTTP_BODY" $LINENO

# Row 1 matches date+amount; row 2 has same date but a different amount (must not be flagged).
printf 'Date,Amount,Note\n2024-03-10,25.00,%s\n2024-03-10,40.00,Different amount\n' "$INCOMING_NOTE" > "$CSV_FILE"

# When
cv_step When "upload the CSV to the expense import preview" $LINENO
cv_http POST /api/expense-imports/preview "${AUTH[@]}" -F "file=@${CSV_FILE};filename=dup_${SUFFIX}.csv;type=text/csv"
PREVIEW_STATUS="$CV_HTTP_STATUS"
PREVIEW_BODY="$CV_HTTP_BODY"
JOB_ID="$(printf '%s' "$PREVIEW_BODY" | jq -r '.jobId // empty' 2>/dev/null || true)"

# Then
cv_step Then "the matching row is flagged with incoming and existing details side by side" $LINENO
[ "$PREVIEW_STATUS" = "200" ] || cv_fail "expected 200 from preview got $PREVIEW_STATUS: $PREVIEW_BODY" $LINENO

DUP_COUNT="$(printf '%s' "$PREVIEW_BODY" | jq -r '.duplicates | length')"
[ "$DUP_COUNT" = "1" ] || cv_fail "expected exactly 1 duplicate (only the date+amount match) got $DUP_COUNT" $LINENO
DC="$(printf '%s' "$PREVIEW_BODY" | jq -r '.duplicateCount')"
[ "$DC" = "1" ] || cv_fail "expected duplicateCount 1 got $DC" $LINENO

DUP="$(printf '%s' "$PREVIEW_BODY" | jq -c '.duplicates[0]')"
ROW="$(printf '%s' "$DUP" | jq -r '.rowNumber')"
[ "$ROW" = "1" ] || cv_fail "expected flagged rowNumber 1 (the 25.00 row) got $ROW" $LINENO
IN_DATE="$(printf '%s' "$DUP" | jq -r '.expenseDate')"
[ "$IN_DATE" = "2024-03-10" ] || cv_fail "expected incoming date 2024-03-10 got $IN_DATE" $LINENO
IN_AMT="$(printf '%s' "$DUP" | jq -r '.amount')"
num_eq "$IN_AMT" 25 || cv_fail "expected incoming amount 25.00 got $IN_AMT" $LINENO
IN_NOTE="$(printf '%s' "$DUP" | jq -r '.note')"
[ "$IN_NOTE" = "$INCOMING_NOTE" ] || cv_fail "expected incoming note '$INCOMING_NOTE' got '$IN_NOTE'" $LINENO

MATCHES="$(printf '%s' "$DUP" | jq -r '.existingMatches | length')"
[ "$MATCHES" = "1" ] || cv_fail "expected 1 existing match got $MATCHES" $LINENO
EX="$(printf '%s' "$DUP" | jq -c '.existingMatches[0]')"
EX_ID="$(printf '%s' "$EX" | jq -r '.expenseId')"
[ "$EX_ID" = "$EXISTING_ID" ] || cv_fail "expected existing match expenseId $EXISTING_ID got $EX_ID" $LINENO
EX_DATE="$(printf '%s' "$EX" | jq -r '.expenseDate')"
[ "$EX_DATE" = "2024-03-10" ] || cv_fail "expected existing date 2024-03-10 got $EX_DATE" $LINENO
EX_AMT="$(printf '%s' "$EX" | jq -r '.amount')"
num_eq "$EX_AMT" 25 || cv_fail "expected existing amount 25.00 got $EX_AMT" $LINENO
EX_NOTE="$(printf '%s' "$EX" | jq -r '.note')"
[ "$EX_NOTE" = "$EXISTING_NOTE" ] || cv_fail "expected existing note '$EXISTING_NOTE' got '$EX_NOTE'" $LINENO

FLAG2="$(printf '%s' "$PREVIEW_BODY" | jq -r '[.duplicates[] | select(.rowNumber == 2)] | length')"
[ "$FLAG2" = "0" ] || cv_fail "expected same-date different-amount row 2 not flagged got flagged" $LINENO

cv_prereq "saved expense still present and unchanged" $LINENO
cv_http GET /api/expenses 200 "${AUTH[@]}"
CNT="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseCount')"
[ "$CNT" = "1" ] || cv_fail "expected 1 saved expense after preview (no rows imported) got $CNT" $LINENO

# Cleanup
cv_step Cleanup "delete the import job and the saved expense" $LINENO
if [ -n "$JOB_ID" ]; then cv_http DELETE "/api/expense-imports/${JOB_ID}" "${AUTH[@]}"; fi
if [ -n "$EXISTING_ID" ]; then cv_http DELETE "/api/expenses/${EXISTING_ID}" "${AUTH[@]}"; fi
rm -f "$CSV_FILE"

echo "CODEVALID_TEST_ASSERTION_OK:api_77507982_1"
