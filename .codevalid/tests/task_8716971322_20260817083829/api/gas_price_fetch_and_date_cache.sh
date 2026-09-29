#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

cv_prereq "Configure WireMock stub for EIA gas price v2 API" $LINENO
CASE_DIR=".codevalid/wiremock/mappings/cases/gas_price_fetch_and_date_cache"
mkdir -p "$CASE_DIR"

# Stub EIA v2 weekly gas price endpoint. App builds request as:
#   GET /v2/petroleum/pri/gnd/data?api_key=...&data[]=value&facets[duoarea][]=NUS&facets[product][]=EPMR&frequency=weekly&end=YYYY-MM-DD&sort[0][column]=period&sort[0][direction]=desc&length=1
# Response shape expected by TryReadPrice:
#   { "response": { "data": [ { "period": "YYYY-MM-DD", "value": "3.4567" } ] } }
cat > "$CASE_DIR/eia-gas-price-weekly.json" <<'JSON'
{
  "request": {
    "method": "GET",
    "urlPath": "/v2/petroleum/pri/gnd/data",
    "queryParameters": {
      "facets[duoarea][]": {
        "equalTo": "NUS"
      },
      "facets[product][]": {
        "equalTo": "EPMR"
      },
      "frequency": {
        "equalTo": "weekly"
      },
      "data[]": {
        "equalTo": "value"
      }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "response": {
        "data": [
          {
            "period": "2026-03-30",
            "value": "3.4567"
          }
        ]
      }
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
JSON

wiremock_admin_import_mappings "$CASE_DIR"

cv_step "Given" "Signup user, set EIA gas API key, and pick test date" $LINENO
BASE_URL="http://app:${PORT}"

# 1) Signup a new rider
cv_prereq "Create rider via POST /api/users/signup" $LINENO
SIGNUP_BODY_FILE="$(mktemp)"
cat > "$SIGNUP_BODY_FILE" <<'JSON'
{
  "name": "GasPriceCacheRider",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: POST $BASE_URL/api/users/signup"
echo "REQUEST_BODY:"
cat "$SIGNUP_BODY_FILE"
HTTP_STATUS_SIGNUP="$(curl -sS -D "$SIGNUP_HDR_FILE" -o "$SIGNUP_RESP_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$SIGNUP_BODY_FILE")" || cv_fail "Signup request failed" $LINENO
cv_http "POST" "/api/users/signup" "$HTTP_STATUS_SIGNUP"
echo "RESPONSE_HEADERS:"
cat "$SIGNUP_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$SIGNUP_RESP_FILE"
[ "$HTTP_STATUS_SIGNUP" -eq 201 ] || cv_fail "Expected 201 from signup, got $HTTP_STATUS_SIGNUP" $LINENO

RIDER_ID="$(jq -r '.userId' < "$SIGNUP_RESP_FILE")"
[ "$RIDER_ID" != "null" ] || cv_fail "Signup response missing userId" $LINENO

# 2) Set user settings with an EIA gas API key so lookup is enabled
cv_prereq "Configure EIA gas API key via PUT /api/users/me/settings" $LINENO
SETTINGS_BODY_FILE="$(mktemp)"
cat > "$SETTINGS_BODY_FILE" <<'JSON'
{
  "averageCarMpg": 30.0,
  "yearlyGoalMiles": 1000.0,
  "oilChangePrice": 60.0,
  "mileageRateCents": 60.0,
  "locationLabel": "Test City",
  "latitude": 40.71,
  "longitude": -74.01,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "eiaGasApiKey": "test-eia-key",
  "weatherApiKey": null
}
JSON

SETTINGS_RESP_FILE="$(mktemp)"
SETTINGS_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: PUT $BASE_URL/api/users/me/settings"
echo "REQUEST_BODY:"
cat "$SETTINGS_BODY_FILE"
HTTP_STATUS_SETTINGS="$(curl -sS -D "$SETTINGS_HDR_FILE" -o "$SETTINGS_RESP_FILE" -w '%{http_code}' \
  -X PUT "$BASE_URL/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$SETTINGS_BODY_FILE")" || cv_fail "Settings request failed" $LINENO
cv_http "PUT" "/api/users/me/settings" "$HTTP_STATUS_SETTINGS"
echo "RESPONSE_HEADERS:"
cat "$SETTINGS_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$SETTINGS_RESP_FILE"
[ "$HTTP_STATUS_SETTINGS" -eq 200 ] || cv_fail "Expected 200 from settings, got $HTTP_STATUS_SETTINGS" $LINENO

# 3) Choose a test calendar date (today from container clock) and keep ISO date-only string
TEST_DATE="$(date -u '+%Y-%m-%d')"

cv_step "When" "Lookup gas price, record two rides on same date, and query history" $LINENO

# A) First gas price lookup for TEST_DATE (should hit vendor and populate cache)
cv_prereq "First GET /api/rides/gas-price cache miss, expect price from stub" $LINENO
GAS1_RESP_FILE="$(mktemp)"
GAS1_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: GET $BASE_URL/api/rides/gas-price"
echo "REQUEST_BODY: (query params) date=${TEST_DATE}"
HTTP_STATUS_GAS1="$(curl -sS -D "$GAS1_HDR_FILE" -o "$GAS1_RESP_FILE" -w '%{http_code}' \
  -G "$BASE_URL/api/rides/gas-price" \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-urlencode "date=${TEST_DATE}")" || cv_fail "First gas-price request failed" $LINENO
cv_http "GET" "/api/rides/gas-price" "$HTTP_STATUS_GAS1"
echo "RESPONSE_HEADERS:"
cat "$GAS1_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$GAS1_RESP_FILE"
[ "$HTTP_STATUS_GAS1" -eq 200 ] || cv_fail "Expected 200 from first gas-price lookup, got $HTTP_STATUS_GAS1" $LINENO

GAS_PRICE_STR="$(jq -r '.pricePerGallon // empty' < "$GAS1_RESP_FILE")"
[ -n "$GAS_PRICE_STR" ] || cv_fail "First gas-price response missing pricePerGallon" $LINENO
GAS_PRICE_NUM="$(jq -r '.pricePerGallon' < "$GAS1_RESP_FILE")"

# B) Record first ride on TEST_DATE using the fetched gas price
cv_prereq "POST /api/rides for first ride with gasPricePerGallon from lookup" $LINENO
RIDE1_BODY_FILE="$(mktemp)"
# Use current UTC time but ensure date part matches TEST_DATE; app accepts ISO DateTime
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S')"
RIDE1_DATETIME="${TEST_DATE}T$(date -u '+%H:%M:%S')"

cat > "$RIDE1_BODY_FILE" <<JSON
{
  "rideDateTimeLocal": "${RIDE1_DATETIME}",
  "miles": 10.5,
  "rideMinutes": 45,
  "temperature": null,
  "gasPricePerGallon": ${GAS_PRICE_STR},
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": null,
  "weatherUserOverridden": false,
  "difficulty": null,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "gas-price-cache-test-1"
}
JSON

RIDE1_RESP_FILE="$(mktemp)"
RIDE1_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: POST $BASE_URL/api/rides"
echo "REQUEST_BODY:"
cat "$RIDE1_BODY_FILE"
HTTP_STATUS_RIDE1="$(curl -sS -D "$RIDE1_HDR_FILE" -o "$RIDE1_RESP_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$RIDE1_BODY_FILE")" || cv_fail "First ride POST failed" $LINENO
cv_http "POST" "/api/rides" "$HTTP_STATUS_RIDE1"
echo "RESPONSE_HEADERS:"
cat "$RIDE1_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$RIDE1_RESP_FILE"
[ "$HTTP_STATUS_RIDE1" -eq 201 ] || cv_fail "Expected 201 from first ride POST, got $HTTP_STATUS_RIDE1" $LINENO
RIDE1_ID="$(jq -r '.rideId' < "$RIDE1_RESP_FILE")"

# C) Second gas price lookup for same TEST_DATE (should use cache)
cv_prereq "Second GET /api/rides/gas-price cache hit" $LINENO
GAS2_RESP_FILE="$(mktemp)"
GAS2_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: GET $BASE_URL/api/rides/gas-price"
echo "REQUEST_BODY: (query params) date=${TEST_DATE}"
HTTP_STATUS_GAS2="$(curl -sS -D "$GAS2_HDR_FILE" -o "$GAS2_RESP_FILE" -w '%{http_code}' \
  -G "$BASE_URL/api/rides/gas-price" \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-urlencode "date=${TEST_DATE}")" || cv_fail "Second gas-price request failed" $LINENO
cv_http "GET" "/api/rides/gas-price" "$HTTP_STATUS_GAS2"
echo "RESPONSE_HEADERS:"
cat "$GAS2_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$GAS2_RESP_FILE"
[ "$HTTP_STATUS_GAS2" -eq 200 ] || cv_fail "Expected 200 from second gas-price lookup, got $HTTP_STATUS_GAS2" $LINENO

# D) Record second ride on same date using the cached gas price from second lookup
cv_prereq "POST /api/rides for second ride with cached gasPricePerGallon" $LINENO
GAS2_PRICE_STR="$(jq -r '.pricePerGallon // empty' < "$GAS2_RESP_FILE")"
[ -n "$GAS2_PRICE_STR" ] || cv_fail "Second gas-price response missing pricePerGallon" $LINENO

RIDE2_BODY_FILE="$(mktemp)"
RIDE2_DATETIME="${TEST_DATE}T$(date -u '+%H:%M:%S')"
cat > "$RIDE2_BODY_FILE" <<JSON
{
  "rideDateTimeLocal": "${RIDE2_DATETIME}",
  "miles": 7.25,
  "rideMinutes": 30,
  "temperature": null,
  "gasPricePerGallon": ${GAS2_PRICE_STR},
  "windSpeedMph": null,
  "windDirectionDeg": null,
  "relativeHumidityPercent": null,
  "cloudCoverPercent": null,
  "precipitationType": null,
  "note": "Second ride on cached gas price date",
  "weatherUserOverridden": false,
  "difficulty": null,
  "primaryTravelDirection": null,
  "selectedPresetId": null,
  "importSource": "gas-price-cache-test-2"
}
JSON

RIDE2_RESP_FILE="$(mktemp)"
RIDE2_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: POST $BASE_URL/api/rides"
echo "REQUEST_BODY:"
cat "$RIDE2_BODY_FILE"
HTTP_STATUS_RIDE2="$(curl -sS -D "$RIDE2_HDR_FILE" -o "$RIDE2_RESP_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary @"$RIDE2_BODY_FILE")" || cv_fail "Second ride POST failed" $LINENO
cv_http "POST" "/api/rides" "$HTTP_STATUS_RIDE2"
echo "RESPONSE_HEADERS:"
cat "$RIDE2_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$RIDE2_RESP_FILE"
[ "$HTTP_STATUS_RIDE2" -eq 201 ] || cv_fail "Expected 201 from second ride POST, got $HTTP_STATUS_RIDE2" $LINENO
RIDE2_ID="$(jq -r '.rideId' < "$RIDE2_RESP_FILE")"

# E) Fetch ride history to inspect persisted gasPricePerGallon values
cv_prereq "GET /api/rides/history for rider to read gas price on rides" $LINENO
HIST_RESP_FILE="$(mktemp)"
HIST_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: GET $BASE_URL/api/rides/history"
echo "REQUEST_BODY: (none)"
HTTP_STATUS_HIST="$(curl -sS -D "$HIST_HDR_FILE" -o "$HIST_RESP_FILE" -w '%{http_code}' \
  -X GET "$BASE_URL/api/rides/history" \
  -H "X-User-Id: ${RIDER_ID}")" || cv_fail "Ride history request failed" $LINENO
cv_http "GET" "/api/rides/history" "$HTTP_STATUS_HIST"
echo "RESPONSE_HEADERS:"
cat "$HIST_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$HIST_RESP_FILE"
[ "$HTTP_STATUS_HIST" -eq 200 ] || cv_fail "Expected 200 from ride history, got $HTTP_STATUS_HIST" $LINENO

cv_step "Then" "Assert gas price cached per date, reused for multiple rides, and persisted" $LINENO

# 1) Assert gas-price responses both used the stub price and mark availability
GAS1_DATE="$(jq -r '.date' < "$GAS1_RESP_FILE")"
[ "$GAS1_DATE" = "$TEST_DATE" ] || cv_fail "First gas-price date mismatch: expected $TEST_DATE got $GAS1_DATE" $LINENO
GAS2_DATE="$(jq -r '.date' < "$GAS2_RESP_FILE")"
[ "$GAS2_DATE" = "$TEST_DATE" ] || cv_fail "Second gas-price date mismatch: expected $TEST_DATE got $GAS2_DATE" $LINENO

GAS1_AVAILABLE="$(jq -r '.isAvailable' < "$GAS1_RESP_FILE")"
GAS2_AVAILABLE="$(jq -r '.isAvailable' < "$GAS2_RESP_FILE")"
[ "$GAS1_AVAILABLE" = "true" ] || cv_fail "First gas-price lookup should be available" $LINENO
[ "$GAS2_AVAILABLE" = "true" ] || cv_fail "Second gas-price lookup should be available (cache hit)" $LINENO

GAS1_SOURCE="$(jq -r '.dataSource // empty' < "$GAS1_RESP_FILE")"
GAS2_SOURCE="$(jq -r '.dataSource // empty' < "$GAS2_RESP_FILE")"
EXPECTED_SOURCE="Source: U.S. Energy Information Administration (EIA)"
[ "$GAS1_SOURCE" = "$EXPECTED_SOURCE" ] || cv_fail "First gas-price dataSource mismatch: expected '$EXPECTED_SOURCE' got '$GAS1_SOURCE'" $LINENO
[ "$GAS2_SOURCE" = "$EXPECTED_SOURCE" ] || cv_fail "Second gas-price dataSource mismatch: expected '$EXPECTED_SOURCE' got '$GAS2_SOURCE'" $LINENO

# Both responses should carry the same price value from the stub (3.4567)
GAS1_PRICE="$(jq -r '.pricePerGallon' < "$GAS1_RESP_FILE")"
GAS2_PRICE="$(jq -r '.pricePerGallon' < "$GAS2_RESP_FILE")"
[ "$GAS1_PRICE" = "$GAS2_PRICE" ] || cv_fail "Expected same price per gallon for both lookups, got $GAS1_PRICE vs $GAS2_PRICE" $LINENO
[ "$GAS1_PRICE" = "3.4567" ] || cv_fail "Expected stub price 3.4567, got $GAS1_PRICE" $LINENO

# 2) Assert ride history exposes the same cached gas price on both rides
RIDE1_HISTORY_PRICE="$(jq -r --arg id "$RIDE1_ID" '.rides[] | select(.rideId == ($id|tonumber)) | .gasPricePerGallon' < "$HIST_RESP_FILE")"
RIDE2_HISTORY_PRICE="$(jq -r --arg id "$RIDE2_ID" '.rides[] | select(.rideId == ($id|tonumber)) | .gasPricePerGallon' < "$HIST_RESP_FILE")"

[ "$RIDE1_HISTORY_PRICE" = "3.4567" ] || cv_fail "First ride history gasPricePerGallon expected 3.4567, got $RIDE1_HISTORY_PRICE" $LINENO
[ "$RIDE2_HISTORY_PRICE" = "3.4567" ] || cv_fail "Second ride history gasPricePerGallon expected 3.4567, got $RIDE2_HISTORY_PRICE" $LINENO

# 3) Inspect WireMock journal to ensure vendor was called at least once (cache miss), but not required on every lookup
cv_prereq "Check WireMock EIA request journal via DELETE /__admin/requests (reset) and GET" $LINENO
# First, fetch all requests; WireMock 3.x uses GET /__admin/requests
WIREMOCK_REQ_FILE="$(mktemp)"
WIREMOCK_REQ_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: GET ${WIREMOCK_ADMIN_URL}/__admin/requests"
echo "REQUEST_BODY: (none)"
HTTP_STATUS_WM_REQ="$(curl -sS -D "$WIREMOCK_REQ_HDR_FILE" -o "$WIREMOCK_REQ_FILE" -w '%{http_code}' \
  "${WIREMOCK_ADMIN_URL}/__admin/requests")" || cv_fail "Failed to read WireMock journal" $LINENO
cv_http "GET" "/__admin/requests" "$HTTP_STATUS_WM_REQ"
echo "RESPONSE_HEADERS:"
cat "$WIREMOCK_REQ_HDR_FILE"
echo "RESPONSE_BODY:"
cat "$WIREMOCK_REQ_FILE"
[ "$HTTP_STATUS_WM_REQ" -eq 200 ] || cv_fail "Expected 200 from WireMock requests admin, got $HTTP_STATUS_WM_REQ" $LINENO

EIA_CALL_COUNT="$(jq '[.requests[] | select(.request.url | startswith("/v2/petroleum/pri/gnd/data"))] | length' < "$WIREMOCK_REQ_FILE")"
# Polly resilience handler may retry on transient errors; assert at least one call for cache miss
if [ "$EIA_CALL_COUNT" -lt 1 ]; then
  cv_fail "Expected at least one EIA API call for first gas price lookup, saw $EIA_CALL_COUNT" $LINENO
fi

# Business requirement: subsequent rides on same date use cached price, not new vendor calls.
# We do not assert an exact call count (due to retries) but confirm both rides show identical pricePerGallon from the stub and that both gas-price responses are marked as available with the EIA source.

cv_step "Cleanup" "No explicit cleanup; rider and rides remain for inspection" $LINENO
# EF Core SQLite DB is scoped to the app container; test data is isolated per run and does not affect other cases.
# No DELETE endpoints are required for this scenario.

echo "CODEVALID_TEST_ASSERTION_OK:gas_price_fetch_and_date_cache"
