#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
SUFFIX="$(date +%s%N)"
REGULAR_PRICE="3.1234"
PREMIUM_PRICE="4.5678"
EIA_PATH="/v2/petroleum/pri/gnd/data"

# Unique Wednesday in the past (different week per run) so the week has no cached entry.
OFFSET_WEEKS=$(( (SUFFIX / 1000) % 2000 + 100 ))
BASE_SUNDAY="2026-01-04"
WEEK_START="$(date -u -d "$BASE_SUNDAY - $(( OFFSET_WEEKS * 7 )) days" +%Y-%m-%d)"
RIDE_DATE="$(date -u -d "$WEEK_START + 3 days" +%Y-%m-%d)"
EIA_PERIOD="$(date -u -d "$WEEK_START + 1 days" +%Y-%m-%d)"   # weekly period (Monday), not the ride date
REG_MAPPING_ID=""
PREM_MAPPING_ID=""

wm_add_mapping() { # $1 product facet, $2 price -> echoes mapping id
  local body
  body=$(jq -n --arg p "$1" --arg v "$2" --arg end_value "$RIDE_DATE" --arg period "$EIA_PERIOD" --arg path "$EIA_PATH" '{
    priority: 1,
    request: { method: "GET", urlPath: $path,
      queryParameters: {
        "facets[duoarea][]": {equalTo: "NUS"},
        "facets[product][]": {equalTo: $p},
        "frequency": {equalTo: "weekly"},
        "end": {equalTo: $end_value}
      } },
    response: { status: 200, headers: {"Content-Type": "application/json"},
      jsonBody: { response: { data: [ { period: $period, duoarea: "NUS", product: $p, value: $v, units: "$/GAL" } ] } } }
  }')
  command curl -sS -f -X POST "$WIREMOCK_ADMIN_URL/__admin/mappings" -H 'Content-Type: application/json' --data "$body" | jq -r '.id'
}

wm_count() { # $1 product facet -> number of EIA calls for this ride date and product
  local body
  body=$(jq -n --arg p "$1" --arg end_value "$RIDE_DATE" --arg path "$EIA_PATH" '{
    method: "GET", urlPath: $path,
    queryParameters: { "facets[product][]": {equalTo: $p}, "end": {equalTo: $end_value} } }')
  command curl -sS -f -X POST "$WIREMOCK_ADMIN_URL/__admin/requests/count" -H 'Content-Type: application/json' --data "$body" | jq -r '.count'
}

# Given
cv_step Given "Regular-grade rider with EIA key, EIA stubs for Regular and Premium series, uncached week $WEEK_START" $LINENO
cv_prereq "Stub EIA Regular (EPMR) and Premium (EPMP) weekly series for end=$RIDE_DATE" $LINENO
REG_MAPPING_ID="$(wm_add_mapping EPMR "$REGULAR_PRICE")" || cv_fail "expected WireMock EPMR mapping created got error" $LINENO
PREM_MAPPING_ID="$(wm_add_mapping EPMP "$PREMIUM_PRICE")" || cv_fail "expected WireMock EPMP mapping created got error" $LINENO
[ -n "$REG_MAPPING_ID" ] && [ "$REG_MAPPING_ID" != "null" ] || cv_fail "expected EPMR mapping id got '$REG_MAPPING_ID'" $LINENO
[ -n "$PREM_MAPPING_ID" ] && [ "$PREM_MAPPING_ID" != "null" ] || cv_fail "expected EPMP mapping id got '$PREM_MAPPING_ID'" $LINENO

cv_prereq "Sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -n --arg n "RegularRider$SUFFIX" '{name:$n, pin:"1234"}')" 201
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId')"
[ -n "$RIDER_ID" ] && [ "$RIDER_ID" != "null" ] || cv_fail "expected userId from signup got '$CV_HTTP_BODY'" $LINENO
AUTH=(-H "X-User-Id: $RIDER_ID")

cv_prereq "Save settings with gasGrade Regular and an EIA API key" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":30,"eiaGasApiKey":"test-eia-key","gasGrade":"Regular"}' 200 "${AUTH[@]}"
SAVED_GRADE="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.gasGrade')"
[ "$SAVED_GRADE" = "Regular" ] || cv_fail "expected saved gasGrade Regular got '$SAVED_GRADE'" $LINENO

REG_BEFORE="$(wm_count EPMR)"
PREM_BEFORE="$(wm_count EPMP)"
[ "$REG_BEFORE" = "0" ] || cv_fail "expected no prior EIA Regular calls for $RIDE_DATE got $REG_BEFORE" $LINENO

# When
cv_step When "Look up gas price for ride date $RIDE_DATE using saved grade (no grade param)" $LINENO
cv_http GET "/api/rides/gas-price?date=$RIDE_DATE" 200 "${AUTH[@]}"
LOOKUP_BODY="$CV_HTTP_BODY"

# Then
cv_step Then "Price is from the Regular weekly series and one Regular entry is cached for the week" $LINENO
PRICE="$(printf '%s' "$LOOKUP_BODY" | jq -r '.pricePerGallon')"
GRADE="$(printf '%s' "$LOOKUP_BODY" | jq -r '.grade')"
AVAILABLE="$(printf '%s' "$LOOKUP_BODY" | jq -r '.isAvailable')"
RESP_DATE="$(printf '%s' "$LOOKUP_BODY" | jq -r '.date')"
[ "$AVAILABLE" = "true" ] || cv_fail "expected isAvailable true got $AVAILABLE" $LINENO
[ "$GRADE" = "Regular" ] || cv_fail "expected grade Regular got $GRADE" $LINENO
[ "$RESP_DATE" = "$RIDE_DATE" ] || cv_fail "expected date $RIDE_DATE got $RESP_DATE" $LINENO
jq -en --argjson a "$PRICE" --argjson b "$REGULAR_PRICE" '$a == $b' >/dev/null \
  || cv_fail "expected Regular series price $REGULAR_PRICE got $PRICE (premium stub is $PREMIUM_PRICE)" $LINENO

REG_AFTER="$(wm_count EPMR)"
PREM_AFTER="$(wm_count EPMP)"
[ "$REG_AFTER" = "1" ] || cv_fail "expected exactly 1 EIA Regular (EPMR) weekly call got $REG_AFTER" $LINENO
[ "$PREM_AFTER" = "$PREM_BEFORE" ] || cv_fail "expected no EIA Premium (EPMP) call for Regular rider got $((PREM_AFTER - PREM_BEFORE))" $LINENO

cv_prereq "Read back: another date in the same price week must be served from the stored Regular entry" $LINENO
SAME_WEEK_DATE="$(date -u -d "$WEEK_START + 5 days" +%Y-%m-%d)"
cv_http GET "/api/rides/gas-price?date=$SAME_WEEK_DATE" 200 "${AUTH[@]}"
PRICE2="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.pricePerGallon')"
GRADE2="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.grade')"
[ "$GRADE2" = "Regular" ] || cv_fail "expected cached grade Regular got $GRADE2" $LINENO
jq -en --argjson a "$PRICE2" --argjson b "$REGULAR_PRICE" '$a == $b' >/dev/null \
  || cv_fail "expected cached Regular price $REGULAR_PRICE for week $WEEK_START got $PRICE2" $LINENO
TOTAL_EIA="$(command curl -sS -f -X POST "$WIREMOCK_ADMIN_URL/__admin/requests/count" -H 'Content-Type: application/json' \
  --data "$(jq -n --arg end_value "$SAME_WEEK_DATE" --arg path "$EIA_PATH" '{method:"GET",urlPath:$path,queryParameters:{"end":{equalTo:$end_value}}}')" | jq -r '.count')"
[ "$TOTAL_EIA" = "0" ] || cv_fail "expected cache hit (no EIA call) for $SAME_WEEK_DATE in cached week got $TOTAL_EIA calls" $LINENO

# Cleanup
cv_step Cleanup "Remove WireMock stubs created by this case" $LINENO
[ -n "$REG_MAPPING_ID" ] && command curl -sS -o /dev/null -X DELETE "$WIREMOCK_ADMIN_URL/__admin/mappings/$REG_MAPPING_ID" || true
[ -n "$PREM_MAPPING_ID" ] && command curl -sS -o /dev/null -X DELETE "$WIREMOCK_ADMIN_URL/__admin/mappings/$PREM_MAPPING_ID" || true
echo "No delete endpoint for riders/cache rows; rider $RIDER_ID is uniquely named and isolated"

echo "CODEVALID_TEST_ASSERTION_OK:api_78340768_1"
