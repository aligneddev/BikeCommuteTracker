#!/usr/bin/env bash
set -euo pipefail

# Setup
source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh
cv_prereq "BikeTracking.Api app container is healthy on http://app:6713" $LINENO

API_BASE_URL="http://app:${PORT:-6713}"

# Compact Case mappings table
# case_id                                   | method(s) & path(s)
# ----------------------------------------- | -----------------------------------------------
# login_api_keys_not_exposed_on_failed_auth | POST /api/users/signup
#                                           | PUT  /api/users/me/settings
#                                           | POST /api/users/identify
#                                           | GET  /api/users/me/settings

# Case: login_api_keys_not_exposed_on_failed_auth

### Mocks
# No external HTTP vendors are called during /api/users/signup, /api/users/identify,
# or /api/users/me/settings flows. No WireMock stubs are required.
cv_step "Given" "No vendor mocks needed for identify/signup/settings flows" $LINENO

### Preconditions
cv_step "Given" "Create a rider with API keys stored in per-user settings" $LINENO

# 1) Signup a new rider to obtain a userId.
SIGNUP_NAME="ApiKeyOwner"
SIGNUP_PIN="1234"

SIGNUP_BODY=$(jq -n \
  --arg name "$SIGNUP_NAME" \
  --arg pin "$SIGNUP_PIN" \
  '{name: $name, pin: $pin}')

SIGNUP_BODY_FILE=$(mktemp)
SIGNUP_HDRS_FILE=$(mktemp)

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$SIGNUP_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

SIGNUP_STATUS=$(curl -sS -D "$SIGNUP_HDRS_FILE" -o "$SIGNUP_BODY_FILE" -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" \
  -d "$SIGNUP_BODY" \
  "${API_BASE_URL}/api/users/signup")

echo "RESPONSE_HEADERS:"
cat "$SIGNUP_HDRS_FILE"
echo "RESPONSE_BODY:"
cat "$SIGNUP_BODY_FILE"

cv_http "POST" "/api/users/signup" "$SIGNUP_STATUS"

SIGNUP_BODY_JSON=$(cat "$SIGNUP_BODY_FILE")

if [ "$SIGNUP_STATUS" != "201" ]; then
  cv_fail "Expected 201 from /api/users/signup, got ${SIGNUP_STATUS}" $LINENO
fi

USER_ID=$(echo "$SIGNUP_BODY_JSON" | jq -r '.userId // empty')
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  cv_fail "SignupSuccessResponse did not contain a userId" $LINENO
fi

# 2) Persist per-user API keys in settings for this rider using authenticated settings PUT.
SETTINGS_BODY=$(jq -n \
  --arg weather "test-weather-key" \
  --arg eia "test-eia-key" \
  '{
     averageCarMpg: 30.5,
     yearlyGoalMiles: 1500,
     oilChangePrice: 80,
     mileageRateCents: 60,
     locationLabel: "KeyOwnerHome",
     latitude: 40.0,
     longitude: -70.0,
     weatherApiKey: $weather,
     eiaGasApiKey: $eia
   }')

SETTINGS_BODY_FILE=$(mktemp)
SETTINGS_HDRS_FILE=$(mktemp)

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${USER_ID}"
REQUEST_BODY="$SETTINGS_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

SETTINGS_STATUS=$(curl -sS -D "$SETTINGS_HDRS_FILE" -o "$SETTINGS_BODY_FILE" -w '%{http_code}' -X PUT \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${USER_ID}" \
  -d "$SETTINGS_BODY" \
  "${API_BASE_URL}/api/users/me/settings")

echo "RESPONSE_HEADERS:"
cat "$SETTINGS_HDRS_FILE"
echo "RESPONSE_BODY:"
cat "$SETTINGS_BODY_FILE"

cv_http "PUT" "/api/users/me/settings" "$SETTINGS_STATUS"

SETTINGS_BODY_JSON=$(cat "$SETTINGS_BODY_FILE")

if [ "$SETTINGS_STATUS" != "200" ]; then
  cv_fail "Expected 200 from PUT /api/users/me/settings, got ${SETTINGS_STATUS}" $LINENO
fi

# Ensure the persisted settings include the API keys so the later unauthorized GET
# would leak them if auth/session isolation were broken.
PERSISTED_WEATHER_KEY=$(echo "$SETTINGS_BODY_JSON" | jq -r '.settings.weatherApiKey // empty')
PERSISTED_EIA_KEY=$(echo "$SETTINGS_BODY_JSON" | jq -r '.settings.eiaGasApiKey // empty')

if [ "$PERSISTED_WEATHER_KEY" != "test-weather-key" ]; then
  cv_fail "Expected weatherApiKey 'test-weather-key' in settings response, got '${PERSISTED_WEATHER_KEY}'" $LINENO
fi

if [ "$PERSISTED_EIA_KEY" != "test-eia-key" ]; then
  cv_fail "Expected eiaGasApiKey 'test-eia-key' in settings response, got '${PERSISTED_EIA_KEY}'" $LINENO
fi

### When
cv_step "When" "Attempt to identify with wrong PIN and then read settings without auth" $LINENO

# 3) Perform a failed identify attempt using wrong PIN for the existing rider.
IDENTIFY_WRONG_PIN="9999"

IDENTIFY_BODY=$(jq -n \
  --arg name "$SIGNUP_NAME" \
  --arg pin "$IDENTIFY_WRONG_PIN" \
  '{name: $name, pin: $pin}')

IDENTIFY_BODY_FILE=$(mktemp)
IDENTIFY_HDRS_FILE=$(mktemp)

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$IDENTIFY_BODY"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

IDENTIFY_STATUS=$(curl -sS -D "$IDENTIFY_HDRS_FILE" -o "$IDENTIFY_BODY_FILE" -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" \
  -d "$IDENTIFY_BODY" \
  "${API_BASE_URL}/api/users/identify")

echo "RESPONSE_HEADERS:"
cat "$IDENTIFY_HDRS_FILE"
echo "RESPONSE_BODY:"
cat "$IDENTIFY_BODY_FILE"

cv_http "POST" "/api/users/identify" "$IDENTIFY_STATUS"

IDENTIFY_BODY_JSON=$(cat "$IDENTIFY_BODY_FILE")

# 4) Attempt to read user settings without any authentication headers.
UNAUTH_SETTINGS_BODY_FILE=$(mktemp)
UNAUTH_SETTINGS_HDRS_FILE=$(mktemp)

REQUEST_HEADERS="<none>"
REQUEST_BODY="<none>"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

UNAUTH_SETTINGS_STATUS=$(curl -sS -D "$UNAUTH_SETTINGS_HDRS_FILE" -o "$UNAUTH_SETTINGS_BODY_FILE" -w '%{http_code}' \
  "${API_BASE_URL}/api/users/me/settings")

echo "RESPONSE_HEADERS:"
cat "$UNAUTH_SETTINGS_HDRS_FILE"
echo "RESPONSE_BODY:"
cat "$UNAUTH_SETTINGS_BODY_FILE"

cv_http "GET" "/api/users/me/settings" "$UNAUTH_SETTINGS_STATUS"

UNAUTH_SETTINGS_BODY_JSON=$(cat "$UNAUTH_SETTINGS_BODY_FILE")

### Then
cv_step "Then" "Assert failed identify does not expose API keys and does not authenticate" $LINENO

# A failed identify MUST NOT return 200; it should be 401 Unauthorized for invalid
# credentials, or 400/429 for validation/throttle. Any 2xx here would indicate
# unintended authorization despite wrong credentials.
case "$IDENTIFY_STATUS" in
  400|401|429)
    # Acceptable failure status codes.
    ;;
  *)
    cv_fail "Expected 400, 401, or 429 from /api/users/identify with wrong PIN, got ${IDENTIFY_STATUS}" $LINENO
    ;;
esac

# When the body is JSON (400 or 429), it should match ErrorResponse or ThrottleResponse
# shapes and MUST NOT contain per-rider settings fields like weatherApiKey/eiaGasApiKey.
if [ -n "$IDENTIFY_BODY_JSON" ]; then
  # Ensure response parses as JSON, but ignore parse failures for 401 with empty body.
  if echo "$IDENTIFY_BODY_JSON" | jq . >/dev/null 2>&1; then
    ID_CODE=$(echo "$IDENTIFY_BODY_JSON" | jq -r '.code // empty')
    ID_MSG=$(echo "$IDENTIFY_BODY_JSON" | jq -r '.message // empty')

    if [ -z "$ID_CODE" ] || [ -z "$ID_MSG" ]; then
      cv_fail "Identify error JSON did not expose expected ErrorResponse/ThrottleResponse fields 'code' and 'message'" $LINENO
    fi

    ID_HAS_WEATHER_KEY=$(echo "$IDENTIFY_BODY_JSON" | jq 'has("weatherApiKey") or (.settings? // {} | has("weatherApiKey"))')
    ID_HAS_EIA_KEY=$(echo "$IDENTIFY_BODY_JSON" | jq 'has("eiaGasApiKey") or (.settings? // {} | has("eiaGasApiKey"))')

    if [ "$ID_HAS_WEATHER_KEY" = "true" ] || [ "$ID_HAS_EIA_KEY" = "true" ]; then
      cv_fail "Identify failure response unexpectedly exposed per-rider API key fields" $LINENO
    fi
  fi
fi

# The unauthenticated GET /api/users/me/settings MUST be rejected with 401, and the
# body MUST NOT contain user settings or API key data — this proves that the failed
# identify attempt did not establish an authenticated session usable to read keys.
if [ "$UNAUTH_SETTINGS_STATUS" != "401" ]; then
  cv_fail "Expected 401 from unauthenticated GET /api/users/me/settings, got ${UNAUTH_SETTINGS_STATUS}" $LINENO
fi

if [ -n "$UNAUTH_SETTINGS_BODY_JSON" ]; then
  # If there is a body, it should not contain settings or API keys.
  if echo "$UNAUTH_SETTINGS_BODY_JSON" | jq . >/dev/null 2>&1; then
    HAS_SETTINGS_FIELD=$(echo "$UNAUTH_SETTINGS_BODY_JSON" | jq 'has("settings")')
    HAS_WEATHER_KEY_FIELD=$(echo "$UNAUTH_SETTINGS_BODY_JSON" | jq 'has("weatherApiKey") or (.settings? // {} | has("weatherApiKey"))')
    HAS_EIA_KEY_FIELD=$(echo "$UNAUTH_SETTINGS_BODY_JSON" | jq 'has("eiaGasApiKey") or (.settings? // {} | has("eiaGasApiKey"))')

    if [ "$HAS_SETTINGS_FIELD" = "true" ] || [ "$HAS_WEATHER_KEY_FIELD" = "true" ] || [ "$HAS_EIA_KEY_FIELD" = "true" ]; then
      cv_fail "Unauthenticated GET /api/users/me/settings exposed user settings or API key fields" $LINENO
    fi
  fi
fi

### Teardown
cv_step "Cleanup" "No explicit teardown; user data remains in ephemeral SQLite file" $LINENO
# Database is bound to the app container's lifecycle; no per-test cleanup needed.

echo "CODEVALID_TEST_ASSERTION_OK:login_api_keys_not_exposed_on_failed_auth"
exit 0
