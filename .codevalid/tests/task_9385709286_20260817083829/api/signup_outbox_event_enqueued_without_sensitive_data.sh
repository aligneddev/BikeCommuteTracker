#!/usr/bin/env bash
set -euo pipefail

# Setup
source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

cv_step Given "API is healthy and ready to accept signup requests" $LINENO
cv_prereq "Wait for app health endpoint to report ready" $LINENO
HEALTH_URL="http://app:6713/health"
HEALTH_HEADERS_FILE="$(mktemp)"
echo "REQUEST_HEADERS=Accept: */*"  # curl default
echo "REQUEST_BODY="
HEALTH_STATUS="$(curl -sS -o /dev/null -D "$HEALTH_HEADERS_FILE" -w '%{http_code}' "$HEALTH_URL" || true)"
cv_http GET "$HEALTH_URL" "$HEALTH_STATUS"
echo "RESPONSE_HEADERS="
cat "$HEALTH_HEADERS_FILE" || true
echo "RESPONSE_BODY="
# no body because -o /dev/null
rm -f "$HEALTH_HEADERS_FILE"
if [[ "$HEALTH_STATUS" != "200" ]]; then
  cv_fail "Expected health check 200, got $HEALTH_STATUS" $LINENO
fi

# Case mappings table
# id                                         | method | path
# signup_outbox_event_enqueued_without_sensitive_data | POST   | /api/users/signup

# Case: signup_outbox_event_enqueued_without_sensitive_data

# Mocks
# No external vendor HTTP calls are made during signup; no WireMock stubs required.
cv_prereq "No external HTTP vendor mocks are required for signup" $LINENO

# Preconditions
cv_prereq "Construct a unique rider name and valid PIN for signup" $LINENO
BASE_NAME="Outbox Rider"
UNIX_SUFFIX="$(date +%s)"
TEST_NAME="${BASE_NAME} ${UNIX_SUFFIX}"
TEST_PIN="1234"

# When
cv_step When "POST /api/users/signup with unique name and valid PIN" $LINENO
SIGNUP_URL="http://app:6713/api/users/signup"
SIGNUP_BODY="$(jq -n --arg name "$TEST_NAME" --arg pin "$TEST_PIN" '{Name: $name, Pin: $pin}')"

echo "REQUEST_HEADERS=Content-Type: application/json"
echo "REQUEST_BODY=$SIGNUP_BODY"
SIGNUP_RAW_RESPONSE="$(mktemp)"
SIGNUP_HEADERS_FILE="$(mktemp)"
SIGNUP_STATUS_CODE="$(curl -sS -o "$SIGNUP_RAW_RESPONSE" -D "$SIGNUP_HEADERS_FILE" -w '%{http_code}' \
  -X POST "$SIGNUP_URL" \
  -H 'Content-Type: application/json' \
  -d "$SIGNUP_BODY" || true)"
cv_http POST "$SIGNUP_URL" "$SIGNUP_STATUS_CODE"
echo "RESPONSE_HEADERS="
cat "$SIGNUP_HEADERS_FILE" || true
echo "RESPONSE_BODY="
cat "$SIGNUP_RAW_RESPONSE" || true
rm -f "$SIGNUP_HEADERS_FILE"

# Then
cv_step Then "Response is 201 Created with queued/published eventStatus and no sensitive fields" $LINENO

if [[ "$SIGNUP_STATUS_CODE" != "201" ]]; then
  BODY_TEXT="$(cat "$SIGNUP_RAW_RESPONSE" 2>/dev/null || echo '')"
  cv_fail "Expected 201 from signup, got $SIGNUP_STATUS_CODE with body: $BODY_TEXT" $LINENO
fi

# Parse JSON response
if ! jq -e . "$SIGNUP_RAW_RESPONSE" >/dev/null 2>&1; then
  BODY_TEXT="$(cat "$SIGNUP_RAW_RESPONSE" 2>/dev/null || echo '')"
  cv_fail "Signup response is not valid JSON: $BODY_TEXT" $LINENO
fi

USER_ID="$(jq -r '.userId // empty' "$SIGNUP_RAW_RESPONSE")"
USER_NAME="$(jq -r '.userName // empty' "$SIGNUP_RAW_RESPONSE")"
CREATED_AT_UTC="$(jq -r '.createdAtUtc // empty' "$SIGNUP_RAW_RESPONSE")"
EVENT_STATUS="$(jq -r '.eventStatus // empty' "$SIGNUP_RAW_RESPONSE")"

# Assert userId is a positive integer
if ! [[ "$USER_ID" =~ ^[0-9]+$ ]] || (( USER_ID <= 0 )); then
  cv_fail "Expected userId to be a positive integer, got '$USER_ID'" $LINENO
fi

# Assert userName is non-empty
if [[ -z "$USER_NAME" ]]; then
  cv_fail "Expected non-empty userName in signup response, got empty" $LINENO
fi

# Assert createdAtUtc is non-empty (ISO-8601 string; shape only)
if [[ -z "$CREATED_AT_UTC" ]]; then
  cv_fail "Expected createdAtUtc timestamp in signup response, got empty" $LINENO
fi

# Assert eventStatus reflects outbox state (queued or published), per contract
if [[ "$EVENT_STATUS" != "queued" && "$EVENT_STATUS" != "published" ]]; then
  cv_fail "Expected eventStatus to be 'queued' or 'published' to reflect outbox queuing, got '$EVENT_STATUS'" $LINENO
fi

# Assert that no sensitive credential or PIN fields are present in the response
if jq -e 'has("pin") or has("Pin") or has("pinHash") or has("PinHash") or has("pinSalt") or has("PinSalt") or has("hashAlgorithm") or has("HashAlgorithm") or has("iterationCount") or has("IterationCount")' "$SIGNUP_RAW_RESPONSE" >/dev/null 2>&1; then
  SENSITIVE_KEYS="$(jq -r 'to_entries | map(select(.key | test("^(pin|Pin|pinHash|PinHash|pinSalt|PinSalt|hashAlgorithm|HashAlgorithm|iterationCount|IterationCount)$"))) | map(.key) | join(",")' "$SIGNUP_RAW_RESPONSE")"
  cv_fail "Signup response must not expose sensitive credential fields, but found keys: $SENSITIVE_KEYS" $LINENO
fi

# Teardown
cv_step Cleanup "No teardown steps; user deletion is not exposed via API and DB is local to app container" $LINENO
rm -f "$SIGNUP_RAW_RESPONSE"

echo "CODEVALID_TEST_ASSERTION_OK:signup_outbox_event_enqueued_without_sensitive_data"