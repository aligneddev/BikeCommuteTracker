#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="cv-rider-1-${SUFFIX}"
RIDER_PIN="4711"
WEATHER_KEY="cv-weather-key-${SUFFIX}"
EIA_KEY="cv-eia-key-${SUFFIX}"
LOCATION_LABEL="CV Office ${SUFFIX}"

# Given
cv_step Given "sign up and identify a rider, prepare a full settings payload" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 201
RIDER_ID=$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')
[ -n "$RIDER_ID" ] || cv_fail "expected userId in signup response got: $CV_HTTP_BODY" $LINENO
cv_prereq "identify rider with name and PIN" $LINENO
cv_http POST /api/users/identify "$(jq -nc --arg n "$RIDER_NAME" --arg p "$RIDER_PIN" '{name:$n,pin:$p}')" 200
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.authorized')" = "true" ] || cv_fail "expected identify authorized=true got: $CV_HTTP_BODY" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

PAYLOAD=$(jq -nc --arg loc "$LOCATION_LABEL" --arg wk "$WEATHER_KEY" --arg ek "$EIA_KEY" '{
  averageCarMpg: 27.5,
  yearlyGoalMiles: 2500,
  oilChangePrice: 64.99,
  mileageRateCents: 67.125,
  locationLabel: $loc,
  latitude: 41.8781,
  longitude: -87.6298,
  gasGrade: "Premium",
  weatherApiKey: $wk,
  eiaGasApiKey: $ek
}')

# When
cv_step When "rider saves the full settings profile" $LINENO
cv_http PUT /api/users/me/settings "$PAYLOAD" "${AUTH[@]}"
[ "$CV_HTTP_STATUS" = "200" ] || cv_fail "expected 200 from PUT /api/users/me/settings got $CV_HTTP_STATUS: $CV_HTTP_BODY" $LINENO

# Then
cv_step Then "reloading settings returns every saved value unchanged" $LINENO
cv_http GET /api/users/me/settings "" 200 "${AUTH[@]}"
S=$(printf '%s' "$CV_HTTP_BODY" | jq -c '.settings')
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.hasSettings')" = "true" ] || cv_fail "expected hasSettings=true got: $CV_HTTP_BODY" $LINENO
check_num() {
  ACTUAL=$(printf '%s' "$S" | jq -r --arg f "$1" '.[$f]')
  jq -en --argjson a "${ACTUAL:-null}" --argjson e "$2" '$a == $e' >/dev/null 2>&1
}
check_str() {
  ACTUAL=$(printf '%s' "$S" | jq -r --arg f "$1" '.[$f] // ""')
  [ "$ACTUAL" = "$2" ]
}
check_num averageCarMpg 27.5 || cv_fail "expected settings.averageCarMpg=27.5 got ${ACTUAL}" $LINENO
check_num yearlyGoalMiles 2500 || cv_fail "expected settings.yearlyGoalMiles=2500 got ${ACTUAL}" $LINENO
check_num oilChangePrice 64.99 || cv_fail "expected settings.oilChangePrice=64.99 got ${ACTUAL}" $LINENO
check_num mileageRateCents 67.125 || cv_fail "expected settings.mileageRateCents=67.125 got ${ACTUAL}" $LINENO
RATE_RAW=$(printf '%s' "$CV_HTTP_BODY" | grep -o '"mileageRateCents":[^,}]*' | head -1 | cut -d: -f2)
case "$RATE_RAW" in 67.125*) ;; *) cv_fail "expected mileageRateCents to keep decimal precision 67.125 got '${RATE_RAW}'" $LINENO ;; esac
check_num latitude 41.8781 || cv_fail "expected settings.latitude=41.8781 got ${ACTUAL}" $LINENO
check_num longitude -87.6298 || cv_fail "expected settings.longitude=-87.6298 got ${ACTUAL}" $LINENO
check_str locationLabel "$LOCATION_LABEL" || cv_fail "expected settings.locationLabel='$LOCATION_LABEL' got '${ACTUAL}'" $LINENO
check_str gasGrade "Premium" || cv_fail "expected settings.gasGrade='Premium' got '${ACTUAL}'" $LINENO
check_str weatherApiKey "$WEATHER_KEY" || cv_fail "expected settings.weatherApiKey='$WEATHER_KEY' got '${ACTUAL}'" $LINENO
check_str eiaGasApiKey "$EIA_KEY" || cv_fail "expected settings.eiaGasApiKey='$EIA_KEY' got '${ACTUAL}'" $LINENO

# Cleanup
cv_step Cleanup "clear the rider's saved settings" $LINENO
cv_http PUT /api/users/me/settings '{"averageCarMpg":null,"yearlyGoalMiles":null,"oilChangePrice":null,"mileageRateCents":null,"locationLabel":null,"latitude":null,"longitude":null,"weatherApiKey":null,"eiaGasApiKey":null,"gasGrade":"Regular"}' "${AUTH[@]}" || true

echo "CODEVALID_TEST_ASSERTION_OK:api_47116433_1"
