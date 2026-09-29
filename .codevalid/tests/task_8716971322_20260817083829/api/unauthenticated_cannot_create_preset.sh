#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case mappings

# | Case id                          | Method | Path                 | Auth header    |
# |----------------------------------|--------|----------------------|----------------|
# | unauthenticated_cannot_create_preset | POST   | /api/rides/presets   | X-User-Id (missing for unauthenticated request) |

# Case: unauthenticated_cannot_create_preset

# Mocks
# This case does not reach any external vendor (EIA or Open-Meteo) when creating a preset.
# No WireMock mappings are required.
cv_step "Given" "No vendor mocks needed; endpoint uses only local DB and auth" $LINENO

# Preconditions
cv_prereq "Signup a rider to obtain a valid userId for authenticated comparison" $LINENO
cv_prereq "Create rider via POST /api/users/signup" $LINENO

SIGNUP_BODY_FILE="$(mktemp)"
cat > "$SIGNUP_BODY_FILE" <<EOF
{
  "name": "PresetAuthCase-$(date +%s)",
  "pin": "1234"
}
EOF

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "$SIGNUP_BODY_FILE")"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"

curl -sS -X POST "http://app:${PORT}/api/users/signup" \
  -H "Content-Type: application/json" \
  --data-binary @"$SIGNUP_BODY_FILE" \
  -D "$SIGNUP_HDR_FILE" \
  -o "$SIGNUP_RESP_FILE" \
  -w '%{http_code}' >"$SIGNUP_STATUS_FILE"
SIGNUP_STATUS="$(cat "$SIGNUP_STATUS_FILE")"
cv_http "POST" "/api/users/signup" "$SIGNUP_STATUS"

RESPONSE_HEADERS="$(cat "$SIGNUP_HDR_FILE")"
RESPONSE_BODY="$(cat "$SIGNUP_RESP_FILE")"
echo "RESPONSE_HEADERS=$RESPONSE_HEADERS"
echo "RESPONSE_BODY=$RESPONSE_BODY"

if [ "$SIGNUP_STATUS" != "201" ]; then
  cv_fail "Expected 201 from signup, got $SIGNUP_STATUS" $LINENO
fi

RIDER_ID="$(jq -r '.userId // .id' < "$SIGNUP_RESP_FILE")"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "Failed to extract userId from signup response" $LINENO
fi

# Build a valid preset request body matching UpsertRidePresetRequest contract
PRESET_BODY_FILE="$(mktemp)"
cat > "$PRESET_BODY_FILE" <<EOF
{
  "name": "UnauthorizedPreset-$(date +%s)",
  "primaryDirection": "SW",
  "periodTag": "morning",
  "exactStartTimeLocal": "07:45",
  "durationMinutes": 30,
  "miles": 6.5
}
EOF

# When
cv_step "When" "Send unauthenticated POST /api/rides/presets without X-User-Id header" $LINENO

UNAUTH_RESP_FILE="$(mktemp)"
UNAUTH_STATUS_FILE="$(mktemp)"
UNAUTH_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "$PRESET_BODY_FILE")"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"

curl -sS -X POST "http://app:${PORT}/api/rides/presets" \
  -H "Content-Type: application/json" \
  --data-binary @"$PRESET_BODY_FILE" \
  -D "$UNAUTH_HDR_FILE" \
  -o "$UNAUTH_RESP_FILE" \
  -w '%{http_code}' >"$UNAUTH_STATUS_FILE"
UNAUTH_STATUS="$(cat "$UNAUTH_STATUS_FILE")"
cv_http "POST" "/api/rides/presets" "$UNAUTH_STATUS"

RESPONSE_HEADERS="$(cat "$UNAUTH_HDR_FILE")"
RESPONSE_BODY="$(cat "$UNAUTH_RESP_FILE")"
echo "RESPONSE_HEADERS=$RESPONSE_HEADERS"
echo "RESPONSE_BODY=$RESPONSE_BODY"

# Then
cv_step "Then" "Assert unauthenticated POST is rejected with 401 and no preset payload" $LINENO

if [ "$UNAUTH_STATUS" != "401" ]; then
  cv_fail "Expected 401 Unauthorized for unauthenticated preset create, got $UNAUTH_STATUS" $LINENO
fi

# Response body for 401 should be empty or at least not a successful RidePresetDto.
UNAUTH_BODY_RAW="$(cat "$UNAUTH_RESP_FILE")"
if [ -n "$UNAUTH_BODY_RAW" ] && [ "$UNAUTH_BODY_RAW" != "null" ]; then
  # If the framework emits a body, ensure it does not contain presetId or name fields that would indicate a created preset.
  HAS_PRESET_ID="$(echo "$UNAUTH_BODY_RAW" | jq 'has("presetId")' 2>/dev/null || echo "false")"
  if [ "$HAS_PRESET_ID" = "true" ]; then
    cv_fail "Unauthenticated response unexpectedly contains presetId field" $LINENO
  fi
fi

cv_prereq "Send authenticated POST /api/rides/presets to confirm handler works with auth" $LINENO

AUTH_RESP_FILE="$(mktemp)"
AUTH_STATUS_FILE="$(mktemp)"
AUTH_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: ${RIDER_ID}"
REQUEST_BODY="$(cat "$PRESET_BODY_FILE")"
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY"

curl -sS -X POST "http://app:${PORT}/api/rides/presets" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$PRESET_BODY_FILE" \
  -D "$AUTH_HDR_FILE" \
  -o "$AUTH_RESP_FILE" \
  -w '%{http_code}' >"$AUTH_STATUS_FILE"
AUTH_STATUS="$(cat "$AUTH_STATUS_FILE")"
cv_http "POST" "/api/rides/presets" "$AUTH_STATUS"

RESPONSE_HEADERS="$(cat "$AUTH_HDR_FILE")"
RESPONSE_BODY="$(cat "$AUTH_RESP_FILE")"
echo "RESPONSE_HEADERS=$RESPONSE_HEADERS"
echo "RESPONSE_BODY=$RESPONSE_BODY"

if [ "$AUTH_STATUS" != "201" ]; then
  cv_fail "Expected 201 Created for authenticated preset create, got $AUTH_STATUS" $LINENO
fi

AUTH_PRESET_ID="$(jq -r '.presetId' < "$AUTH_RESP_FILE" 2>/dev/null || echo "null")"
if [ -z "$AUTH_PRESET_ID" ] || [ "$AUTH_PRESET_ID" = "null" ]; then
  cv_fail "Authenticated preset create did not return presetId in response" $LINENO
fi

# Teardown
cv_step "Cleanup" "Remove temp files; preset cleanup via API is out of scope for this auth-focused case" $LINENO

rm -f "$SIGNUP_BODY_FILE" "$SIGNUP_RESP_FILE" "$SIGNUP_STATUS_FILE" "$SIGNUP_HDR_FILE"
rm -f "$PRESET_BODY_FILE" "$UNAUTH_RESP_FILE" "$UNAUTH_STATUS_FILE" "$UNAUTH_HDR_FILE"
rm -f "$AUTH_RESP_FILE" "$AUTH_STATUS_FILE" "$AUTH_HDR_FILE"

echo "CODEVALID_TEST_ASSERTION_OK:unauthenticated_cannot_create_preset"
