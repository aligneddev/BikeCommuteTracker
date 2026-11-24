#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Scenario: Rider logs in with correct name and PIN -> session (user ID + display name)
# is started and the rider can reach the signed-in home (miles shell) data.
BASE_URL="${BASE_URL:-http://app:6713}"
CASE_ID="api_94694006_1"
SUFFIX="$(date +%s%N)"
RIDER_NAME="LoginRider${SUFFIX}"
RIDER_PIN="4826"

# Given
cv_step Given "register a rider with a unique name and valid PIN" $LINENO
cv_prereq "POST /api/users/signup" $LINENO
SIGNUP_BODY="$(jq -nc --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP_BODY"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
SIGNUP_USER_ID="$(jq -r '.userId // empty' <<<"$CV_HTTP_BODY")"
SIGNUP_USER_NAME="$(jq -r '.userName // empty' <<<"$CV_HTTP_BODY")"
if ! [[ "$SIGNUP_USER_ID" =~ ^[0-9]+$ ]]; then
  cv_fail "expected numeric userId from signup got $SIGNUP_USER_ID" $LINENO
fi
[ -n "$SIGNUP_USER_NAME" ] || cv_fail "expected userName from signup got empty" $LINENO

# When
cv_step When "log in with the rider's name and correct PIN" $LINENO
LOGIN_BODY="$(jq -nc --arg name "$RIDER_NAME" --arg pin "$RIDER_PIN" '{name: $name, pin: $pin}')"
cv_http POST /api/users/identify "$LOGIN_BODY"
LOGIN_STATUS="$CV_HTTP_STATUS"
LOGIN_RESPONSE="$CV_HTTP_BODY"

# Then
cv_step Then "login succeeds with user ID and display name, and the session reaches the signed-in home data" $LINENO
[ "$LOGIN_STATUS" = "200" ] || cv_fail "expected 200 from login got $LOGIN_STATUS: $LOGIN_RESPONSE" $LINENO
LOGIN_USER_ID="$(jq -r '.userId // empty' <<<"$LOGIN_RESPONSE")"
LOGIN_USER_NAME="$(jq -r '.userName // empty' <<<"$LOGIN_RESPONSE")"
LOGIN_AUTHORIZED="$(jq -r '.authorized' <<<"$LOGIN_RESPONSE")"
[ "$LOGIN_USER_ID" = "$SIGNUP_USER_ID" ] || cv_fail "expected login userId $SIGNUP_USER_ID got '$LOGIN_USER_ID'" $LINENO
[ "$LOGIN_USER_NAME" = "$RIDER_NAME" ] || cv_fail "expected login display name '$RIDER_NAME' got '$LOGIN_USER_NAME'" $LINENO
[ "$LOGIN_AUTHORIZED" = "true" ] || cv_fail "expected authorized=true got '$LOGIN_AUTHORIZED'" $LINENO
if jq -e 'has("pin") or has("pinHash") or has("pinSalt")' <<<"$LOGIN_RESPONSE" >/dev/null; then
  cv_fail "expected no credential data in login response got $LOGIN_RESPONSE" $LINENO
fi

# Session identity (user ID from login) opens the protected signed-in home data.
cv_http GET /api/dashboard -H "X-User-Id: ${LOGIN_USER_ID}"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 from protected /api/dashboard with logged-in session got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO
jq -e 'type == "object"' <<<"$CV_HTTP_BODY" >/dev/null || cv_fail "expected JSON object from /api/dashboard got $CV_HTTP_BODY" $LINENO

# Cleanup
cv_step Cleanup "no delete-user endpoint exists; rider has a unique name in the ephemeral SQLite DB" $LINENO
echo "rider ${RIDER_NAME} (id ${LOGIN_USER_ID}) left in ephemeral DB"

echo "CODEVALID_TEST_ASSERTION_OK:api_94694006_1"
