#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

# -------------------- Mocks --------------------
cv_step "Given" "No external HTTP vendors are called for signup or identify; no WireMock stubs needed" $LINENO
CASE_DIR=".codevalid/wiremock/mappings/cases/login_delay_resets_after_success"
mkdir -p "$CASE_DIR"

# -------------------- Preconditions --------------------
cv_step "Given" "Create a new rider via /api/users/signup to exercise login throttle state" $LINENO

API_BASE="http://app:${PORT}"
CASE_SUFFIX="$(date +%s%3N)"
RIDER_NAME="DelayResetUser_${CASE_SUFFIX}"
RIDER_PIN="1234"
WRONG_PIN="9999"

# Signup request payload
SIGNUP_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"

SIGNUP_BODY_FILE="/tmp/case_login_delay_signup_body.txt"
SIGNUP_HDR_FILE="/tmp/case_login_delay_signup_headers.txt"

REQUEST_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQUEST_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$SIGNUP_BODY"

SIGNUP_STATUS="$(curl -sS -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$SIGNUP_BODY" \
  "${API_BASE}/api/users/signup")" || cv_fail "Signup request failed" $LINENO
SIGNUP_JSON="$(cat "$SIGNUP_BODY_FILE")"

echo "RESPONSE_HEADERS:"; cat "$SIGNUP_HDR_FILE" || true
echo "RESPONSE_BODY:"; printf '%s\n' "$SIGNUP_JSON"
cv_http "POST" "/api/users/signup" "$SIGNUP_STATUS"

if [ "$SIGNUP_STATUS" -ne 201 ]; then
  cv_fail "Expected 201 from signup, got $SIGNUP_STATUS; body=$SIGNUP_JSON" $LINENO
fi

RIDER_USER_ID="$(printf '%s' "$SIGNUP_JSON" | jq -e '.userId' 2>/dev/null)" || cv_fail "Signup response missing userId" $LINENO
RIDER_USER_NAME="$(printf '%s' "$SIGNUP_JSON" | jq -e -r '.userName' 2>/dev/null)" || cv_fail "Signup response missing userName" $LINENO

if [ "$RIDER_USER_NAME" != "$RIDER_NAME" ]; then
  cv_fail "Expected userName '$RIDER_NAME' from signup, got '$RIDER_USER_NAME'" $LINENO
fi

# -------------------- When --------------------
cv_step "When" "Drive failed logins to build a higher BEFORE throttle delay, then login successfully to reset it, then build a smaller AFTER delay" $LINENO

IDENTIFY_WRONG_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$WRONG_PIN" '{name: $name, pin: $pin}')"
IDENTIFY_CORRECT_BODY="$(jq -n --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"

# ---- Build BEFORE throttle delay (larger window) ----

# 1st wrong attempt: should be 401 Unauthorized, initializes throttle state with step[0]=1s.
REQ1_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQ1_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$IDENTIFY_WRONG_BODY"

RESP1_BODY_FILE="/tmp/case_login_delay_identify_wrong1_body.txt"
RESP1_HDR_FILE="/tmp/case_login_delay_identify_wrong1_headers.txt"
RESP1_STATUS="$(curl -sS -D "$RESP1_HDR_FILE" -o "$RESP1_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$IDENTIFY_WRONG_BODY" \
  "${API_BASE}/api/users/identify")" || cv_fail "First wrong identify request failed" $LINENO
BODY1="$(cat "$RESP1_BODY_FILE")"
STATUS1="$RESP1_STATUS"

echo "RESPONSE_HEADERS:"; cat "$RESP1_HDR_FILE" || true
echo "RESPONSE_BODY:"; printf '%s\n' "$BODY1"
cv_http "POST" "/api/users/identify" "$STATUS1"

if [ "$STATUS1" -ne 401 ]; then
  cv_fail "Expected 401 from first wrong identify, got $STATUS1; body=$BODY1" $LINENO
fi

# Sleep long enough so the initial ~1s throttle window expires before the next attempt,
# per workspace test learning to avoid an early 429 here.
sleep 2

# 2nd wrong attempt: should again be 401, incrementing ConsecutiveWrongCount to 2
# and setting DelayUntilUtc with a larger delay (default steps[1]=2s).
REQ2_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQ2_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$IDENTIFY_WRONG_BODY"

RESP2_BODY_FILE="/tmp/case_login_delay_identify_wrong2_body.txt"
RESP2_HDR_FILE="/tmp/case_login_delay_identify_wrong2_headers.txt"
RESP2_STATUS="$(curl -sS -D "$RESP2_HDR_FILE" -o "$RESP2_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$IDENTIFY_WRONG_BODY" \
  "${API_BASE}/api/users/identify")" || cv_fail "Second wrong identify request failed" $LINENO
BODY2="$(cat "$RESP2_BODY_FILE")"
STATUS2="$RESP2_STATUS"

echo "RESPONSE_HEADERS:"; cat "$RESP2_HDR_FILE" || true
echo "RESPONSE_BODY:"; printf '%s\n' "$BODY2"
cv_http "POST" "/api/users/identify" "$STATUS2"

if [ "$STATUS2" -ne 401 ]; then
  cv_fail "Expected 401 from second wrong identify, got $STATUS2; body=$BODY2" $LINENO
fi

# 3rd immediate wrong attempt: should now hit the active DelayUntilUtc window and return 429.
REQ3_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQ3_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$IDENTIFY_WRONG_BODY"

RESP3_BODY_FILE="/tmp/case_login_delay_before_body.txt"
RESP3_HDR_FILE="/tmp/case_login_delay_before_headers.txt"
RESP3_STATUS="$(curl -sS -D "$RESP3_HDR_FILE" -o "$RESP3_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$IDENTIFY_WRONG_BODY" \
  "${API_BASE}/api/users/identify")" || cv_fail "Third wrong identify request (BEFORE throttle) failed" $LINENO
STATUS3="$RESP3_STATUS"
HEADERS3="$(cat "$RESP3_HDR_FILE")"
BODY3="$(cat "$RESP3_BODY_FILE")"

echo "RESPONSE_HEADERS:"; printf '%s\n' "$HEADERS3"
echo "RESPONSE_BODY:"; printf '%s\n' "$BODY3"
cv_http "POST" "/api/users/identify" "$STATUS3"

if [ "$STATUS3" -ne 429 ]; then
  cv_fail "Expected 429 from BEFORE-throttle identify, got $STATUS3; body=$BODY3" $LINENO
fi

BEFORE_RETRY_AFTER_HEADER="$(printf '%s\n' "$HEADERS3" | awk -F': ' '/^Retry-After:/ {print $2}' | tr -d '\r')"
if [ -z "$BEFORE_RETRY_AFTER_HEADER" ]; then
  cv_fail "Missing Retry-After header on BEFORE-throttle response" $LINENO
fi

BEFORE_JSON="$BODY3"
BEFORE_CODE="$(printf '%s' "$BEFORE_JSON" | jq -e -r '.code' 2>/dev/null || true)"
BEFORE_RETRY_AFTER_JSON="$(printf '%s' "$BEFORE_JSON" | jq -e '.retryAfterSeconds' 2>/dev/null || true)"

if [ "$BEFORE_CODE" != "throttled" ]; then
  cv_fail "Expected BEFORE throttle response code 'throttled', got '$BEFORE_CODE'" $LINENO
fi

if [ -z "$BEFORE_RETRY_AFTER_JSON" ] || [ "$BEFORE_RETRY_AFTER_JSON" = "null" ]; then
  cv_fail "BEFORE throttle JSON missing retryAfterSeconds" $LINENO
fi

BEFORE_RETRY_AFTER_SECONDS="$BEFORE_RETRY_AFTER_JSON"

# Sleep long enough so the active BEFORE throttle window (2s) expires before
# sending the correct login; otherwise the correct identify also returns 429.
sleep 3

# ---- Successful login to reset throttle state ----

IDENTIFY_OK_BODY_FILE="/tmp/case_login_delay_identify_ok_body.txt"
IDENTIFY_OK_HDR_FILE="/tmp/case_login_delay_identify_ok_headers.txt"

REQ_OK_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQ_OK_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$IDENTIFY_CORRECT_BODY"

STATUS_OK="$(curl -sS -D "$IDENTIFY_OK_HDR_FILE" -o "$IDENTIFY_OK_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$IDENTIFY_CORRECT_BODY" \
  "${API_BASE}/api/users/identify")" || cv_fail "Correct identify request failed" $LINENO
BODY_OK="$(cat "$IDENTIFY_OK_BODY_FILE")"

echo "RESPONSE_HEADERS:"; cat "$IDENTIFY_OK_HDR_FILE" || true
echo "RESPONSE_BODY:"; printf '%s\n' "$BODY_OK"
cv_http "POST" "/api/users/identify" "$STATUS_OK"

if [ "$STATUS_OK" -ne 200 ]; then
  cv_fail "Expected 200 from correct identify, got $STATUS_OK; body=$BODY_OK" $LINENO
fi

AUTHORIZED_FLAG="$(printf '%s' "$BODY_OK" | jq -e '.authorized' 2>/dev/null || true)"
LOGIN_USER_ID="$(printf '%s' "$BODY_OK" | jq -e '.userId' 2>/dev/null || true)"
LOGIN_USER_NAME="$(printf '%s' "$BODY_OK" | jq -e -r '.userName' 2>/dev/null || true)"

if [ "$AUTHORIZED_FLAG" != "true" ]; then
  cv_fail "Expected authorized=true in successful identify response, got '$AUTHORIZED_FLAG'" $LINENO
fi

if [ "$LOGIN_USER_ID" != "$RIDER_USER_ID" ]; then
  cv_fail "Successful identify returned userId=$LOGIN_USER_ID; expected $RIDER_USER_ID" $LINENO
fi

if [ "$LOGIN_USER_NAME" != "$RIDER_NAME" ]; then
  cv_fail "Successful identify returned userName='$LOGIN_USER_NAME'; expected '$RIDER_NAME'" $LINENO
fi

# ---- Build AFTER throttle delay (smaller window after reset) ----

# First wrong attempt after reset.
REQ4_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQ4_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$IDENTIFY_WRONG_BODY"

RESP4_BODY_FILE="/tmp/case_login_delay_identify_wrong4_body.txt"
RESP4_HDR_FILE="/tmp/case_login_delay_identify_wrong4_headers.txt"
RESP4_STATUS="$(curl -sS -D "$RESP4_HDR_FILE" -o "$RESP4_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$IDENTIFY_WRONG_BODY" \
  "${API_BASE}/api/users/identify")" || cv_fail "Fourth wrong identify request (after reset) failed" $LINENO
BODY4="$(cat "$RESP4_BODY_FILE")"
STATUS4="$RESP4_STATUS"

echo "RESPONSE_HEADERS:"; cat "$RESP4_HDR_FILE" || true
echo "RESPONSE_BODY:"; printf '%s\n' "$BODY4"
cv_http "POST" "/api/users/identify" "$STATUS4"

if [ "$STATUS4" -ne 401 ]; then
  cv_fail "Expected 401 from first wrong identify after reset, got $STATUS4; body=$BODY4" $LINENO
fi

# Second immediate wrong attempt (no sleep): should hit the newly active delay window
# (step[0]=1s) and return 429 with a smaller retryAfterSeconds than BEFORE.
REQ5_HEADERS=$'Content-Type: application/json'
echo "REQUEST_HEADERS:"; printf '%s\n' "$REQ5_HEADERS"
echo "REQUEST_BODY:"; printf '%s\n' "$IDENTIFY_WRONG_BODY"

RESP5_BODY_FILE="/tmp/case_login_delay_after_body.txt"
RESP5_HDR_FILE="/tmp/case_login_delay_after_headers.txt"
RESP5_STATUS="$(curl -sS -D "$RESP5_HDR_FILE" -o "$RESP5_BODY_FILE" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  -d "$IDENTIFY_WRONG_BODY" \
  "${API_BASE}/api/users/identify")" || cv_fail "Fifth wrong identify request (AFTER throttle) failed" $LINENO
STATUS5="$RESP5_STATUS"
HEADERS5="$(cat "$RESP5_HDR_FILE")"
BODY5="$(cat "$RESP5_BODY_FILE")"

AFTER_STATUS="$STATUS5"
AFTER_HEADERS="$HEADERS5"
AFTER_JSON="$BODY5"

echo "RESPONSE_HEADERS:"; printf '%s\n' "$AFTER_HEADERS"
echo "RESPONSE_BODY:"; printf '%s\n' "$AFTER_JSON"
cv_http "POST" "/api/users/identify" "$AFTER_STATUS"

# -------------------- Then --------------------
cv_step "Then" "Assert that throttle delay was higher before reset and smaller after successful login" $LINENO

if [ "$AFTER_STATUS" -ne 429 ]; then
  cv_fail "Expected 429 from AFTER-throttle identify, got $AFTER_STATUS; body=$AFTER_JSON" $LINENO
fi

AFTER_RETRY_AFTER_HEADER="$(printf '%s\n' "$AFTER_HEADERS" | awk -F': ' '/^Retry-After:/ {print $2}' | tr -d '\r')"
if [ -z "$AFTER_RETRY_AFTER_HEADER" ]; then
  cv_fail "Missing Retry-After header on AFTER-throttle response" $LINENO
fi

AFTER_CODE="$(printf '%s' "$AFTER_JSON" | jq -e -r '.code' 2>/dev/null || true)"
AFTER_RETRY_AFTER_JSON="$(printf '%s' "$AFTER_JSON" | jq -e '.retryAfterSeconds' 2>/dev/null || true)"

if [ "$AFTER_CODE" != "throttled" ]; then
  cv_fail "Expected AFTER throttle response code 'throttled', got '$AFTER_CODE'" $LINENO
fi

if [ -z "$AFTER_RETRY_AFTER_JSON" ] || [ "$AFTER_RETRY_AFTER_JSON" = "null" ]; then
  cv_fail "AFTER throttle JSON missing retryAfterSeconds" $LINENO
fi

AFTER_RETRY_AFTER_SECONDS="$AFTER_RETRY_AFTER_JSON"

# Compare BEFORE and AFTER retryAfterSeconds: AFTER must be strictly less than BEFORE
# to demonstrate that the retry delay progression was reset by the successful login.
if ! printf '%s\n%s\n' "$BEFORE_RETRY_AFTER_SECONDS" "$AFTER_RETRY_AFTER_SECONDS" | awk 'NR==1{before=$1} NR==2{after=$1} END{exit !(after < before)}'; then
  cv_fail "Expected AFTER retryAfterSeconds ($AFTER_RETRY_AFTER_SECONDS) to be less than BEFORE ($BEFORE_RETRY_AFTER_SECONDS)" $LINENO
fi

# -------------------- Teardown --------------------
cv_step "Cleanup" "No explicit teardown: rider and auth state live in ephemeral SQLite database for this test run" $LINENO
# The app container and its SQLite database are ephemeral per test run; no cleanup needed.

echo "CODEVALID_TEST_ASSERTION_OK:login_delay_resets_after_success"
