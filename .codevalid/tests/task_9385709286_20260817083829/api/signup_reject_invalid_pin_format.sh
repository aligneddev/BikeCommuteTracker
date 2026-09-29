#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh
cv_prereq "API container is healthy on http://app:6713 and SQLite schema is migrated" $LINENO

# Case: signup_reject_invalid_pin_format

# No external HTTP vendors are called during signup; no WireMock stubs needed.

cv_step Given "Ensure no pre-existing user with this normalized name causes a conflict" $LINENO

BASE_URL="http://app:6713"
CASE_NAME="Case InvalidPinFormat Rider"
INVALID_PIN="12ab"   # violates numeric-only 4–8 digit PIN policy
VALID_PIN="1234"     # satisfies numeric-only 4–8 digit PIN policy

# Attempt a cleanup-signup with a valid PIN; if it succeeds, we know a user existed
# and must not run the case with this name. We treat an unexpected 201 as a precondition failure.
precheck_payload=$(jq -nc --arg name "$CASE_NAME" --arg pin "$VALID_PIN" '{name:$name, pin:$pin}')

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$precheck_payload"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

precheck_response=$(curl -sS -w '
%{http_code}' -X POST "$BASE_URL/api/users/signup" \
  -H "Content-Type: application/json" \
  -d "$precheck_payload")
precheck_body=$(printf '%s' "$precheck_response" | sed '$d')
precheck_status=$(printf '%s' "$precheck_response" | tail -n1)

RESPONSE_HEADERS="<not-captured-in-plan>"
RESPONSE_BODY="$precheck_body"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "$BASE_URL/api/users/signup" "$precheck_status"

if [ "$precheck_status" = "201" ]; then
  cv_fail "Precondition failed: a user with name '$CASE_NAME' already existed and was just created; choose a different CASE_NAME for this test." $LINENO
fi

# 400 here is expected because the PIN may violate format rules or other validation;
# 409 would indicate a true name conflict. Any 2xx other than 201 is not produced by this endpoint.
if [ "$precheck_status" = "409" ]; then
  cv_fail "Precondition failed: Users.NormalizedName for '$CASE_NAME' already exists (409 conflict) before running the test." $LINENO
fi

cv_step When "POST /api/users/signup with a valid unique name but an invalid PIN format" $LINENO

request_payload=$(jq -nc --arg name "$CASE_NAME" --arg pin "$INVALID_PIN" '{name:$name, pin:$pin}')

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$request_payload"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

response=$(curl -sS -w '
%{http_code}' -X POST "$BASE_URL/api/users/signup" \
  -H "Content-Type: application/json" \
  -d "$request_payload")
body=$(printf '%s' "$response" | sed '$d')
status=$(printf '%s' "$response" | tail -n1)

RESPONSE_HEADERS="<not-captured-in-plan>"
RESPONSE_BODY="$body"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "$BASE_URL/api/users/signup" "$status"

cv_step Then "Signup with invalid PIN is rejected with validation error and no user is persisted" $LINENO

# Assert HTTP 400
if [ "$status" -ne 400 ]; then
  cv_fail "Expected 400 Bad Request for invalid PIN signup, got HTTP $status" $LINENO
fi

# Parse ErrorResponse { code, message, details? }
error_code=$(printf '%s' "$body" | jq -r '.code // empty')
error_message=$(printf '%s' "$body" | jq -r '.message // empty')

if [ "$error_code" != "validation_failed" ]; then
  cv_fail "Expected error.code 'validation_failed' for invalid PIN, got '${error_code:-<missing>}'" $LINENO
fi

if [ "$error_message" != "Validation failed." ]; then
  cv_fail "Expected error.message 'Validation failed.', got '${error_message:-<missing>}'" $LINENO
fi

# Ensure there is at least one validation detail message, indicating the PIN (or other fields) failed validation.
details_count=$(printf '%s' "$body" | jq '.details | length // 0')
if [ "$details_count" -lt 1 ]; then
  cv_fail "Expected at least one validation error detail for invalid PIN, got $details_count" $LINENO
fi

# Now prove that no user or credentials were persisted by successfully signing up
# the same name with a valid PIN. If the first attempt had created a user,
# this second call would return 409 Conflict due to the unique NormalizedName index.
cv_prereq "Retry signup with same name but valid PIN; should succeed if first attempt persisted nothing" $LINENO

second_payload=$(jq -nc --arg name "$CASE_NAME" --arg pin "$VALID_PIN" '{name:$name, pin:$pin}')

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$second_payload"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

second_response=$(curl -sS -w '
%{http_code}' -X POST "$BASE_URL/api/users/signup" \
  -H "Content-Type: application/json" \
  -d "$second_payload")
second_body=$(printf '%s' "$second_response" | sed '$d')
second_status=$(printf '%s' "$second_response" | tail -n1)

RESPONSE_HEADERS="<not-captured-in-plan>"
RESPONSE_BODY="$second_body"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "$BASE_URL/api/users/signup" "$second_status"

if [ "$second_status" -ne 201 ]; then
  cv_fail "Expected 201 Created on second signup with valid PIN (proving no user was created on invalid PIN), got HTTP $second_status" $LINENO
fi

# Validate minimal fields of SignupSuccessResponse { userId, userName, createdAtUtc, eventStatus }
user_id=$(printf '%s' "$second_body" | jq '.userId // 0')
if [ "$user_id" -le 0 ]; then
  cv_fail "Expected positive userId in successful signup response, got '$user_id'" $LINENO
fi

user_name=$(printf '%s' "$second_body" | jq -r '.userName // empty')
if [ -z "$user_name" ]; then
  cv_fail "Expected non-empty userName in successful signup response" $LINENO
fi

created_at=$(printf '%s' "$second_body" | jq -r '.createdAtUtc // empty')
if [ -z "$created_at" ]; then
  cv_fail "Expected createdAtUtc timestamp in successful signup response" $LINENO
fi

# eventStatus is asserted to reflect outbox semantics per requirement; the frontend
# contract allows "queued" or "published". We accept either here.
event_status=$(printf '%s' "$second_body" | jq -r '.eventStatus // empty')
if [ "$event_status" != "queued" ] && [ "$event_status" != "published" ]; then
  cv_fail "Expected eventStatus to be 'queued' or 'published', got '${event_status:-<missing>}'" $LINENO
fi

cv_step Cleanup "No explicit cleanup; the created user remains in the local SQLite database" $LINENO
# The application does not expose a DELETE users endpoint; leaving the test user in-place.

echo "CODEVALID_TEST_ASSERTION_OK:signup_reject_invalid_pin_format"