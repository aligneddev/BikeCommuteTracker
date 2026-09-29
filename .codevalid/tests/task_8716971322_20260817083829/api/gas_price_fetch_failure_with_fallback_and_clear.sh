#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case mappings
# id                                           | method | path
# gas_price_fetch_failure_with_fallback_and_clear | POST   | /api/rides

# Case: gas_price_fetch_failure_with_fallback_and_clear

# Mocks
# -----
CASE_DIR=.codevalid/wiremock/mappings/cases/gas_price_fetch_failure_with_fallback_and_clear
mkdir -p "$CASE_DIR"

cat > "$CASE_DIR/eia-gas-price-failure.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v2/petroleum/pri/gnd/data",
    "queryParameters": {
      "facets[duoarea][]": { "equalTo": "NUS" },
      "facets[product][]": { "equalTo": "EPMR" }
    }
  },
  "response": {
    "status": 500,
    "jsonBody": {
      "error": "simulated EIA outage",
      "case": "gas_price_fetch_failure_with_fallback_and_clear"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

# Preconditions
# -------------
cv_step Given "signup user, set settings with EIA key, record initial ride with gas price, and verify gas-price lookup failure" $LINENO

BASE_URL="http://app:${PORT}"

# 1) Signup a new rider
cv_prereq "Create rider via POST /api/users/signup" $LINENO
SIGNUP_BODY_FILE="/tmp/signup_body_$$.json"
USER_NAME="GasPriceFallbackUser_${RANDOM}"
cat > "$SIGNUP_BODY_FILE" <<JSON
{
  "name": "$USER_NAME",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="/tmp/signup_resp_$$.json"
SIGNUP_STATUS_FILE="/tmp/signup_status_$$.txt"
SIGNUP_HDR_FILE="/tmp/signup_hdr_$$.txt"

REQUEST_BODY_FILE="$SIGNUP_BODY_FILE"
REQUEST_HEADERS="Content-Type: application/json"
cv_prereq "dump request for POST /api/users/signup" $LINENO
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
cat "$REQUEST_BODY_FILE" || true

curl -sS -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_RESP_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$SIGNUP_BODY_FILE" >"$SIGNUP_STATUS_FILE"
SIGNUP_STATUS="$(cat "$SIGNUP_STATUS_FILE")"
cv_http POST "$BASE_URL/api/users/signup" "$SIGNUP_STATUS"
echo "RESPONSE_HEADERS:"
cat "$SIGNUP_HDR_FILE" || true
echo "RESPONSE_BODY:"
cat "$SIGNUP_RESP_FILE" || true
[ "$SIGNUP_STATUS" -eq 201 ] || cv_fail "expected 201 from signup, got $SIGNUP_STATUS" $LINENO

USER_ID="$(jq -r '.userId' "$SIGNUP_RESP_FILE")"
[ "$USER_ID" != "null" ] || cv_fail "signup response missing userId" $LINENO

# 2) Set user settings with EIA gas API key
cv_prereq "PUT /api/users/me/settings with EiaGasApiKey" $LINENO
SETTINGS_BODY_FILE="/tmp/settings_body_$$.json"
cat > "$SETTINGS_BODY_FILE" <<JSON
{
  "averageCarMpg": 30.0,
  "yearlyGoalMiles": 1000.0,
  "oilChangePrice": 50.0,
  "mileageRateCents": 5.0,
  "locationLabel": "Test Location",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "eiaGasApiKey": "test-eia-key",
  "weatherApiKey": null
}
JSON

SETTINGS_RESP_FILE="/tmp/settings_resp_$$.json"
SETTINGS_STATUS_FILE="/tmp/settings_status_$$.txt"
SETTINGS_HDR_FILE="/tmp/settings_hdr_$$.txt"

REQUEST_BODY_FILE="$SETTINGS_BODY_FILE"
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: $USER_ID"
cv_prereq "dump request for PUT /api/users/me/settings" $LINENO
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
cat "$REQUEST_BODY_FILE" || true

curl -sS -D "$SETTINGS_HDR_FILE" -o "$SETTINGS_RESP_FILE" -w '%{http_code}' \
  -X PUT "$BASE_URL/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $USER_ID" \
  --data-binary @"$SETTINGS_BODY_FILE" >"$SETTINGS_STATUS_FILE"
SETTINGS_STATUS="$(cat "$SETTINGS_STATUS_FILE")"
cv_http PUT "$BASE_URL/api/users/me/settings" "$SETTINGS_STATUS"
echo "RESPONSE_HEADERS:"
cat "$SETTINGS_HDR_FILE" || true
echo "RESPONSE_BODY:"
cat "$SETTINGS_RESP_FILE" || true
[ "$SETTINGS_STATUS" -eq 200 ] || cv_fail "expected 200 from settings, got $SETTINGS_STATUS" $LINENO

# 3) Record initial ride with non-null gas price (fallback source)
cv_prereq "POST /api/rides initial ride with gasPricePerGallon=3.0000" $LINENO
INITIAL_RIDE_BODY_FILE="/tmp/initial_ride_body_$$.json"
NOW_ISO="$(date -u +'%Y-%m-%dT%H:%M:%S')"
cat > "$INITIAL_RIDE_BODY_FILE" <<JSON
{
  "rideDateTimeLocal": "$NOW_ISO",
  "miles": 5.5,
  "rideMinutes": 25,
  "gasPricePerGallon": 3.0000,
  "weatherUserOverridden": true
}
JSON

INITIAL_RIDE_RESP_FILE="/tmp/initial_ride_resp_$$.json"
INITIAL_RIDE_STATUS_FILE="/tmp/initial_ride_status_$$.txt"
INITIAL_RIDE_HDR_FILE="/tmp/initial_ride_hdr_$$.txt"

REQUEST_BODY_FILE="$INITIAL_RIDE_BODY_FILE"
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: $USER_ID"
cv_prereq "dump request for POST /api/rides initial ride" $LINENO
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
cat "$REQUEST_BODY_FILE" || true

curl -sS -D "$INITIAL_RIDE_HDR_FILE" -o "$INITIAL_RIDE_RESP_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $USER_ID" \
  --data-binary @"$INITIAL_RIDE_BODY_FILE" >"$INITIAL_RIDE_STATUS_FILE"
INITIAL_RIDE_STATUS="$(cat "$INITIAL_RIDE_STATUS_FILE")"
cv_http POST "$BASE_URL/api/rides" "$INITIAL_RIDE_STATUS"
echo "RESPONSE_HEADERS:"
cat "$INITIAL_RIDE_HDR_FILE" || true
echo "RESPONSE_BODY:"
cat "$INITIAL_RIDE_RESP_FILE" || true
[ "$INITIAL_RIDE_STATUS" -eq 201 ] || cv_fail "expected 201 from initial ride record, got $INITIAL_RIDE_STATUS" $LINENO

# 4) Call gas price lookup for test date; stub forces failure
cv_prereq "GET /api/rides/gas-price for test date expecting isAvailable=false" $LINENO
TEST_DATE="$(date -u +'%Y-%m-%d')"
GAS_LOOKUP_RESP_FILE="/tmp/gas_lookup_resp_$$.json"
GAS_LOOKUP_STATUS_FILE="/tmp/gas_lookup_status_$$.txt"
GAS_LOOKUP_HDR_FILE="/tmp/gas_lookup_hdr_$$.txt"

REQUEST_BODY_FILE="(none)"
REQUEST_HEADERS="X-User-Id: $USER_ID"
cv_prereq "dump request for GET /api/rides/gas-price" $LINENO
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY_FILE"

curl -sS -D "$GAS_LOOKUP_HDR_FILE" -o "$GAS_LOOKUP_RESP_FILE" -w '%{http_code}' \
  -X GET "$BASE_URL/api/rides/gas-price?date=$TEST_DATE" \
  -H "X-User-Id: $USER_ID" >"$GAS_LOOKUP_STATUS_FILE"
GAS_LOOKUP_STATUS="$(cat "$GAS_LOOKUP_STATUS_FILE")"
cv_http GET "$BASE_URL/api/rides/gas-price" "$GAS_LOOKUP_STATUS"
echo "RESPONSE_HEADERS:"
cat "$GAS_LOOKUP_HDR_FILE" || true
echo "RESPONSE_BODY:"
cat "$GAS_LOOKUP_RESP_FILE" || true
[ "$GAS_LOOKUP_STATUS" -eq 200 ] || cv_fail "expected 200 from gas-price lookup, got $GAS_LOOKUP_STATUS" $LINENO

IS_AVAILABLE="$(jq -r '.isAvailable' "$GAS_LOOKUP_RESP_FILE")"
PRICE_VALUE="$(jq -r '.pricePerGallon' "$GAS_LOOKUP_RESP_FILE")"
[ "$IS_AVAILABLE" = "false" ] || cv_fail "expected isAvailable=false after EIA failure, got $IS_AVAILABLE" $LINENO
[ "$PRICE_VALUE" = "null" ] || cv_fail "expected pricePerGallon=null after EIA failure, got $PRICE_VALUE" $LINENO

# When
# ----
cv_step When "record new ride with cleared/omitted gas price" $LINENO

# Build RecordRideRequest without gasPricePerGallon to represent cleared field
NEW_RIDE_BODY_FILE="/tmp/new_ride_body_$$.json"
NEW_RIDE_DATETIME="${TEST_DATE}T09:00:00"
cat > "$NEW_RIDE_BODY_FILE" <<JSON
{
  "rideDateTimeLocal": "$NEW_RIDE_DATETIME",
  "miles": 10.0,
  "rideMinutes": 40,
  "weatherUserOverridden": true
}
JSON

NEW_RIDE_RESP_FILE="/tmp/new_ride_resp_$$.json"
NEW_RIDE_STATUS_FILE="/tmp/new_ride_status_$$.txt"
NEW_RIDE_HDR_FILE="/tmp/new_ride_hdr_$$.txt"

REQUEST_BODY_FILE="$NEW_RIDE_BODY_FILE"
REQUEST_HEADERS="Content-Type: application/json; X-User-Id: $USER_ID"
cv_prereq "dump request for POST /api/rides new ride" $LINENO
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
cat "$REQUEST_BODY_FILE" || true

curl -sS -D "$NEW_RIDE_HDR_FILE" -o "$NEW_RIDE_RESP_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $USER_ID" \
  --data-binary @"$NEW_RIDE_BODY_FILE" >"$NEW_RIDE_STATUS_FILE"
NEW_RIDE_STATUS="$(cat "$NEW_RIDE_STATUS_FILE")"
cv_http POST "$BASE_URL/api/rides" "$NEW_RIDE_STATUS"
echo "RESPONSE_HEADERS:"
cat "$NEW_RIDE_HDR_FILE" || true
echo "RESPONSE_BODY:"
cat "$NEW_RIDE_RESP_FILE" || true
[ "$NEW_RIDE_STATUS" -eq 201 ] || cv_fail "expected 201 from new ride record, got $NEW_RIDE_STATUS" $LINENO

NEW_RIDE_ID="$(jq -r '.rideId' "$NEW_RIDE_RESP_FILE")"
[ "$NEW_RIDE_ID" != "null" ] || cv_fail "new ride response missing rideId" $LINENO

# Then
# ----
cv_step Then "assert history shows new ride gasPricePerGallon=null" $LINENO

HISTORY_RESP_FILE="/tmp/history_resp_$$.json"
HISTORY_STATUS_FILE="/tmp/history_status_$$.txt"
HISTORY_HDR_FILE="/tmp/history_hdr_$$.txt"

REQUEST_BODY_FILE="(none)"
REQUEST_HEADERS="X-User-Id: $USER_ID"
cv_prereq "dump request for GET /api/rides/history" $LINENO
echo "REQUEST_HEADERS=$REQUEST_HEADERS"
echo "REQUEST_BODY=$REQUEST_BODY_FILE"

curl -sS -D "$HISTORY_HDR_FILE" -o "$HISTORY_RESP_FILE" -w '%{http_code}' \
  -X GET "$BASE_URL/api/rides/history" \
  -H "X-User-Id: $USER_ID" >"$HISTORY_STATUS_FILE"
HISTORY_STATUS="$(cat "$HISTORY_STATUS_FILE")"
cv_http GET "$BASE_URL/api/rides/history" "$HISTORY_STATUS"
echo "RESPONSE_HEADERS:"
cat "$HISTORY_HDR_FILE" || true
echo "RESPONSE_BODY:"
cat "$HISTORY_RESP_FILE" || true
[ "$HISTORY_STATUS" -eq 200 ] || cv_fail "expected 200 from ride history, got $HISTORY_STATUS" $LINENO

NEW_RIDE_HISTORY_JSON="$(jq -c --argjson rid "$NEW_RIDE_ID" '.rides[] | select(.rideId == $rid)' "$HISTORY_RESP_FILE")"
[ -n "$NEW_RIDE_HISTORY_JSON" ] || cv_fail "could not find new ride with rideId=$NEW_RIDE_ID in history" $LINENO

NEW_RIDE_GAS="$(printf '%s' "$NEW_RIDE_HISTORY_JSON" | jq -r '.gasPricePerGallon')"
[ "$NEW_RIDE_GAS" = "null" ] || cv_fail "expected gasPricePerGallon=null for new ride, got $NEW_RIDE_GAS" $LINENO

echo "CODEVALID_TEST_ASSERTION_OK:gas_price_fetch_failure_with_fallback_and_clear"

# Teardown
# --------
cv_step Cleanup "no explicit cleanup; rides remain for diagnostic inspection" $LINENO

# No DELETE endpoints are required for this case; leaving created data in the SQLite DB is acceptable for the isolated test environment.
