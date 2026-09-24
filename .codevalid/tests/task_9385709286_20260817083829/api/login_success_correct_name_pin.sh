#!/usr/bin/env bash
set -euo pipefail

# Load shared infra helpers (HTTP base URL, curl wrappers, WireMock helpers, etc.)
source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

CASE_ID="login_success_correct_name_pin"

# Derive base URL for the app from exported PORT
APP_BASE_URL="http://app:${PORT}"

# Use a unique rider name for this test run to avoid collisions across runs.
RIDER_NAME="LoginSuccessRider_${RANDOM}"
RIDER_PIN="1234"

cv_step Given "prepare WireMock mappings and create rider via signup" "$LINENO"

# Mocks: no per-case vendor mappings required; ensure case directory exists for consistency.
CASE_DIR=".codevalid/wiremock/mappings/cases/${CASE_ID}"
cv_prereq "ensure case WireMock directory exists" "$LINENO"
mkdir -p "$CASE_DIR"

# 1. Create a new rider via the public signup endpoint with a trimmed, non-empty name and valid PIN.
cv_prereq "create rider via /api/users/signup" "$LINENO"

SIGNUP_REQUEST_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
REQUEST_HEADERS=("Content-Type: application/json")
REQUEST_BODY="$SIGNUP_REQUEST_BODY"

echo "REQUEST_HEADERS: ${REQUEST_HEADERS[*]}"
echo "REQUEST_BODY: $REQUEST_BODY"

SIGNUP_HEADERS_FILE="/tmp/${CASE_ID}_signup_headers.txt"
SIGNUP_BODY_FILE="/tmp/${CASE_ID}_signup_body.json"

code=$(curl -sS -X POST "${APP_BASE_URL}/api/users/signup" \
  -H "${REQUEST_HEADERS[0]}" \
  -d "$REQUEST_BODY" \
  -D "$SIGNUP_HEADERS_FILE" \
  -o "$SIGNUP_BODY_FILE" \
  -w "%{http_code}")

cv_http POST "${APP_BASE_URL}/api/users/signup" "$code"

echo "RESPONSE_HEADERS:"
cat "$SIGNUP_HEADERS_FILE" || true

echo "RESPONSE_BODY:"
cat "$SIGNUP_BODY_FILE" || true

[ "$code" = "201" ] || cv_fail "expected HTTP 201 from /api/users/signup got $code" "$LINENO"

SIGNUP_RESPONSE="$(cat "$SIGNUP_BODY_FILE")"
SIGNUP_USER_ID="$(echo "$SIGNUP_RESPONSE" | jq -r '.userId')"
SIGNUP_USER_NAME="$(echo "$SIGNUP_RESPONSE" | jq -r '.userName')"

if [ -z "$SIGNUP_USER_ID" ] || [ "$SIGNUP_USER_ID" = "null" ] || [ "$SIGNUP_USER_ID" -le 0 ]; then
  cv_fail "signup did not return a valid positive userId: $SIGNUP_RESPONSE" "$LINENO"
fi

if [ -z "$SIGNUP_USER_NAME" ] || [ "$SIGNUP_USER_NAME" = "null" ]; then
  cv_fail "signup did not return a valid userName: $SIGNUP_RESPONSE" "$LINENO"
fi

cv_step When "identify rider with correct name and PIN" "$LINENO"

IDENTIFY_REQUEST_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
REQUEST_HEADERS=("Content-Type: application/json")
REQUEST_BODY="$IDENTIFY_REQUEST_BODY"

echo "REQUEST_HEADERS: ${REQUEST_HEADERS[*]}"
echo "REQUEST_BODY: $REQUEST_BODY"

IDENTIFY_HEADERS_FILE="/tmp/${CASE_ID}_identify_headers.txt"
IDENTIFY_BODY_FILE="/tmp/${CASE_ID}_identify_body.json"

code=$(curl -sS -X POST "${APP_BASE_URL}/api/users/identify" \
  -H "${REQUEST_HEADERS[0]}" \
  -d "$REQUEST_BODY" \
  -D "$IDENTIFY_HEADERS_FILE" \
  -o "$IDENTIFY_BODY_FILE" \
  -w "%{http_code}")

cv_http POST "${APP_BASE_URL}/api/users/identify" "$code"

echo "RESPONSE_HEADERS:"
cat "$IDENTIFY_HEADERS_FILE" || true

echo "RESPONSE_BODY:"
cat "$IDENTIFY_BODY_FILE" || true

cv_step Then "verify identify success response matches signup user and is authorized" "$LINENO"

[ "$code" = "200" ] || cv_fail "expected HTTP 200 from /api/users/identify got $code" "$LINENO"

IDENTIFY_RESPONSE="$(cat "$IDENTIFY_BODY_FILE")"
IDENTIFY_USER_ID="$(echo "$IDENTIFY_RESPONSE" | jq -r '.userId')"
IDENTIFY_USER_NAME="$(echo "$IDENTIFY_RESPONSE" | jq -r '.userName')"
IDENTIFY_AUTHORIZED="$(echo "$IDENTIFY_RESPONSE" | jq -r '.authorized')"

if [ -z "$IDENTIFY_USER_ID" ] || [ "$IDENTIFY_USER_ID" = "null" ] || [ "$IDENTIFY_USER_ID" -le 0 ]; then
  cv_fail "identify response did not contain a valid positive userId: $IDENTIFY_RESPONSE" "$LINENO"
fi

if [ "$IDENTIFY_USER_ID" -ne "$SIGNUP_USER_ID" ]; then
  cv_fail "identify userId ($IDENTIFY_USER_ID) does not match signup userId ($SIGNUP_USER_ID). Response: $IDENTIFY_RESPONSE" "$LINENO"
fi

if [ "$IDENTIFY_USER_NAME" != "$SIGNUP_USER_NAME" ]; then
  cv_fail "identify userName ($IDENTIFY_USER_NAME) does not match signup userName ($SIGNUP_USER_NAME). Response: $IDENTIFY_RESPONSE" "$LINENO"
fi

if [ "$IDENTIFY_AUTHORIZED" != "true" ]; then
  cv_fail "expected authorized=true in identify response, got authorized=$IDENTIFY_AUTHORIZED. Response: $IDENTIFY_RESPONSE" "$LINENO"
fi

echo "Identify success: rider ${IDENTIFY_USER_NAME} (ID ${IDENTIFY_USER_ID}) authenticated with correct PIN."

echo "CODEVALID_TEST_ASSERTION_OK:login_success_correct_name_pin"

cv_step Cleanup "no explicit teardown required; data isolated to ephemeral DB" "$LINENO"

exit 0
