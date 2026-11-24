#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
WORK="$(mktemp -d)"
RIDER_A_NAME="exporter${SUFFIX}"
RIDER_B_NAME="other${SUFFIX}"
PIN="4821"
NOTE_A_2024_1="a2024first-${SUFFIX}"
NOTE_A_2024_2="a2024second-${SUFFIX}"
NOTE_A_2025="a2025only-${SUFFIX}"
NOTE_B_2023="otherrider-${SUFFIX}"

A_RIDE_IDS=()
B_RIDE_IDS=()

signup() {
  local name="$1"
  cv_http POST /api/users/signup "$(jq -nc --arg n "$name" --arg p "$PIN" '{name:$n,pin:$p}')"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 signing up $name got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
  fi
  SIGNUP_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
}

record_ride() {
  local uid="$1" dt="$2" miles="$3" note="$4"
  cv_http POST /api/rides \
    "$(jq -nc --arg d "$dt" --argjson m "$miles" --arg n "$note" \
      '{rideDateTimeLocal:$d,miles:$m,rideMinutes:30,note:$n,weatherUserOverridden:true}')" \
    -H "X-User-Id: $uid"
  if [ "$CV_HTTP_STATUS" != "201" ]; then
    cv_fail "expected 201 recording ride $dt got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
  fi
  RIDE_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId')"
}

# Given
cv_step Given "two riders exist; rider A has rides in 2024 (2) and 2025 (1), rider B has a 2023 ride" $LINENO
cv_prereq "sign up rider A and rider B" $LINENO
signup "$RIDER_A_NAME"; RIDER_A_ID="$SIGNUP_ID"
signup "$RIDER_B_NAME"; RIDER_B_ID="$SIGNUP_ID"
cv_prereq "record rider A's rides" $LINENO
record_ride "$RIDER_A_ID" "2024-03-10T08:15:00" 5.5 "$NOTE_A_2024_1"; A_RIDE_IDS+=("$RIDE_ID")
record_ride "$RIDER_A_ID" "2024-11-02T17:40:00" 7.25 "$NOTE_A_2024_2"; A_RIDE_IDS+=("$RIDE_ID")
record_ride "$RIDER_A_ID" "2025-06-21T07:05:00" 12 "$NOTE_A_2025"; A_RIDE_IDS+=("$RIDE_ID")
cv_prereq "record rider B's ride" $LINENO
record_ride "$RIDER_B_ID" "2023-05-05T09:00:00" 3 "$NOTE_B_2023"; B_RIDE_IDS+=("$RIDE_ID")

# When
cv_step When "rider A requests the ride history export" $LINENO
# Binary body: download with curl directly (cv_http would print the ZIP bytes), then emit the marker.
EXPORT_STATUS="$(curl -sS -H "X-User-Id: $RIDER_A_ID" -D "$WORK/headers.txt" -o "$WORK/export.zip" \
  -w '%{http_code}' "$BASE_URL/api/exports/rides" || echo 000)"
cv_http GET "$BASE_URL/api/exports/rides" "$EXPORT_STATUS"
echo "RESPONSE_HEADERS:"; cat "$WORK/headers.txt"
echo "ZIP size: $(wc -c < "$WORK/export.zip") bytes"
if [ "$EXPORT_STATUS" != "200" ]; then
  cv_fail "expected 200 from GET /api/exports/rides got $EXPORT_STATUS" $LINENO
fi

# Then
cv_step Then "ZIP contains exactly 2024.csv and 2025.csv with only rider A's rides of each year" $LINENO
if ! grep -qi '^content-type: application/zip' "$WORK/headers.txt"; then
  cv_fail "expected Content-Type application/zip got $(grep -i '^content-type' "$WORK/headers.txt" || echo none)" $LINENO
fi
if ! unzip -tq "$WORK/export.zip" >/dev/null 2>&1; then
  cv_fail "expected a valid ZIP archive got an unreadable body" $LINENO
fi
ENTRIES="$(unzip -Z1 "$WORK/export.zip" | sort | tr '\n' ' ' | sed 's/ $//')"
echo "ZIP entries: $ENTRIES"
if [ "$ENTRIES" != "2024.csv 2025.csv" ]; then
  cv_fail "expected ZIP entries '2024.csv 2025.csv' got '$ENTRIES'" $LINENO
fi
unzip -p "$WORK/export.zip" 2024.csv | tr -d '\r' | sed '1s/^\xEF\xBB\xBF//' > "$WORK/2024.csv"
unzip -p "$WORK/export.zip" 2025.csv | tr -d '\r' | sed '1s/^\xEF\xBB\xBF//' > "$WORK/2025.csv"
echo "--- 2024.csv"; cat "$WORK/2024.csv"
echo "--- 2025.csv"; cat "$WORK/2025.csv"

for y in 2024 2025; do
  if ! head -n1 "$WORK/$y.csv" | grep -q 'Date'; then
    cv_fail "expected $y.csv to start with a header row got '$(head -n1 "$WORK/$y.csv")'" $LINENO
  fi
  bad="$(tail -n +2 "$WORK/$y.csv" | grep -v '^$' | grep -v "^\"\?$y-" || true)"
  if [ -n "$bad" ]; then
    cv_fail "expected every row of $y.csv to be a $y ride got '$bad'" $LINENO
  fi
done

ROWS_2024="$(tail -n +2 "$WORK/2024.csv" | grep -c -v '^$' || true)"
ROWS_2025="$(tail -n +2 "$WORK/2025.csv" | grep -c -v '^$' || true)"
[ "$ROWS_2024" = "2" ] || cv_fail "expected 2 data rows in 2024.csv got $ROWS_2024" $LINENO
[ "$ROWS_2025" = "1" ] || cv_fail "expected 1 data row in 2025.csv got $ROWS_2025" $LINENO

grep -q "$NOTE_A_2024_1" "$WORK/2024.csv" || cv_fail "expected 2024.csv to contain ride note $NOTE_A_2024_1" $LINENO
grep -q "$NOTE_A_2024_2" "$WORK/2024.csv" || cv_fail "expected 2024.csv to contain ride note $NOTE_A_2024_2" $LINENO
grep -q "$NOTE_A_2025" "$WORK/2025.csv" || cv_fail "expected 2025.csv to contain ride note $NOTE_A_2025" $LINENO
if cat "$WORK/2024.csv" "$WORK/2025.csv" | grep -q "$NOTE_B_2023"; then
  cv_fail "expected no rides of rider B in rider A's export got note $NOTE_B_2023" $LINENO
fi

# Cleanup
cv_step Cleanup "delete the rides created for both riders" $LINENO
for id in "${A_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/$id" -H "X-User-Id: $RIDER_A_ID" || true
done
for id in "${B_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/$id" -H "X-User-Id: $RIDER_B_ID" || true
done
rm -rf "$WORK"

echo "CODEVALID_TEST_ASSERTION_OK:api_21996398_1"
