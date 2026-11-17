#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
CASE_ID="api_47116433_8"
STUB_DIR="${CODEVALID_ROOT:-.}/.codevalid/wiremock/mappings/cases/${CASE_ID}"
SUFFIX="$(date +%s%N)"
SHARED_KEY="cv-api47116433-8-shared-eia-key"
STUB_PRICE="4.7118"

wiremock_admin_import_mappings() {
  local dir="$1" f
  for f in "$dir"/*.json; do
    [ -e "$f" ] || { echo "no mappings in $dir" >&2; return 1; }
    command curl -sS -f -o /dev/null -X POST "$WIREMOCK_ADMIN_URL/__admin/mappings" \
      -H 'Content-Type: application/json' --data-binary @"$f" \
      || { echo "wiremock import failed: $f" >&2; return 1; }
  done
}

signup_and_identify() { # name pin -> sets RID
  cv_http POST /api/users/signup "$(jq -nc --arg n "$1" --arg p "$2" '{name:$n,pin:$p}')" 201
  RID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')
  [ -n "$RID" ] || cv_fail "expected userId from signup got: $CV_HTTP_BODY" $LINENO
  cv_http POST /api/users/identify "$(jq -nc --arg n "$1" --arg p "$2" '{name:$n,pin:$p}')" 200
}

# Unique past Monday so the shared weekly gas price cache has no entry for it.
N=$((10#${SUFFIX: -6}))
LOOKUP_DATE=$(date -u -d "1996-01-01 + $(( (N % 1200) * 7 )) days" +%Y-%m-%d)

# Given
cv_step Given "two riders sign up on the same machine; rider A saves a gas key, rider B saves none" $LINENO
cv_prereq "import EIA WireMock stub for ${CASE_ID}" $LINENO
wiremock_admin_import_mappings "$STUB_DIR" || cv_fail "expected WireMock stub import to succeed" $LINENO
signup_and_identify "cv-rider-a-${SUFFIX}" "1234"; RIDER_A="$RID"
signup_and_identify "cv-rider-b-${SUFFIX}" "5678"; RIDER_B="$RID"
cv_prereq "rider A saves the gas API key" $LINENO
cv_http PUT /api/users/me/settings "$(jq -nc --arg k "$SHARED_KEY" '{eiaGasApiKey:$k}')" 200 -H "X-User-Id: ${RIDER_A}"
cv_prereq "rider B saves settings without any API key (must not be blocked)" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":30}' 200 -H "X-User-Id: ${RIDER_B}"
cv_http GET /api/users/me/settings "" 200 -H "X-User-Id: ${RIDER_B}"
[ -z "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.eiaGasApiKey // empty')" ] || cv_fail "expected rider B to have no gas key got: $CV_HTTP_BODY" $LINENO

# When
cv_step When "rider B looks up gas price without a key, enters the same key under their account, then looks up again" $LINENO
cv_http GET "/api/rides/gas-price?date=${LOOKUP_DATE}&grade=Regular" "" -H "X-User-Id: ${RIDER_B}"
B_BEFORE_STATUS="$CV_HTTP_STATUS"; B_BEFORE="$CV_HTTP_BODY"
cv_http PUT /api/users/me/settings "$(jq -nc --arg k "$SHARED_KEY" '{eiaGasApiKey:$k}')" -H "X-User-Id: ${RIDER_B}"
B_SAVE_STATUS="$CV_HTTP_STATUS"
cv_http GET "/api/rides/gas-price?date=${LOOKUP_DATE}&grade=Regular" "" -H "X-User-Id: ${RIDER_B}"
B_AFTER_STATUS="$CV_HTTP_STATUS"; B_AFTER="$CV_HTTP_BODY"

# Then
cv_step Then "rider B's lookup was disabled before and works after entering their own key; rider A's key untouched" $LINENO
[ "$B_BEFORE_STATUS" = "200" ] || cv_fail "expected 200 from rider B keyless lookup got $B_BEFORE_STATUS" $LINENO
[ "$(printf '%s' "$B_BEFORE" | jq -r '.isAvailable')" = "false" ] || cv_fail "expected rider B keyless lookup isAvailable=false (disabled) got: $B_BEFORE" $LINENO
[ "$(printf '%s' "$B_BEFORE" | jq -r '.pricePerGallon')" = "null" ] || cv_fail "expected rider B keyless lookup pricePerGallon=null got: $B_BEFORE" $LINENO
[ "$B_SAVE_STATUS" = "200" ] || cv_fail "expected rider B save of own key to return 200 got $B_SAVE_STATUS" $LINENO
[ "$B_AFTER_STATUS" = "200" ] || cv_fail "expected 200 from rider B keyed lookup got $B_AFTER_STATUS" $LINENO
[ "$(printf '%s' "$B_AFTER" | jq -r '.isAvailable')" = "true" ] || cv_fail "expected rider B lookup isAvailable=true after entering key got: $B_AFTER" $LINENO
jq -en --argjson a "$(printf '%s' "$B_AFTER" | jq '.pricePerGallon')" --argjson e "$STUB_PRICE" '$a == $e' >/dev/null \
  || cv_fail "expected rider B pricePerGallon=${STUB_PRICE} got: $B_AFTER" $LINENO
cv_http GET /api/users/me/settings "" 200 -H "X-User-Id: ${RIDER_B}"
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.eiaGasApiKey // empty')" = "$SHARED_KEY" ] || cv_fail "expected rider B's saved key to be ${SHARED_KEY} got: $CV_HTTP_BODY" $LINENO
cv_http GET /api/users/me/settings "" 200 -H "X-User-Id: ${RIDER_A}"
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.eiaGasApiKey // empty')" = "$SHARED_KEY" ] || cv_fail "expected rider A's key to remain ${SHARED_KEY} got: $CV_HTTP_BODY" $LINENO

# Cleanup
cv_step Cleanup "clear both riders' saved API keys" $LINENO
cv_http PUT /api/users/me/settings '{"eiaGasApiKey":null}' -H "X-User-Id: ${RIDER_A}" || true
cv_http PUT /api/users/me/settings '{"eiaGasApiKey":null,"averageCarMpg":null}' -H "X-User-Id: ${RIDER_B}" || true

echo "CODEVALID_TEST_ASSERTION_OK:api_47116433_8"
