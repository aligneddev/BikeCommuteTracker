#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="Rider Signup ${SUFFIX}"
RIDER_PIN="482913"   # 6-digit numeric PIN (policy: 4-8 digits)

# Given
cv_step Given "a unique rider name not yet registered and a valid 6-digit PIN" $LINENO
cv_prereq "API healthy" $LINENO
cv_http GET /health 200
cv_prereq "name is not registered yet (identify rejects it)" $LINENO
cv_http POST /api/users/identify "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
if [ "$CV_HTTP_STATUS" = "200" ]; then
  cv_fail "expected unique name to be unregistered before signup, identify returned 200: $CV_HTTP_BODY" $LINENO
fi

# When
cv_step When "POST /api/users/signup with the unique name and 6-digit PIN" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
SIGNUP_STATUS="$CV_HTTP_STATUS"
SIGNUP_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "success is confirmed with a new user ID and exactly one profile exists for the name" $LINENO
[ "$SIGNUP_STATUS" = "201" ] || cv_fail "expected 201 Created from signup, got $SIGNUP_STATUS: $SIGNUP_BODY" $LINENO
USER_ID="$(printf '%s' "$SIGNUP_BODY" | jq -r '.userId // empty')"
case "$USER_ID" in ''|*[!0-9]*) cv_fail "expected numeric userId in signup response, got '$USER_ID'" $LINENO ;; esac
[ "$USER_ID" -gt 0 ] || cv_fail "expected positive userId, got $USER_ID" $LINENO
USER_NAME="$(printf '%s' "$SIGNUP_BODY" | jq -r '.userName // empty')"
[ "$USER_NAME" = "$RIDER_NAME" ] || cv_fail "expected userName '$RIDER_NAME', got '$USER_NAME'" $LINENO
if printf '%s' "$SIGNUP_BODY" | grep -q "$RIDER_PIN"; then
  cv_fail "expected signup response not to contain the PIN, got $SIGNUP_BODY" $LINENO
fi

# The new profile can be found by name + PIN and carries the same user ID.
cv_http POST /api/users/identify "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected identify of new rider to return 200, got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
ID_USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ "$ID_USER_ID" = "$USER_ID" ] || cv_fail "expected identify userId $USER_ID, got '$ID_USER_ID'" $LINENO

# Exactly one profile exists for the name: a second signup with the same (case-varied) name is refused.
UPPER_NAME="$(printf '%s' "$RIDER_NAME" | tr '[:lower:]' '[:upper:]')"
cv_http POST /api/users/signup "$(jq -nc --arg n "  $UPPER_NAME  " --arg p "1234" '{name:$n,pin:$p}')"
[ "$CV_HTTP_STATUS" = "409" ] || cv_fail "expected 409 for second signup with same name (exactly one profile), got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
# Original profile still resolves to the same single user ID.
cv_http POST /api/users/identify "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')"
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')" = "$USER_ID" ] || cv_fail "expected name to still map to userId $USER_ID, got $CV_HTTP_BODY" $LINENO

# Cleanup
cv_step Cleanup "no user delete endpoint exists; the rider uses a unique suffixed name" $LINENO
echo "left user $USER_ID ($RIDER_NAME) in place; no DELETE route for users"

echo "CODEVALID_TEST_ASSERTION_OK:api_59612528_1"
