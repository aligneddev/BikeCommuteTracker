#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case mappings
# | Case ID                               | Method | Path                 |
# |--------------------------------------|--------|----------------------|
# | validation_failure_on_invalid_preset_payload | POST   | /api/rides/presets |

# Case: validation_failure_on_invalid_preset_payload

# Mocks
# No external vendor calls (EIA or Open-Meteo) are made by POST /api/rides/presets.
# WireMock shared boot mapping is already loaded; no case-specific stubs are required.

# Preconditions
cv_step Given "Signup rider and confirm no presets exist yet" $LINENO

API_BASE="http://app:${PORT}"

# 1) Signup a new rider to obtain a real userId for X-User-Id auth.
cv_prereq "Signup a unique rider via POST /api/users/signup" $LINENO
SIGNUP_BODY=$(cat <<'JSON'
{
  "name": "PresetValidationUser-"  
  ,"pin": "1234"
}
JSON
)

# Append a timestamp to name to avoid collisions
SIGNUP_BODY=$(printf '%s' "$SIGNUP_BODY" | sed "s/PresetValidationUser-/PresetValidationUser-$(date +%s)/")

SIGNUP_RESP_FILE=$(mktemp)
SIGNUP_HDR_FILE=$(mktemp)

echo "REQUEST_HEADERS: POST /api/users/signup"
echo "  Content-Type: application/json"
echo "REQUEST_BODY:"
printf '%s
' "$SIGNUP_BODY"

SIGNUP_STATUS=$(curl -sS -o "$SIGNUP_RESP_FILE" -D "$SIGNUP_HDR_FILE" -w '%{http_code}' \
  -X POST "$API_BASE/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary "$SIGNUP_BODY") || SIGNUP_STATUS="000"
cv_http POST "$API_BASE/api/users/signup" "$SIGNUP_STATUS"

echo "RESPONSE_HEADERS: POST /api/users/signup"
cat "$SIGNUP_HDR_FILE"
echo "RESPONSE_BODY: POST /api/users/signup"
cat "$SIGNUP_RESP_FILE"

echo "" >&2

if [ "$SIGNUP_STATUS" != "201" ]; then
  cv_fail "Expected 201 from signup, got $SIGNUP_STATUS" $LINENO
fi

RIDER_ID=$(jq -r '.userId // .id // empty' "$SIGNUP_RESP_FILE")
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "Signup response did not contain userId/id" $LINENO
fi

# 2) Confirm presets list is empty for this rider.
PRESETS_BEFORE_FILE=$(mktemp)
PRESETS_BEFORE_HDR_FILE=$(mktemp)

echo "REQUEST_HEADERS: GET /api/rides/presets (before)"
echo "  Content-Type: application/json"
echo "  X-User-Id: $RIDER_ID"
echo "REQUEST_BODY: (none)"

PRESETS_BEFORE_STATUS=$(curl -sS -o "$PRESETS_BEFORE_FILE" -D "$PRESETS_BEFORE_HDR_FILE" -w '%{http_code}' \
  -X GET "$API_BASE/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $RIDER_ID") || PRESETS_BEFORE_STATUS="000"
cv_http GET "$API_BASE/api/rides/presets" "$PRESETS_BEFORE_STATUS"

echo "RESPONSE_HEADERS: GET /api/rides/presets (before)"
cat "$PRESETS_BEFORE_HDR_FILE"
echo "RESPONSE_BODY: GET /api/rides/presets (before)"
cat "$PRESETS_BEFORE_FILE"

echo "" >&2

if [ "$PRESETS_BEFORE_STATUS" != "200" ]; then
  cv_fail "Expected 200 from initial GET /api/rides/presets, got $PRESETS_BEFORE_STATUS" $LINENO
fi

PRESET_COUNT_BEFORE=$(jq '.presets | length' "$PRESETS_BEFORE_FILE" 2>/dev/null || echo "parse_error")
if [ "$PRESET_COUNT_BEFORE" = "parse_error" ]; then
  cv_fail "Failed to parse presets response before invalid POST" $LINENO
fi

# When
cv_step When "Submit invalid ride preset payload with out-of-range miles" $LINENO

# Build request body: miles > 200 to violate Miles range (0.01–200), other fields valid.
INVALID_PRESET_BODY=$(cat <<'JSON'
{
  "name": "Too Long Ride",
  "primaryDirection": "SW",
  "periodTag": "morning",
  "exactStartTimeLocal": "07:45",
  "durationMinutes": 30,
  "miles": 250.0
}
JSON
)

INVALID_RESP_FILE=$(mktemp)
INVALID_HDR_FILE=$(mktemp)

echo "REQUEST_HEADERS: POST /api/rides/presets (invalid)"
echo "  Content-Type: application/json"
echo "  X-User-Id: $RIDER_ID"
echo "REQUEST_BODY:"
printf '%s
' "$INVALID_PRESET_BODY"

INVALID_STATUS=$(curl -sS -o "$INVALID_RESP_FILE" -D "$INVALID_HDR_FILE" -w '%{http_code}' \
  -X POST "$API_BASE/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $RIDER_ID" \
  --data-binary "$INVALID_PRESET_BODY") || INVALID_STATUS="000"
cv_http POST "$API_BASE/api/rides/presets" "$INVALID_STATUS"

echo "RESPONSE_HEADERS: POST /api/rides/presets (invalid)"
cat "$INVALID_HDR_FILE"
echo "RESPONSE_BODY: POST /api/rides/presets (invalid)"
cat "$INVALID_RESP_FILE"

echo "" >&2

# Then
cv_step Then "Assert 400 validation error and that no preset was created" $LINENO

if [ "$INVALID_STATUS" != "400" ]; then
  cv_fail "Expected 400 from POST /api/rides/presets with invalid miles, got $INVALID_STATUS" $LINENO
fi

# ErrorResponse: code should be VALIDATION_FAILED; message should mention miles range.
ERROR_CODE=$(jq -r '.code // empty' "$INVALID_RESP_FILE")
ERROR_MESSAGE=$(jq -r '.message // empty' "$INVALID_RESP_FILE")

if [ "$ERROR_CODE" != "VALIDATION_FAILED" ]; then
  cv_fail "Expected error.code VALIDATION_FAILED, got '$ERROR_CODE'" $LINENO
fi

if ! printf '%s' "$ERROR_MESSAGE" | grep -q "Miles must be greater than 0 and less than or equal to 200"; then
  cv_fail "Expected miles range validation message, got '$ERROR_MESSAGE'" $LINENO
fi

# Re-check presets list; it must still be empty (invalid payload not persisted).
PRESETS_AFTER_FILE=$(mktemp)
PRESETS_AFTER_HDR_FILE=$(mktemp)

echo "REQUEST_HEADERS: GET /api/rides/presets (after)"
echo "  Content-Type: application/json"
echo "  X-User-Id: $RIDER_ID"
echo "REQUEST_BODY: (none)"

PRESETS_AFTER_STATUS=$(curl -sS -o "$PRESETS_AFTER_FILE" -D "$PRESETS_AFTER_HDR_FILE" -w '%{http_code}' \
  -X GET "$API_BASE/api/rides/presets" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $RIDER_ID") || PRESETS_AFTER_STATUS="000"
cv_http GET "$API_BASE/api/rides/presets" "$PRESETS_AFTER_STATUS"

echo "RESPONSE_HEADERS: GET /api/rides/presets (after)"
cat "$PRESETS_AFTER_HDR_FILE"
echo "RESPONSE_BODY: GET /api/rides/presets (after)"
cat "$PRESETS_AFTER_FILE"

echo "" >&2

if [ "$PRESETS_AFTER_STATUS" != "200" ]; then
  cv_fail "Expected 200 from GET /api/rides/presets after invalid POST, got $PRESETS_AFTER_STATUS" $LINENO
fi

PRESET_COUNT_AFTER=$(jq '.presets | length' "$PRESETS_AFTER_FILE" 2>/dev/null || echo "parse_error")
if [ "$PRESET_COUNT_AFTER" = "parse_error" ]; then
  cv_fail "Failed to parse presets response after invalid POST" $LINENO
fi

if [ "$PRESET_COUNT_AFTER" -ne "$PRESET_COUNT_BEFORE" ]; then
  cv_fail "Preset count changed after invalid payload (before=$PRESET_COUNT_BEFORE, after=$PRESET_COUNT_AFTER)" $LINENO
fi

# Teardown
cv_step Cleanup "No explicit teardown required; invalid preset was not persisted" $LINENO

# Nothing to delete: test ensures the invalid preset request does not create any rows.

echo "CODEVALID_TEST_ASSERTION_OK:validation_failure_on_invalid_preset_payload"
