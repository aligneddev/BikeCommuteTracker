#!/usr/bin/env bash
set -euo pipefail

# Setup
source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh
cv_prereq "BikeTracking API container is healthy on http://app:${PORT}" $LINENO
API_BASE="http://app:${PORT}"
CASE_ID="login_input_validation_empty_fields"

# Case: login_input_validation_empty_fields

## Mocks
# No external vendors are called by POST /api/users/identify; no per-case WireMock stubs needed.
cv_step Given "No vendor mocks required for identify input validation" $LINENO

## Preconditions
cv_prereq "API is running; no prior authentication or user data required" $LINENO

## When
cv_step When "Send identify requests with empty or whitespace-only name and/or PIN" $LINENO

# 1) Both name and pin empty strings
REQ1='{"name": "", "pin": ""}'
RESP1_STATUS_FILE="$(mktemp)"
RESP1_BODY_FILE="$(mktemp)"
RESP1_HDR_FILE="$(mktemp)"

REQUEST_HEADERS_1=$'Content-Type: application/json'
REQUEST_BODY_1="$REQ1"
echo "REQUEST_HEADERS (1):" >&2
echo "$REQUEST_HEADERS_1" >&2
echo "REQUEST_BODY (1):" >&2
echo "$REQUEST_BODY_1" >&2

RESP1_STATUS="$(curl -sS -o "$RESP1_BODY_FILE" -D "$RESP1_HDR_FILE" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  "${API_BASE}/api/users/identify" \
  -d "$REQ1")"

cv_http POST "/api/users/identify" "$RESP1_STATUS"
echo "RESPONSE_HEADERS (1):" >&2
cat "$RESP1_HDR_FILE" >&2
echo "RESPONSE_BODY (1):" >&2
cat "$RESP1_BODY_FILE" >&2

# 2) Name whitespace-only, pin non-empty
REQ2='{"name": "   ", "pin": "1234"}'
RESP2_STATUS_FILE="$(mktemp)"
RESP2_BODY_FILE="$(mktemp)"
RESP2_HDR_FILE="$(mktemp)"

REQUEST_HEADERS_2=$'Content-Type: application/json'
REQUEST_BODY_2="$REQ2"
echo "REQUEST_HEADERS (2):" >&2
echo "$REQUEST_HEADERS_2" >&2
echo "REQUEST_BODY (2):" >&2
echo "$REQUEST_BODY_2" >&2

RESP2_STATUS="$(curl -sS -o "$RESP2_BODY_FILE" -D "$RESP2_HDR_FILE" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  "${API_BASE}/api/users/identify" \
  -d "$REQ2")"

cv_http POST "/api/users/identify" "$RESP2_STATUS"
echo "RESPONSE_HEADERS (2):" >&2
cat "$RESP2_HDR_FILE" >&2
echo "RESPONSE_BODY (2):" >&2
cat "$RESP2_BODY_FILE" >&2

# 3) Name non-empty, pin empty
REQ3='{"name": "Alice", "pin": ""}'
RESP3_STATUS_FILE="$(mktemp)"
RESP3_BODY_FILE="$(mktemp)"
RESP3_HDR_FILE="$(mktemp)"

REQUEST_HEADERS_3=$'Content-Type: application/json'
REQUEST_BODY_3="$REQ3"
echo "REQUEST_HEADERS (3):" >&2
echo "$REQUEST_HEADERS_3" >&2
echo "REQUEST_BODY (3):" >&2
echo "$REQUEST_BODY_3" >&2

RESP3_STATUS="$(curl -sS -o "$RESP3_BODY_FILE" -D "$RESP3_HDR_FILE" -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  "${API_BASE}/api/users/identify" \
  -d "$REQ3")"

cv_http POST "/api/users/identify" "$RESP3_STATUS"
echo "RESPONSE_HEADERS (3):" >&2
cat "$RESP3_HDR_FILE" >&2
echo "RESPONSE_BODY (3):" >&2
cat "$RESP3_BODY_FILE" >&2

## Then
cv_step Then "All requests return 400 with validation_failed ErrorResponse and details" $LINENO

# Helper to assert a single response
assert_validation_failed() {
  local status="$1"
  local body_file="$2"
  local label="$3"

  if [[ "$status" != "400" ]]; then
    cv_fail "${label}: expected HTTP 400, got ${status}" $LINENO
  fi

  local code
  code="$(jq -r '.code // empty' "$body_file" 2>/dev/null || echo "")"
  if [[ "$code" != "validation_failed" ]]; then
    cv_fail "${label}: expected code \"validation_failed\", got \"${code}\"" $LINENO
  fi

  local details_len
  details_len="$(jq '(.details // []) | length' "$body_file" 2>/dev/null || echo "0")"
  if [[ "$details_len" -lt 1 ]]; then
    cv_fail "${label}: expected at least one validation error detail, got ${details_len}" $LINENO
  fi
}

assert_validation_failed "$RESP1_STATUS" "$RESP1_BODY_FILE" "empty_name_and_pin"
assert_validation_failed "$RESP2_STATUS" "$RESP2_BODY_FILE" "whitespace_name_nonempty_pin"
assert_validation_failed "$RESP3_STATUS" "$RESP3_BODY_FILE" "nonempty_name_empty_pin"

## Teardown
cv_step Cleanup "Remove temporary files created during the case" $LINENO
rm -f "$RESP1_STATUS_FILE" "$RESP1_BODY_FILE" "$RESP1_HDR_FILE" \
      "$RESP2_STATUS_FILE" "$RESP2_BODY_FILE" "$RESP2_HDR_FILE" \
      "$RESP3_STATUS_FILE" "$RESP3_BODY_FILE" "$RESP3_HDR_FILE"

echo "CODEVALID_TEST_ASSERTION_OK:login_input_validation_empty_fields"
