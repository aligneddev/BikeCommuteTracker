#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Keep Existing skips the duplicate row and the rest of the import continues.
# Endpoints: POST /api/users/signup, POST /api/expenses, POST /api/expense-imports/preview,
#            POST /api/expense-imports/{jobId}/confirm, GET /api/expenses,
#            DELETE /api/expense-imports/{jobId}, DELETE /api/expenses/{id}
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="keepex_${SUFFIX}"
RIDER_PIN="5678"
CSV_FILE="${TMPDIR:-/tmp}/expense_keep_${SUFFIX}.csv"
EXISTING_NOTE="Original helmet ${SUFFIX}"
JOB_ID=""
EXISTING_ID=""
USER_ID=""

num_eq() { jq -n --arg a "$1" --arg b "$2" '($a|tonumber) == ($b|tonumber)' | grep -q true; }

# Given
cv_step Given "rider with saved expense and a previewed CSV of one duplicate and two new rows" $LINENO
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

cv_http GET /api/expenses 200 "${AUTH[@]}"
BEFORE="$(printf '%s' "$CV_HTTP_BODY" | jq -c --argjson id "$EXISTING_ID" '.expenses[] | select(.expenseId == $id)')"
[ -n "$BEFORE" ] || cv_fail "expected saved expense $EXISTING_ID in history got: $CV_HTTP_BODY" $LINENO
BEFORE_VERSION="$(printf '%s' "$BEFORE" | jq -r '.version')"

printf 'Date,Amount,Note\n2024-03-10,25.00,Incoming dup %s\n2024-04-02,12.50,Lights %s\n2024-05-15,30.00,Tube %s\n' \
  "$SUFFIX" "$SUFFIX" "$SUFFIX" > "$CSV_FILE"

cv_prereq "preview CSV" $LINENO
cv_http POST /api/expense-imports/preview 200 "${AUTH[@]}" -F "file=@${CSV_FILE};filename=keep_${SUFFIX}.csv;type=text/csv"
JOB_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.jobId // empty')"
[ -n "$JOB_ID" ] || cv_fail "expected jobId from preview got: $CV_HTTP_BODY" $LINENO
DUP_ROW="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.duplicates[0].rowNumber // empty')"
DUP_N="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.duplicates | length')"
[ "$DUP_N" = "1" ] && [ "$DUP_ROW" = "1" ] || cv_fail "expected one duplicate at row 1 in preview got: $CV_HTTP_BODY" $LINENO

# When
cv_step When "confirm the import choosing Keep Existing for the duplicate row" $LINENO
cv_http POST "/api/expense-imports/${JOB_ID}/confirm" \
  "{\"overrideAllDuplicates\":false,\"duplicateChoices\":[{\"rowNumber\":${DUP_ROW},\"resolution\":\"keep-existing\"}]}" \
  -H "X-User-Id: ${USER_ID}"
CONFIRM_STATUS="$CV_HTTP_STATUS"
CONFIRM_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "summary shows 2 imported 1 skipped, existing unchanged, two new expenses created" $LINENO
[ "$CONFIRM_STATUS" = "200" ] || cv_fail "expected 200 from confirm got $CONFIRM_STATUS: $CONFIRM_BODY" $LINENO
IMPORTED="$(printf '%s' "$CONFIRM_BODY" | jq -r '.importedRows')"
SKIPPED="$(printf '%s' "$CONFIRM_BODY" | jq -r '.skippedRows')"
FAILED="$(printf '%s' "$CONFIRM_BODY" | jq -r '.failedRows')"
[ "$IMPORTED" = "2" ] || cv_fail "expected importedRows 2 got $IMPORTED" $LINENO
[ "$SKIPPED" = "1" ] || cv_fail "expected skippedRows 1 got $SKIPPED" $LINENO
[ "$FAILED" = "0" ] || cv_fail "expected failedRows 0 got $FAILED" $LINENO

cv_http GET /api/expenses 200 "${AUTH[@]}"
HIST="$CV_HTTP_BODY"
CNT="$(printf '%s' "$HIST" | jq -r '.expenseCount')"
[ "$CNT" = "3" ] || cv_fail "expected 3 expenses (1 existing + 2 imported) got $CNT" $LINENO

MAR10="$(printf '%s' "$HIST" | jq -r '[.expenses[] | select(.expenseDate | startswith("2024-03-10"))] | length')"
[ "$MAR10" = "1" ] || cv_fail "expected only the existing expense on 2024-03-10 (no new one for skipped row) got $MAR10" $LINENO

AFTER="$(printf '%s' "$HIST" | jq -c --argjson id "$EXISTING_ID" '.expenses[] | select(.expenseId == $id)')"
[ -n "$AFTER" ] || cv_fail "expected existing expense $EXISTING_ID still present" $LINENO
num_eq "$(printf '%s' "$AFTER" | jq -r '.amount')" 25 || cv_fail "expected existing amount 25.00 unchanged got $(printf '%s' "$AFTER" | jq -r '.amount')" $LINENO
[ "$(printf '%s' "$AFTER" | jq -r '.notes')" = "$EXISTING_NOTE" ] || cv_fail "expected existing note unchanged got $(printf '%s' "$AFTER" | jq -r '.notes')" $LINENO
[ "$(printf '%s' "$AFTER" | jq -r '.version')" = "$BEFORE_VERSION" ] || cv_fail "expected existing version $BEFORE_VERSION unchanged got $(printf '%s' "$AFTER" | jq -r '.version')" $LINENO
case "$(printf '%s' "$AFTER" | jq -r '.expenseDate')" in 2024-03-10*) ;; *) cv_fail "expected existing date 2024-03-10 unchanged" $LINENO ;; esac

APR="$(printf '%s' "$HIST" | jq -r '[.expenses[] | select((.expenseDate | startswith("2024-04-02")) and (.amount == 12.5))] | length')"
[ "$APR" = "1" ] || cv_fail "expected imported expense 2024-04-02 12.50 got $APR matches" $LINENO
MAY="$(printf '%s' "$HIST" | jq -r '[.expenses[] | select((.expenseDate | startswith("2024-05-15")) and (.amount == 30))] | length')"
[ "$MAY" = "1" ] || cv_fail "expected imported expense 2024-05-15 30.00 got $MAY matches" $LINENO

# Cleanup
cv_step Cleanup "delete import job and all expenses created for this rider" $LINENO
if [ -n "$JOB_ID" ]; then cv_http DELETE "/api/expense-imports/${JOB_ID}" "${AUTH[@]}"; fi
cv_http GET /api/expenses "${AUTH[@]}"
for id in $(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenses[]?.expenseId' 2>/dev/null || true); do
  cv_http DELETE "/api/expenses/${id}" "${AUTH[@]}"
done
rm -f "$CSV_FILE"

echo "CODEVALID_TEST_ASSERTION_OK:api_77507982_6"
