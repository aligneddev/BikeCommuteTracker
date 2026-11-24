#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
CASE_SUFFIX="$(date +%s%N)-$$"
TODAY="$(date -u +%Y-%m-%d)"
YEAR_MONTH="$(date -u +%Y-%m)"
MONTH_START="${YEAR_MONTH}-01"
DOW="$(date -u +%u)"
WEEK_START_OFFSET=$(( DOW - 1 ))
WEEK_START="$(date -u -d "${TODAY} -${WEEK_START_OFFSET} days" +%Y-%m-%d)"

USER1_ID=""
USER2_ID=""
USER1_RIDE_IDS=()
USER2_RIDE_IDS=()
SPLIT_WINDOWS="false"
if [[ "$MONTH_START" < "$WEEK_START" ]]; then
  SPLIT_WINDOWS="true"
fi

wiremock_admin_import_mappings() {
  local dir="$1" f
  for f in "$dir"/*.json; do
    [ -e "$f" ] || { echo "no mappings in $dir" >&2; return 1; }
    curl -sS -f -o /dev/null -X POST "$WIREMOCK_ADMIN_URL/__admin/mappings" \
      -H 'Content-Type: application/json' --data-binary @"$f" \
      || { echo "wiremock import failed: $f" >&2; return 1; }
  done
}

check_num_close() {
  local json="$1" expr="$2" expected="$3" tol="$4"
  printf '%s' "$json" | jq -e --argjson exp "$expected" --argjson tol "$tol" "($expr) != null and ((($expr) - \$exp) | fabs) <= \$tol" >/dev/null
}

# Given
cv_step Given "seed fallback gas price via WireMock and create rides with and without recorded gas prices" $LINENO

cv_prereq "import WireMock EIA gas price mapping for api_17531482_4" $LINENO
wiremock_admin_import_mappings "${CODEVALID_ROOT:-.}/.codevalid/wiremock/mappings/cases/api_17531482_4" \
  || cv_fail "failed to import WireMock mappings for api_17531482_4" $LINENO

cv_prereq "sign up Rider 1 and configure 20 MPG and EIA API key" $LINENO
SIGNUP1_BODY="$(jq -n --arg name "EstRider1_${CASE_SUFFIX}" --arg pin "1234" '{name: $name, pin: $pin}')"
cv_http POST /api/users/signup "$SIGNUP1_BODY" 201
USER1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[ -n "$USER1_ID" ] || cv_fail "signup for Rider 1 did not return userId" $LINENO

cv_http PUT /api/users/me/settings '{"averageCarMpg":20,"eiaGasApiKey":"api-17531482-4-eia-key"}' 200 -H "X-User-Id: $USER1_ID"

cv_prereq "fetch gas price on ${MONTH_START} to populate latest known gas price lookup cache" $LINENO
cv_http GET "/api/rides/gas-price?date=${MONTH_START}" "" 200 -H "X-User-Id: $USER1_ID"
GAS_AVAIL="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.isAvailable')"
[ "$GAS_AVAIL" = "true" ] || cv_fail "expected gas price lookup to be available, got ${CV_HTTP_BODY}" $LINENO
FALLBACK_PRICE="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.pricePerGallon')"
[ -n "$FALLBACK_PRICE" ] && [ "$FALLBACK_PRICE" != "null" ] || cv_fail "expected non-null pricePerGallon from gas-price lookup" $LINENO

cv_prereq "record Rider 1 priced ride (20 mi @ 3.00/gal) today" $LINENO
RIDE1_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 20, gasPricePerGallon: 3.00}')"
cv_http POST /api/rides "$RIDE1_BODY" 201 -H "X-User-Id: $USER1_ID"
RIDE1_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
[ -n "$RIDE1_ID" ] || cv_fail "ride 1 did not return rideId" $LINENO
USER1_RIDE_IDS+=("$RIDE1_ID")

if [ "$SPLIT_WINDOWS" = "true" ]; then
  cv_prereq "record Rider 1 unpriced ride (40 mi) earlier this month on ${MONTH_START} (outside current week)" $LINENO
  RIDE2_BODY="$(jq -n --arg dt "${MONTH_START}T09:00:00" '{rideDateTimeLocal: $dt, miles: 40}')"
  cv_http POST /api/rides "$RIDE2_BODY" 201 -H "X-User-Id: $USER1_ID"
  RIDE2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
  [ -n "$RIDE2_ID" ] || cv_fail "ride 2 did not return rideId" $LINENO
  USER1_RIDE_IDS+=("$RIDE2_ID")
else
  cv_prereq "record Rider 1 unpriced ride (40 mi) today" $LINENO
  RIDE2_BODY="$(jq -n --arg dt "${TODAY}T10:00:00" '{rideDateTimeLocal: $dt, miles: 40}')"
  cv_http POST /api/rides "$RIDE2_BODY" 201 -H "X-User-Id: $USER1_ID"
  RIDE2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
  [ -n "$RIDE2_ID" ] || cv_fail "ride 2 did not return rideId" $LINENO
  USER1_RIDE_IDS+=("$RIDE2_ID")

  cv_prereq "sign up Rider 2 with only priced rides this month to verify non-estimated window" $LINENO
  SIGNUP2_BODY="$(jq -n --arg name "EstRider2_${CASE_SUFFIX}" --arg pin "1234" '{name: $name, pin: $pin}')"
  cv_http POST /api/users/signup "$SIGNUP2_BODY" 201
  USER2_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
  [ -n "$USER2_ID" ] || cv_fail "signup for Rider 2 did not return userId" $LINENO

  cv_http PUT /api/users/me/settings '{"averageCarMpg":20}' 200 -H "X-User-Id: $USER2_ID"

  RIDE3_BODY="$(jq -n --arg dt "${TODAY}T08:00:00" '{rideDateTimeLocal: $dt, miles: 20, gasPricePerGallon: 3.00}')"
  cv_http POST /api/rides "$RIDE3_BODY" 201 -H "X-User-Id: $USER2_ID"
  RIDE3_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.rideId // empty')"
  [ -n "$RIDE3_ID" ] || cv_fail "ride 3 did not return rideId" $LINENO
  USER2_RIDE_IDS+=("$RIDE3_ID")
fi

# When
cv_step When "fetch advanced dashboard to inspect estimated vs exact fuel-cost windows" $LINENO

cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER1_ID"
DASH1_BODY="$CV_HTTP_BODY"

DASH2_BODY=""
if [ "$SPLIT_WINDOWS" != "true" ]; then
  cv_http GET /api/dashboard/advanced "" 200 -H "X-User-Id: $USER2_ID"
  DASH2_BODY="$CV_HTTP_BODY"
fi

# Then
cv_step Then "verify monthly window uses fallback gas price and sets fuelCostEstimated=true while all-priced window has fuelCostEstimated=false" $LINENO

EXPECTED_MONTHLY_FUEL="$(jq -n --argjson fp "$FALLBACK_PRICE" '((20 / 20) * 3.00) + ((40 / 20) * $fp)')"

MONTHLY_EST="$(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.monthly.fuelCostEstimated')"
[ "$MONTHLY_EST" = "true" ] || cv_fail "expected monthly.fuelCostEstimated to be true, got ${MONTHLY_EST}" $LINENO
check_num_close "$DASH1_BODY" '.savingsWindows.monthly.fuelCostAvoided' "$EXPECTED_MONTHLY_FUEL" 0.01 \
  || cv_fail "expected monthly.fuelCostAvoided=${EXPECTED_MONTHLY_FUEL} got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.monthly.fuelCostAvoided')" $LINENO

if [ "$SPLIT_WINDOWS" = "true" ]; then
  WEEKLY_EST="$(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.weekly.fuelCostEstimated')"
  [ "$WEEKLY_EST" = "false" ] || cv_fail "expected weekly.fuelCostEstimated (all rides priced) to be false, got ${WEEKLY_EST}" $LINENO
  check_num_close "$DASH1_BODY" '.savingsWindows.weekly.fuelCostAvoided' 3.00 0.01 \
    || cv_fail "expected weekly.fuelCostAvoided=3.00 got $(printf '%s' "$DASH1_BODY" | jq -r '.savingsWindows.weekly.fuelCostAvoided')" $LINENO
else
  PRICED_EST="$(printf '%s' "$DASH2_BODY" | jq -r '.savingsWindows.monthly.fuelCostEstimated')"
  [ "$PRICED_EST" = "false" ] || cv_fail "expected all-priced monthly.fuelCostEstimated to be false, got ${PRICED_EST}" $LINENO
  check_num_close "$DASH2_BODY" '.savingsWindows.monthly.fuelCostAvoided' 3.00 0.01 \
    || cv_fail "expected all-priced monthly.fuelCostAvoided=3.00 got $(printf '%s' "$DASH2_BODY" | jq -r '.savingsWindows.monthly.fuelCostAvoided')" $LINENO
fi

# Cleanup
cv_step Cleanup "delete created rides" $LINENO
for rid in "${USER1_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER1_ID"
done
for rid in "${USER2_RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "" 200 -H "X-User-Id: $USER2_ID"
done

echo "CODEVALID_TEST_ASSERTION_OK:api_17531482_4"
