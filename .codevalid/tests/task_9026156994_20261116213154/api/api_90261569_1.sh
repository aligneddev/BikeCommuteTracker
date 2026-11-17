#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
PIN="1234"

# Helpers (auth is the X-User-Id header, see UserIdHeaderAuthenticationHandler.cs)
signup() {
  local name="$1"
  cv_http POST /api/users/signup "$(jq -nc --arg n "$name" --arg p "$PIN" '{name:$n,pin:$p}')"
  [ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup of $name got $CV_HTTP_STATUS" $LINENO
  SIGNUP_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
  [ -n "$SIGNUP_ID" ] || cv_fail "expected userId in signup response got none" $LINENO
}

add_expense() {
  # $1 user id, $2 date, $3 amount, $4 notes (may be empty)
  cv_http POST /api/expenses -H "X-User-Id: $1" \
    -F "expenseDate=$2" -F "amount=$3" --form-string "notes=$4"
  [ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 creating expense for user $1 got $CV_HTTP_STATUS" $LINENO
  LAST_EXPENSE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.expenseId // empty')"
  [ -n "$LAST_EXPENSE_ID" ] || cv_fail "expected expenseId in create response got none" $LINENO
}

# Given
cv_step Given "Two riders exist; rider A has several expenses, rider B has one of its own" $LINENO
cv_prereq "Sign up rider A and rider B" $LINENO
signup "Export Rider A $SUFFIX"; RIDER_A="$SIGNUP_ID"
signup "Export Rider B $SUFFIX"; RIDER_B="$SIGNUP_ID"

NOTE_A1="Chain lube A-$SUFFIX"
NOTE_A2="Pump, \"fast\" A-$SUFFIX"
NOTE_B="Other rider secret B-$SUFFIX"

cv_prereq "Create three expenses for rider A" $LINENO
A_IDS=()
add_expense "$RIDER_A" "2026-03-10" "12.75" "$NOTE_A1"; A_IDS+=("$LAST_EXPENSE_ID")
add_expense "$RIDER_A" "2026-02-05" "3.4" "$NOTE_A2"; A_IDS+=("$LAST_EXPENSE_ID")
add_expense "$RIDER_A" "2026-01-20" "100" ""; A_IDS+=("$LAST_EXPENSE_ID")

cv_prereq "Create one expense for rider B" $LINENO
add_expense "$RIDER_B" "2026-03-11" "55.25" "$NOTE_B"; B_ID="$LAST_EXPENSE_ID"

# When
cv_step When "Rider A triggers Export Expenses (GET /api/exports/expenses)" $LINENO
cv_http GET /api/exports/expenses -H "X-User-Id: $RIDER_A"
EXPORT_STATUS="$CV_HTTP_STATUS"
EXPORT_HEADERS="$(cat "$CV_HTTP_HEADERS_FILE")"
EXPORT_BODY="$(cat "$CV_HTTP_BODY_FILE"; echo x)"; EXPORT_BODY="${EXPORT_BODY%x}"

# Then
cv_step Then "A single CSV file is downloaded with header row and exactly rider A's expenses" $LINENO
[ "$EXPORT_STATUS" = "200" ] || cv_fail "expected 200 from export got $EXPORT_STATUS" $LINENO

CTYPE="$(printf '%s' "$EXPORT_HEADERS" | grep -i '^content-type:' | tr -d '\r' || true)"
printf '%s' "$CTYPE" | grep -qi 'text/csv' || cv_fail "expected Content-Type text/csv got '$CTYPE'" $LINENO

CDISP="$(printf '%s' "$EXPORT_HEADERS" | grep -i '^content-disposition:' | tr -d '\r' || true)"
printf '%s' "$CDISP" | grep -qi 'attachment' || cv_fail "expected Content-Disposition attachment got '$CDISP'" $LINENO
printf '%s' "$CDISP" | grep -qiE 'filename="?[^";]+\.csv' || cv_fail "expected a .csv download filename got '$CDISP'" $LINENO

BODY_NOCR="$(printf '%s' "$EXPORT_BODY" | tr -d '\r')"
HEADER_LINE="$(printf '%s\n' "$BODY_NOCR" | head -n1 | sed 's/^\xEF\xBB\xBF//')"
[ "$HEADER_LINE" = "Date,Amount,Notes,CreatedAtUtc" ] || cv_fail "expected header 'Date,Amount,Notes,CreatedAtUtc' got '$HEADER_LINE'" $LINENO

DATA_LINES="$(printf '%s\n' "$BODY_NOCR" | tail -n +2 | grep -v '^$' || true)"
ROW_COUNT="$(printf '%s' "$DATA_LINES" | grep -c . || true)"
[ "$ROW_COUNT" = "3" ] || cv_fail "expected exactly 3 data rows for rider A got $ROW_COUNT" $LINENO

printf '%s\n' "$DATA_LINES" | grep -qE "^2026-03-10,12\.75,Chain lube A-$SUFFIX,[^,]+$" \
  || cv_fail "expected row '2026-03-10,12.75,$NOTE_A1,<created>' not found" $LINENO
printf '%s\n' "$DATA_LINES" | grep -qF "2026-02-05,3.4,\"Pump, \"\"fast\"\" A-$SUFFIX\"," \
  || cv_fail "expected quoted/escaped row for '$NOTE_A2' not found" $LINENO
printf '%s\n' "$DATA_LINES" | grep -qE "^2026-01-20,100,,[^,]+$" \
  || cv_fail "expected row '2026-01-20,100,,<created>' with blank notes not found" $LINENO

if printf '%s' "$BODY_NOCR" | grep -qF "B-$SUFFIX"; then
  cv_fail "expected no data of rider B in rider A's export but found '$NOTE_B'" $LINENO
fi
if printf '%s' "$BODY_NOCR" | grep -qF "55.25"; then
  cv_fail "expected rider B's amount 55.25 absent from rider A's export but found it" $LINENO
fi

# Cleanup
cv_step Cleanup "Delete the expenses created for both riders" $LINENO
for id in "${A_IDS[@]}"; do
  cv_http DELETE "/api/expenses/$id" -H "X-User-Id: $RIDER_A" || true
done
cv_http DELETE "/api/expenses/$B_ID" -H "X-User-Id: $RIDER_B" || true

echo "CODEVALID_TEST_ASSERTION_OK:api_90261569_1"
