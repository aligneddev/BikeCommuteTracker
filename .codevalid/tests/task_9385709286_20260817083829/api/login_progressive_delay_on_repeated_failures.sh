#!/usr/bin/env bash
set -euo pipefail

# Setup
source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh
cv_prereq "BikeTracking API is healthy via docker-compose healthcheck" $LINENO

API_BASE="http://app:${PORT}"
CASE_ID="login_progressive_delay_on_repeated_failures"

# Case: login_progressive_delay_on_repeated_failures

# Mocks
cv_step "Given" "No additional vendor mocks needed for identify throttling" $LINENO

# Preconditions
cv_step "Given" "Create a rider via POST /api/users/signup for throttling checks" $LINENO

RIDER_NAME="ThrottleRider"
RIDER_PIN="1234"

SIGNUP_PAYLOAD=$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS=$(printf 'Content-Type: application/json')
REQUEST_BODY="$SIGNUP_PAYLOAD"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS=$(curl -sS -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_RESP_FILE" -w "%{http_code}" \
  -X POST "$API_BASE/api/users/signup" \
  -H "Content-Type: application/json" \
  -d "$SIGNUP_PAYLOAD")

echo "RESPONSE_HEADERS:" && cat "$SIGNUP_HDR_FILE"
RESPONSE_BODY_CONTENT="$(cat "$SIGNUP_RESP_FILE")"
echo "RESPONSE_BODY: $RESPONSE_BODY_CONTENT"

cv_http "POST" "/api/users/signup" "$HTTP_STATUS"

if [ "$HTTP_STATUS" != "201" ]; then
  BODY="$RESPONSE_BODY_CONTENT"
  cv_fail "Expected 201 from /api/users/signup, got $HTTP_STATUS. Body: $BODY" $LINENO
fi

RIDER_ID=$(jq -r '.userId' < "$SIGNUP_RESP_FILE")
RETURNED_NAME=$(jq -r '.userName' < "$SIGNUP_RESP_FILE")

if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ] || [ "$RIDER_ID" -le 0 ] 2>/dev/null; then
  BODY="$RESPONSE_BODY_CONTENT"
  cv_fail "Signup did not return a valid positive userId. Body: $BODY" $LINENO
fi

if [ "$RETURNED_NAME" != "$RIDER_NAME" ]; then
  BODY="$RESPONSE_BODY_CONTENT"
  cv_fail "Signup returned unexpected userName '$RETURNED_NAME' (expected '$RIDER_NAME'). Body: $BODY" $LINENO
fi

rm -f "$SIGNUP_RESP_FILE" "$SIGNUP_HDR_FILE"

# When
cv_step "When" "Perform repeated identify attempts with wrong PIN until throttling activates" $LINENO

IDENTIFY_WRONG_PIN="0000"
IDENTIFY_PAYLOAD=$(jq -n --arg name "$RIDER_NAME" --arg pin "$IDENTIFY_WRONG_PIN" '{name: $name, pin: $pin}')

# First wrong-PIN identify attempt
FIRST_RESP_FILE="$(mktemp)"
FIRST_HDR_FILE="$(mktemp)"

REQUEST_HEADERS=$(printf 'Content-Type: application/json')
REQUEST_BODY="$IDENTIFY_PAYLOAD"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

FIRST_STATUS=$(curl -sS -D "$FIRST_HDR_FILE" -o "$FIRST_RESP_FILE" -w "%{http_code}" \
  -X POST "$API_BASE/api/users/identify" \
  -H "Content-Type: application/json" \
  -d "$IDENTIFY_PAYLOAD")

echo "RESPONSE_HEADERS:" && cat "$FIRST_HDR_FILE"
FIRST_BODY_CONTENT="$(cat "$FIRST_RESP_FILE")"
echo "RESPONSE_BODY: $FIRST_BODY_CONTENT"

cv_http "POST" "/api/users/identify" "$FIRST_STATUS"

if [ "$FIRST_STATUS" != "401" ]; then
  BODY="$FIRST_BODY_CONTENT"
  cv_fail "Expected first wrong-PIN identify to return 401, got $FIRST_STATUS. Body: $BODY" $LINENO
fi
rm -f "$FIRST_RESP_FILE" "$FIRST_HDR_FILE"

# Wait for the 1-second throttle window from attempt #1 to expire before attempt #2.
# The app sets DelayUntilUtc = now+1s after the first wrong-PIN; if we don't wait,
# attempt #2 arrives during that window and returns 429 instead of 401.
sleep 2

# Second wrong-PIN identify attempt
SECOND_RESP_FILE="$(mktemp)"
SECOND_HDR_FILE="$(mktemp)"

REQUEST_HEADERS=$(printf 'Content-Type: application/json')
REQUEST_BODY="$IDENTIFY_PAYLOAD"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

SECOND_STATUS=$(curl -sS -D "$SECOND_HDR_FILE" -o "$SECOND_RESP_FILE" -w "%{http_code}" \
  -X POST "$API_BASE/api/users/identify" \
  -H "Content-Type: application/json" \
  -d "$IDENTIFY_PAYLOAD")

echo "RESPONSE_HEADERS:" && cat "$SECOND_HDR_FILE"
SECOND_BODY_CONTENT="$(cat "$SECOND_RESP_FILE")"
echo "RESPONSE_BODY: $SECOND_BODY_CONTENT"

cv_http "POST" "/api/users/identify" "$SECOND_STATUS"

if [ "$SECOND_STATUS" != "401" ]; then
  BODY="$SECOND_BODY_CONTENT"
  cv_fail "Expected second wrong-PIN identify to return 401, got $SECOND_STATUS. Body: $BODY" $LINENO
fi
rm -f "$SECOND_RESP_FILE" "$SECOND_HDR_FILE"

# Subsequent attempts until 429 throttling
THROTTLED_STATUS=""
THROTTLED_BODY=""
THROTTLED_RETRY_AFTER=""

for ATTEMPT in 3 4 5 6 7 8 9 10; do
  RESP_FILE="$(mktemp)"
  HDR_FILE="$(mktemp)"

  REQUEST_HEADERS=$(printf 'Content-Type: application/json')
  REQUEST_BODY="$IDENTIFY_PAYLOAD"
  echo "REQUEST_HEADERS: $REQUEST_HEADERS"
  echo "REQUEST_BODY: $REQUEST_BODY"

  STATUS=$(curl -sS -D "$HDR_FILE" -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$API_BASE/api/users/identify" \
    -H "Content-Type: application/json" \
    -d "$IDENTIFY_PAYLOAD")

  echo "RESPONSE_HEADERS:" && cat "$HDR_FILE"
  BODY_CONTENT="$(cat "$RESP_FILE")"
  echo "RESPONSE_BODY: $BODY_CONTENT"

  # Capture Retry-After, if present
  RETRY_AFTER_HEADER=$(grep -i '^Retry-After:' "$HDR_FILE" | awk '{print $2}' | tr -d '\r')

  cv_http "POST" "/api/users/identify" "$STATUS"

  if [ "$STATUS" = "429" ]; then
    THROTTLED_STATUS="$STATUS"
    THROTTLED_BODY="$BODY_CONTENT"
    THROTTLED_RETRY_AFTER="$RETRY_AFTER_HEADER"
    rm -f "$RESP_FILE" "$HDR_FILE"
    break
  fi

  rm -f "$RESP_FILE" "$HDR_FILE"
done

if [ "$THROTTLED_STATUS" != "429" ]; then
  cv_fail "Identify with repeated wrong PIN attempts never returned 429 within 10 attempts" $LINENO
fi

# Then
cv_step "Then" "Assert throttling response shape, Retry-After header, and delay bounds" $LINENO

if [ -z "$THROTTLED_BODY" ]; then
  cv_fail "Throttled identify response body was empty" $LINENO
fi

THROTTLE_CODE=$(echo "$THROTTLED_BODY" | jq -r '.code // empty')
THROTTLE_MESSAGE=$(echo "$THROTTLED_BODY" | jq -r '.message // empty')
THROTTLE_RETRY_JSON=$(echo "$THROTTLED_BODY" | jq -r '.retryAfterSeconds // empty')

if [ "$THROTTLE_CODE" != "throttled" ]; then
  cv_fail "Expected ThrottleResponse.code to be 'throttled', got '$THROTTLE_CODE'. Body: $THROTTLED_BODY" $LINENO
fi

if [ -z "$THROTTLE_MESSAGE" ]; then
  cv_fail "Expected ThrottleResponse.message to be non-empty. Body: $THROTTLED_BODY" $LINENO
fi

if [ -z "$THROTTLE_RETRY_JSON" ]; then
  cv_fail "Expected ThrottleResponse.retryAfterSeconds to be present. Body: $THROTTLED_BODY" $LINENO
fi

if ! echo "$THROTTLE_RETRY_JSON" | grep -Eq '^[0-9]+$'; then
  cv_fail "Expected retryAfterSeconds to be an integer, got '$THROTTLE_RETRY_JSON'. Body: $THROTTLED_BODY" $LINENO
fi

if [ "$THROTTLE_RETRY_JSON" -lt 1 ]; then
  cv_fail "Expected retryAfterSeconds >= 1, got '$THROTTLE_RETRY_JSON'. Body: $THROTTLED_BODY" $LINENO
fi

if [ "$THROTTLE_RETRY_JSON" -gt 30 ]; then
  cv_fail "Expected retryAfterSeconds <= 30, got '$THROTTLE_RETRY_JSON'. Body: $THROTTLED_BODY" $LINENO
fi

if [ -z "$THROTTLED_RETRY_AFTER" ]; then
  cv_fail "Expected Retry-After header to be present on 429 response" $LINENO
fi

if ! echo "$THROTTLED_RETRY_AFTER" | grep -Eq '^[0-9]+$'; then
  cv_fail "Expected Retry-After header to be an integer, got '$THROTTLED_RETRY_AFTER'" $LINENO
fi

if [ "$THROTTLED_RETRY_AFTER" -ne "$THROTTLE_RETRY_JSON" ]; then
  cv_fail "Retry-After header '$THROTTLED_RETRY_AFTER' does not match body.retryAfterSeconds '$THROTTLE_RETRY_JSON'" $LINENO
fi

# Teardown
cv_step "Cleanup" "No explicit teardown; rider and throttle state remain in local SQLite DB" $LINENO
# SQLite DB is container-local and ephemeral for this test run; no DELETE endpoint is required here.

echo "CODEVALID_TEST_ASSERTION_OK:login_progressive_delay_on_repeated_failures"
