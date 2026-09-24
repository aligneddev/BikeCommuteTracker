#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

cv_prereq "Signup duplicate-name case-insensitive: API up, DB migrated (EF Core on SQLite in app container)" $LINENO
BASE_URL="http://app:6713"
SIGNUP_URL="$BASE_URL/api/users/signup"

cv_step "Given" "Ensure no prior conflicting user and create a baseline user 'Alice'" $LINENO

# Create initial user with display name 'Alice' so that its normalized name is stored.
REQUEST_BODY_1='{
  "name": "Alice",
  "pin": "1234"
}'

REQUEST_HEADERS_FILE_1="/tmp/signup1_headers.txt"
RESPONSE_BODY_FILE_1="/tmp/signup1.json"

echo "REQUEST_HEADERS (signup1): Content-Type: application/json" >&2
echo "REQUEST_BODY (signup1): $REQUEST_BODY_1" >&2

RESPONSE_1_JSON="$(curl -sS -D "$REQUEST_HEADERS_FILE_1" -o "$RESPONSE_BODY_FILE_1" -w "%{http_code}" \
  -X POST "$SIGNUP_URL" \
  -H "Content-Type: application/json" \
  --data "$REQUEST_BODY_1")" || cv_fail "First signup request for Alice failed to reach API" $LINENO

echo "RESPONSE_HEADERS (signup1):" >&2
cat "$REQUEST_HEADERS_FILE_1" >&2 || true

echo "RESPONSE_BODY (signup1):" >&2
cat "$RESPONSE_BODY_FILE_1" >&2 || true

cv_http "POST" "$SIGNUP_URL" "$RESPONSE_1_JSON"

if [ "$RESPONSE_1_JSON" -ne 201 ]; then
  BODY="$(cat "$RESPONSE_BODY_FILE_1" || true)"
  cv_fail "Expected first signup for Alice to return 201 Created, got $RESPONSE_1_JSON with body: $BODY" $LINENO
fi

USER_ID_1="$(jq -r '.userId' "$RESPONSE_BODY_FILE_1" || echo "")"
USER_NAME_1="$(jq -r '.userName' "$RESPONSE_BODY_FILE_1" || echo "")"

if [ -z "$USER_ID_1" ] || [ "$USER_ID_1" = "null" ] || [ "$USER_ID_1" -le 0 ] 2>/dev/null; then
  BODY="$(cat "$RESPONSE_BODY_FILE_1" || true)"
  cv_fail "Expected first signup response to contain a positive userId, got body: $BODY" $LINENO
fi

if [ "$USER_NAME_1" != "Alice" ]; then
  BODY="$(cat "$RESPONSE_BODY_FILE_1" || true)"
  cv_fail "Expected first signup response userName to be 'Alice', got '$USER_NAME_1' with body: $BODY" $LINENO
fi

cv_step "When" "Attempt to sign up second user with name that normalizes to existing user's name" $LINENO

# Second signup attempt with name that trims and normalizes case-insensitively to same normalized name.
REQUEST_BODY_2='{
  "name": "  aLiCe  ",
  "pin": "5678"
}'

REQUEST_HEADERS_FILE_2="/tmp/signup2_headers.txt"
RESPONSE_BODY_FILE_2="/tmp/signup2.json"

echo "REQUEST_HEADERS (signup2): Content-Type: application/json" >&2
echo "REQUEST_BODY (signup2): $REQUEST_BODY_2" >&2

RESPONSE_2_STATUS="$(curl -sS -D "$REQUEST_HEADERS_FILE_2" -o "$RESPONSE_BODY_FILE_2" -w "%{http_code}" \
  -X POST "$SIGNUP_URL" \
  -H "Content-Type: application/json" \
  --data "$REQUEST_BODY_2")" || cv_fail "Second signup request (duplicate normalized name) failed to reach API" $LINENO

echo "RESPONSE_HEADERS (signup2):" >&2
cat "$REQUEST_HEADERS_FILE_2" >&2 || true

echo "RESPONSE_BODY (signup2):" >&2
cat "$RESPONSE_BODY_FILE_2" >&2 || true

cv_http "POST" "$SIGNUP_URL" "$RESPONSE_2_STATUS"

cv_step "Then" "Verify duplicate normalized name signup is rejected with 409 and name_already_exists" $LINENO

if [ "$RESPONSE_2_STATUS" -ne 409 ]; then
  BODY="$(cat "$RESPONSE_BODY_FILE_2" || true)"
  cv_fail "Expected duplicate-name signup to return 409 Conflict, got $RESPONSE_2_STATUS with body: $BODY" $LINENO
fi

ERROR_CODE="$(jq -r '.code' "$RESPONSE_BODY_FILE_2" || echo "")"
ERROR_MESSAGE="$(jq -r '.message' "$RESPONSE_BODY_FILE_2" || echo "")"

if [ "$ERROR_CODE" != "name_already_exists" ]; then
  BODY="$(cat "$RESPONSE_BODY_FILE_2" || true)"
  cv_fail "Expected error.code to be 'name_already_exists', got '$ERROR_CODE' with body: $BODY" $LINENO
fi

if [ "$ERROR_MESSAGE" != "name already exists" ]; then
  BODY="$(cat "$RESPONSE_BODY_FILE_2" || true)"
  cv_fail "Expected error.message to be 'name already exists', got '$ERROR_MESSAGE' with body: $BODY" $LINENO
fi

cv_step "Cleanup" "No explicit teardown available via API for users; leave created user as test data" $LINENO
# The API surface does not expose a DELETE for users; no cleanup is performed here.

echo "CODEVALID_TEST_ASSERTION_OK:signup_reject_duplicate_name_case_insensitive"
