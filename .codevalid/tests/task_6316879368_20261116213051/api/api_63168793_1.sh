#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Case: api_63168793_1 — Rider imports a valid CSV through preview and confirmation
BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="CsvImportRider${SUFFIX}"
RIDER_PIN="4821"
WORK_DIR="$(mktemp -d)"
CSV_FILE="${WORK_DIR}/expenses-${SUFFIX}.csv"

NOTE1="Chain lube ${SUFFIX}"
NOTE2="Brake pads ${SUFFIX}"
NOTE3="Tube ${SUFFIX}"

# Upload a multipart CSV file (cv_http adds no JSON body here, only curl args).
upload_preview() {
  cv_http POST /api/expense-imports/preview \
    -H "X-User-Id: ${RIDER_ID}" \
    -F "file=@${CSV_FILE};type=text/csv;filename=expenses-${SUFFIX}.csv"
}

# Find an expense row by date (YYYY-MM-DD), amount and note in a history body.
find_expense() {
  local body="$1" date="$2" amount="$3" note="$4"
  printf '%s' "$body" | jq -c --arg d "$date" --argjson a "$amount" --arg n "$note" \
    '[.expenses[] | select((.expenseDate | tostring | startswith($d)) and (.amount == $a) and (.notes == $n))]'
}

# Given
cv_step Given "Sign up a new rider with no saved expenses and write a 3-row valid CSV" $LINENO
cv_prereq "Sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
if [ "$CV_HTTP_STATUS" != "201" ]; then
  cv_fail "expected 201 from signup got ${CV_HTTP_STATUS}" $LINENO
fi
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "expected userId in signup response got '${CV_HTTP_BODY}'" $LINENO
fi

cv_prereq "Confirm rider has no saved expenses (so no row can be a duplicate)" $LINENO
cv_http GET /api/expenses 200 -H "X-User-Id: ${RIDER_ID}"
PRE_COUNT="$(printf '%s' "$CV_HTTP_BODY" | jq '.expenses | length')"
if [ "$PRE_COUNT" != "0" ]; then
  cv_fail "expected 0 saved expenses before import got ${PRE_COUNT}" $LINENO
fi

cat >"$CSV_FILE" <<CSV
Date,Amount,Note
2026-03-01,12.50,${NOTE1}
2026-03-05,45.00,${NOTE2}
2026-03-09,8.75,${NOTE3}
CSV

# When
cv_step When "Upload the CSV for preview, then confirm the import job" $LINENO
upload_preview
PREVIEW_STATUS="$CV_HTTP_STATUS"
PREVIEW_BODY="$CV_HTTP_BODY"
if [ "$PREVIEW_STATUS" != "200" ]; then
  cv_fail "expected 200 from preview got ${PREVIEW_STATUS}: ${PREVIEW_BODY}" $LINENO
fi
JOB_ID="$(printf '%s' "$PREVIEW_BODY" | jq -r '.jobId')"
if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  cv_fail "expected jobId in preview got '${PREVIEW_BODY}'" $LINENO
fi

cv_http POST "/api/expense-imports/${JOB_ID}/confirm" \
  '{"overrideAllDuplicates":false,"duplicateChoices":[]}' \
  -H "X-User-Id: ${RIDER_ID}"
CONFIRM_STATUS="$CV_HTTP_STATUS"
CONFIRM_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "Preview counts/samples/no errors, summary 3/3/0/0, three expenses in history without receipts" $LINENO
FAILURES=()

# Preview assertions
TOTAL="$(printf '%s' "$PREVIEW_BODY" | jq -r '.totalRows')"
VALID="$(printf '%s' "$PREVIEW_BODY" | jq -r '.validRows')"
INVALID="$(printf '%s' "$PREVIEW_BODY" | jq -r '.invalidRows')"
ERR_COUNT="$(printf '%s' "$PREVIEW_BODY" | jq -r '(.errors // []) | length')"
DUP_COUNT="$(printf '%s' "$PREVIEW_BODY" | jq -r '.duplicateCount')"
DUP_LIST="$(printf '%s' "$PREVIEW_BODY" | jq -r '(.duplicates // []) | length')"
[ "$TOTAL" = "3" ] || FAILURES+=("preview totalRows expected 3 got ${TOTAL}")
[ "$VALID" = "3" ] || FAILURES+=("preview validRows expected 3 got ${VALID}")
[ "$INVALID" = "0" ] || FAILURES+=("preview invalidRows expected 0 got ${INVALID}")
[ "$ERR_COUNT" = "0" ] || FAILURES+=("preview errors expected empty got ${ERR_COUNT}")
[ "$DUP_COUNT" = "0" ] || FAILURES+=("preview duplicateCount expected 0 got ${DUP_COUNT}")
[ "$DUP_LIST" = "0" ] || FAILURES+=("preview duplicates expected empty got ${DUP_LIST}")

# Sample rows: the preview must carry a non-empty list of the parsed rows.
SAMPLE_LEN="$(printf '%s' "$PREVIEW_BODY" | jq -r '
  [ .sampleRows, .samples, .previewRows, .rows ] | map(select(type == "array")) | (.[0] // []) | length')"
if [ "$SAMPLE_LEN" -lt 1 ]; then
  FAILURES+=("preview expected sample rows (non-empty sampleRows/rows array) got none; preview keys: $(printf '%s' "$PREVIEW_BODY" | jq -c 'keys')")
fi

# Summary assertions
if [ "$CONFIRM_STATUS" != "200" ]; then
  FAILURES+=("confirm expected 200 got ${CONFIRM_STATUS}: ${CONFIRM_BODY}")
else
  S_TOTAL="$(printf '%s' "$CONFIRM_BODY" | jq -r '.totalRows')"
  S_IMP="$(printf '%s' "$CONFIRM_BODY" | jq -r '.importedRows')"
  S_SKIP="$(printf '%s' "$CONFIRM_BODY" | jq -r '.skippedRows')"
  S_FAIL="$(printf '%s' "$CONFIRM_BODY" | jq -r '.failedRows')"
  [ "$S_TOTAL" = "3" ] || FAILURES+=("summary totalRows expected 3 got ${S_TOTAL}")
  [ "$S_IMP" = "3" ] || FAILURES+=("summary importedRows expected 3 got ${S_IMP}")
  [ "$S_SKIP" = "0" ] || FAILURES+=("summary skippedRows expected 0 got ${S_SKIP}")
  [ "$S_FAIL" = "0" ] || FAILURES+=("summary failedRows expected 0 got ${S_FAIL}")
fi

# Expense history read-back
cv_http GET /api/expenses 200 -H "X-User-Id: ${RIDER_ID}"
HISTORY_BODY="$CV_HTTP_BODY"
HIST_COUNT="$(printf '%s' "$HISTORY_BODY" | jq '.expenses | length')"
[ "$HIST_COUNT" = "3" ] || FAILURES+=("expense history expected 3 expenses got ${HIST_COUNT}")
for spec in "2026-03-01|12.50|${NOTE1}" "2026-03-05|45.00|${NOTE2}" "2026-03-09|8.75|${NOTE3}"; do
  IFS='|' read -r d a n <<<"$spec"
  MATCH="$(find_expense "$HISTORY_BODY" "$d" "$a" "$n")"
  M_LEN="$(printf '%s' "$MATCH" | jq 'length')"
  if [ "$M_LEN" != "1" ]; then
    FAILURES+=("expected exactly one expense ${d} ${a} '${n}' got ${M_LEN}")
  else
    HAS_RECEIPT="$(printf '%s' "$MATCH" | jq -r '.[0].hasReceipt')"
    [ "$HAS_RECEIPT" = "false" ] || FAILURES+=("expense ${d} ${a} expected hasReceipt=false got ${HAS_RECEIPT}")
  fi
done

if [ "${#FAILURES[@]}" -gt 0 ]; then
  MSG="$(printf '%s; ' "${FAILURES[@]}")"
  # Cleanup best effort before failing
  for id in $(printf '%s' "$HISTORY_BODY" | jq -r '.expenses[].expenseId' 2>/dev/null); do
    command curl -s -o /dev/null -X DELETE -H "X-User-Id: ${RIDER_ID}" "${BASE_URL}/api/expenses/${id}" || true
  done
  command curl -s -o /dev/null -X DELETE -H "X-User-Id: ${RIDER_ID}" "${BASE_URL}/api/expense-imports/${JOB_ID}" || true
  rm -rf "$WORK_DIR"
  cv_fail "${MSG}" $LINENO
fi

# Cleanup
cv_step Cleanup "Delete imported expenses and the import job" $LINENO
for id in $(printf '%s' "$HISTORY_BODY" | jq -r '.expenses[].expenseId'); do
  cv_http DELETE "/api/expenses/${id}" -H "X-User-Id: ${RIDER_ID}"
done
cv_http DELETE "/api/expense-imports/${JOB_ID}" -H "X-User-Id: ${RIDER_ID}"
rm -rf "$WORK_DIR"

echo "CODEVALID_TEST_ASSERTION_OK:api_63168793_1"
