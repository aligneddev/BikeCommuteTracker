#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

# Case: login_fail_incorrect_pin

# Given
cv_step "Given" "Create a rider via signup with a valid PIN so we can attempt login with a wrong PIN" $LINENO
cv_prereq "BikeTracking API is healthy and reachable at http://app:${PORT}" $LINENO

API_BASE_URL="http://app:${PORT}"

# Use a unique rider name to avoid normalized-name uniqueness conflicts.
RIDER_NAME="IncorrectPinUser_$(date +%s)"
CORRECT_PIN="1234"

# Create the rider via the public signup endpoint so the app hashes and stores the PIN.
signup_body_file="$(mktemp)"
signup_headers_file="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$CORRECT_PIN" '{name: $name, pin: $pin}')"

echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

signup_status="$(
  curl -sS -o "$signup_body_file" -D "$signup_headers_file" -w '%{http_code}' -X POST "${API_BASE_URL}/api/users/signup" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY"
)"

signup_body="$(cat "$signup_body_file")"

RESPONSE_HEADERS="$(cat "$signup_headers_file")"
RESPONSE_BODY="$signup_body"

echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "/api/users/signup" "$signup_status"

if [ "$signup_status" -ne 201 ]; then
  cv_fail "Expected 201 Created from /api/users/signup, got $signup_status (body: $signup_body)" $LINENO
fi

signup_user_id="$(printf '%s' "$signup_body" | jq -r '.userId // empty')"
signup_user_name="$(printf '%s' "$signup_body" | jq -r '.userName // empty')"

if [ -z "$signup_user_id" ] || [ "$signup_user_id" = "0" ]; then
  cv_fail "Signup response missing or invalid userId (body: $signup_body)" $LINENO
fi

if [ -z "$signup_user_name" ] || [ "$signup_user_name" = "null" ]; then
  cv_fail "Signup response missing userName (body: $signup_body)" $LINENO
fi

# When
cv_step "When" "Call identify with the same name but an incorrect PIN" $LINENO

WRONG_PIN="9999"

identify_body_file="$(mktemp)"
identify_headers_file="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$WRONG_PIN" '{name: $name, pin: $pin}')"

echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

identify_status="$(
  curl -sS -o "$identify_body_file" -D "$identify_headers_file" -w '%{http_code}' -X POST "${API_BASE_URL}/api/users/identify" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY"
)"

identify_body="$(cat "$identify_body_file")"

RESPONSE_HEADERS="$(cat "$identify_headers_file")"
RESPONSE_BODY="$identify_body"

echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "/api/users/identify" "$identify_status"

# Then
cv_step "Then" "Verify identify denies authentication with 401 and no credential-bearing body" $LINENO

# Assert HTTP 401 Unauthorized for incorrect PIN.
if [ "$identify_status" -ne 401 ]; then
  cv_fail "Expected 401 Unauthorized from /api/users/identify for wrong PIN, got $identify_status (body: $identify_body)" $LINENO
fi

# The endpoint returns Results.Unauthorized(), which produces an empty body.
# Assert that there is no JSON payload containing userId / userName / authorized fields.
if [ -n "$identify_body" ] && [ "$identify_body" != "null" ]; then
  # If a body is present, ensure it does not contain IdentifySuccessResponse fields.
  has_user_id="$(printf '%s' "$identify_body" | jq 'has("userId") or has("userName") or has("authorized")' 2>/dev/null || echo false)"
  if [ "$has_user_id" = "true" ]; then
    cv_fail "Identify 401 response unexpectedly contains credential or user fields (body: $identify_body)" $LINENO
  fi
fi

# Teardown
cv_step "Cleanup" "No explicit teardown: test data lives only in the ephemeral app SQLite file for this run" $LINENO
# The SQLite database is scoped to the app container lifecycle for this test run,
# and is discarded when the compose stack is torn down.

# Success marker for CodeValid runner
echo "CODEVALID_TEST_ASSERTION_OK:login_fail_incorrect_pin"
