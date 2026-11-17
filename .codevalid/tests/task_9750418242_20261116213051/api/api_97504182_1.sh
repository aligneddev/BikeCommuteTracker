#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

# Scenario api_97504182_1: Imported rides get gas price and weather attached.
# A rider with a saved location imports a CSV with rides in several Sunday–Saturday weeks.
# EIA (gas) and Open-Meteo archive (weather) are WireMock stubs reached via toxiproxy.

BASE_URL="${BASE_URL:-http://app:6713}"
WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
CASE_ID="api_97504182_1"
SUFFIX="$(date +%s%N)"

RIDER_ID=""
STUB_IDS=()
RIDE_IDS=()
remove_stubs() {
  local sid rid
  if [ -n "$RIDER_ID" ]; then
    for rid in "${RIDE_IDS[@]}"; do
      command curl -sS -o /dev/null -X DELETE -H "X-User-Id: ${RIDER_ID}" "$BASE_URL/api/rides/${rid}" || true
    done
  fi
  for sid in "${STUB_IDS[@]}"; do
    command curl -sS -o /dev/null -X DELETE "$WIREMOCK_ADMIN_URL/__admin/mappings/$sid" || true
  done
}
trap remove_stubs EXIT

wm_add_stub() {
  # $1 = mapping json; appends created stub id to STUB_IDS
  local resp id
  resp="$(command curl -sS -X POST "$WIREMOCK_ADMIN_URL/__admin/mappings" \
    -H 'Content-Type: application/json' --data-binary "$1")" || return 1
  id="$(printf '%s' "$resp" | jq -r '.id // empty')"
  [ -n "$id" ] || return 1
  STUB_IDS+=("$id")
}

wm_find_requests() {
  # $1 = request pattern json; prints matching logged requests json
  command curl -sS -X POST "$WIREMOCK_ADMIN_URL/__admin/requests/find" \
    -H 'Content-Type: application/json' --data-binary "$1"
}

# ---------------------------------------------------------------------------
# Given
cv_step Given "Rider with saved UTC+0 location and unique API keys, vendor stubs for gas (per week) and weather (per date), CSV previewed" $LINENO

# Pick a random anchor date between 2000 and 2016 so the shared weekly gas cache / weather cache is cold for this run.
ANCHOR="$(date -u -d "2000-01-15 +$(( 10#${SUFFIX: -7} % 6000 )) days" +%F)"
ANCHOR_DOW="$(date -u -d "$ANCHOR" +%w)"           # 0 = Sunday
SUN1="$(date -u -d "$ANCHOR -${ANCHOR_DOW} days" +%F)"  # Sunday starting week 1
SUN2="$(date -u -d "$SUN1 -7 days" +%F)"              # Sunday starting week 2 (previous week)
SUN3="$(date -u -d "$SUN1 -21 days" +%F)"             # Sunday starting week 3

D_TUE="$(date -u -d "$SUN1 +2 days" +%F)"   # week 1
D_THU="$(date -u -d "$SUN1 +4 days" +%F)"   # week 1 (shares lookup with Tue)
D_SUN="$SUN1"                               # week 1 (Sunday belongs to its own week)
D_SAT="$(date -u -d "$SUN1 -1 days" +%F)"   # week 2 (Saturday before SUN1)
D_FRI="$(date -u -d "$SUN3 +5 days" +%F)"   # week 3
DATES=("$D_TUE" "$D_THU" "$D_SAT" "$D_SUN" "$D_FRI")
echo "Ride dates: ${DATES[*]}; weeks: $SUN1 $SUN2 $SUN3"

declare -A WEEK_OF=( ["$D_TUE"]="$SUN1" ["$D_THU"]="$SUN1" ["$D_SUN"]="$SUN1" ["$D_SAT"]="$SUN2" ["$D_FRI"]="$SUN3" )
declare -A PRICE_OF_WEEK=( ["$SUN1"]="3.1110" ["$SUN2"]="2.2220" ["$SUN3"]="4.3330" )

week_regex() {
  local s="$1" i out=""
  for i in 0 1 2 3 4 5 6; do
    out="${out}${out:+|}$(date -u -d "$s +$i days" +%F)"
  done
  printf '(%s)' "$out"
}

# Unique location near Accra (UTC+0, no DST) so local noon == 12:00 UTC.
LAT="5.$(printf '%02d' $(( 10#${SUFFIX: -4} % 90 + 10 )))"
LON="-0.$(printf '%02d' $(( 10#${SUFFIX: -2} % 80 + 10 )))"
LAT_RE="$(printf '%s' "$LAT" | sed 's/\./\\./')"
LON_RE="$(printf '%s' "$LON" | sed 's/\./\\./')"
EIA_KEY="cv-eia-${SUFFIX}"
WX_KEY="cv-wx-${SUFFIX}"

cv_prereq "Register WireMock EIA weekly gas price stubs (one price per week)" $LINENO
for wk in "$SUN1" "$SUN2" "$SUN3"; do
  STUB="$(jq -n --arg key "$EIA_KEY" --arg re "$(week_regex "$wk")" --arg price "${PRICE_OF_WEEK[$wk]}" --arg period "$wk" '{
    priority: 1,
    request: { method: "GET", urlPath: "/v2/petroleum/pri/gnd/data",
      queryParameters: { api_key: { equalTo: $key }, end: { matches: $re } } },
    response: { status: 200, headers: { "Content-Type": "application/json" },
      jsonBody: { response: { data: [ { period: $period, value: $price } ] } } } }')"
  wm_add_stub "$STUB" || cv_fail "expected WireMock EIA stub for week $wk to register" $LINENO
done

cv_prereq "Register WireMock Open-Meteo archive stubs (hourly arrays per date)" $LINENO
declare -A NOON_TEMP_OF
idx=0
for d in "${DATES[@]}"; do
  idx=$((idx + 1))
  noon_temp="$(( 60 + idx )).5"
  NOON_TEMP_OF["$d"]="$noon_temp"
  STUB="$(jq -n --arg d "$d" --arg lat "${LAT_RE}.*" --arg lon "${LON_RE}.*" --arg key "$WX_KEY" --argjson noon "$noon_temp" '{
    priority: 1,
    request: { method: "GET", urlPathPattern: "/v1/(archive|forecast)",
      queryParameters: { latitude: { matches: $lat }, longitude: { matches: $lon },
        start_date: { equalTo: $d }, end_date: { equalTo: $d }, apikey: { equalTo: $key } } },
    response: { status: 200, headers: { "Content-Type": "application/json" },
      jsonBody: { hourly: {
        time: [range(0;24) | "\($d)T\(if . < 10 then "0" else "" end)\(.):00"],
        temperature_2m: [range(0;24) | if . == 12 then $noon else 30 + . end],
        wind_speed_10m: [range(0;24) | if . == 12 then 12.5 else 1 end],
        wind_direction_10m: [range(0;24) | if . == 12 then 270 else 10 end],
        relative_humidity_2m: [range(0;24) | if . == 12 then 65 else 20 end],
        cloud_cover: [range(0;24) | if . == 12 then 80 else 5 end],
        precipitation: [range(0;24) | if . == 12 then 0.5 else 0 end],
        snowfall: [range(0;24) | 0],
        weather_code: [range(0;24) | if . == 12 then 61 else 0 end] } } } }')"
  wm_add_stub "$STUB" || cv_fail "expected WireMock weather stub for $d to register" $LINENO
done

cv_prereq "Sign up rider" $LINENO
cv_http POST /api/users/signup "$(jq -n --arg n "cv-imp-enrich-${SUFFIX}" '{name:$n, pin:"1234"}')"
[ "$CV_HTTP_STATUS" = "201" ] || cv_fail "expected 201 from signup got $CV_HTTP_STATUS" $LINENO
RIDER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
[[ "$RIDER_ID" =~ ^[0-9]+$ ]] || cv_fail "expected numeric userId from signup got '$RIDER_ID'" $LINENO
AUTH=(-H "X-User-Id: ${RIDER_ID}")

cv_prereq "Save rider location and vendor API keys" $LINENO
SETTINGS="$(jq -n --argjson lat "$LAT" --argjson lon "$LON" --arg ek "$EIA_KEY" --arg wk "$WX_KEY" \
  '{averageCarMpg:30, locationLabel:"Accra test", latitude:$lat, longitude:$lon, eiaGasApiKey:$ek, weatherApiKey:$wk, gasGrade:"Regular"}')"
cv_http PUT /api/users/me/settings "$SETTINGS" 200 "${AUTH[@]}"
[ "$(printf '%s' "$CV_HTTP_BODY" | jq -r '.settings.latitude')" != "null" ] \
  || cv_fail "expected saved latitude in settings response got $CV_HTTP_BODY" $LINENO

cv_prereq "Preview CSV import (Time column is duration, no Temp column)" $LINENO
CSV="Date,Miles,Time,Notes
${D_TUE},5.5,30,cv tue
${D_THU},6.25,0:45,cv thu
${D_SAT},7,40,cv sat
${D_SUN},8.5,1:05,cv sun
${D_FRI},9.75,55,cv fri
"
CSV_B64="$(printf '%s' "$CSV" | base64 -w0)"
cv_http POST /api/imports/preview "$(jq -n --arg f "cv-enrich-${SUFFIX}.csv" --arg c "$CSV_B64" '{fileName:$f, contentBase64:$c}')" 200 "${AUTH[@]}"
JOB_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.importJobId // empty')"
VALID_ROWS="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.validRows')"
[[ "$JOB_ID" =~ ^[0-9]+$ ]] || cv_fail "expected importJobId from preview got $CV_HTTP_BODY" $LINENO
[ "$VALID_ROWS" = "5" ] || cv_fail "expected 5 valid preview rows got $VALID_ROWS" $LINENO

# ---------------------------------------------------------------------------
# When
cv_step When "Start the previewed CSV import" $LINENO
cv_http POST /api/imports/start "$(jq -n --argjson id "$JOB_ID" '{importJobId:$id, overrideAllDuplicates:false, resolutions:[]}')" 202 "${AUTH[@]}"

# ---------------------------------------------------------------------------
# Then
cv_step Then "Rides carry week-specific gas price and noon weather snapshot; lookups are deduplicated; summary reports enrichment counts" $LINENO

STATUS=""
for _ in $(seq 1 60); do
  cv_http GET "/api/imports/${JOB_ID}/status" 200 "${AUTH[@]}"
  STATUS="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.status')"
  case "$STATUS" in completed|failed|cancelled) break ;; esac
  sleep 1
done
SUMMARY="$CV_HTTP_BODY"
[ "$STATUS" = "completed" ] || cv_fail "expected import status completed got $STATUS ($SUMMARY)" $LINENO
[ "$(printf '%s' "$SUMMARY" | jq -r '.importedRows')" = "5" ] \
  || cv_fail "expected importedRows 5 got $(printf '%s' "$SUMMARY" | jq -c .)" $LINENO

cv_http GET "/api/rides/history?from=${SUN3}&to=$(date -u -d "$SUN1 +6 days" +%F)&pageSize=200" 200 "${AUTH[@]}"
HISTORY="$CV_HTTP_BODY"
[ "$(printf '%s' "$HISTORY" | jq '.rides | length')" = "5" ] \
  || cv_fail "expected 5 imported rides in history got $(printf '%s' "$HISTORY" | jq '.rides | length')" $LINENO
mapfile -t RIDE_IDS < <(printf '%s' "$HISTORY" | jq -r '.rides[].rideId')

for d in "${DATES[@]}"; do
  RIDE="$(printf '%s' "$HISTORY" | jq -c --arg d "$d" '[.rides[] | select(.rideDateTimeLocal | startswith($d))][0]')"
  [ "$RIDE" != "null" ] || cv_fail "expected an imported ride dated $d got none" $LINENO
  wk="${WEEK_OF[$d]}"
  want_price="${PRICE_OF_WEEK[$wk]}"
  got_price="$(printf '%s' "$RIDE" | jq -r '.gasPricePerGallon')"
  [ "$got_price" != "null" ] && jq -en --argjson g "$got_price" --argjson w "$want_price" '$g == $w' >/dev/null \
    || cv_fail "expected ride $d gasPricePerGallon $want_price (week $wk) got $got_price" $LINENO

  want_temp="${NOON_TEMP_OF[$d]}"
  got_temp="$(printf '%s' "$RIDE" | jq -r '.temperature')"
  [ "$got_temp" != "null" ] && jq -en --argjson g "$got_temp" --argjson w "$want_temp" '$g == $w' >/dev/null \
    || cv_fail "expected ride $d temperature $want_temp (12:00 local) got $got_temp" $LINENO
  printf '%s' "$RIDE" | jq -e '(.windSpeedMph == 12.5) and (.windDirectionDeg == 270) and (.relativeHumidityPercent == 65) and (.cloudCoverPercent == 80) and (.precipitationType == "rain")' >/dev/null \
    || cv_fail "expected ride $d weather snapshot wind 12.5mph/270deg humidity 65 cloud 80 precip rain got $RIDE" $LINENO
done

cv_prereq "Check vendor request journal for this rider's keys" $LINENO
EIA_REQS="$(wm_find_requests "$(jq -n --arg k "$EIA_KEY" '{method:"GET", urlPath:"/v2/petroleum/pri/gnd/data", queryParameters:{api_key:{equalTo:$k}}}')")"
echo "EIA requests: $(printf '%s' "$EIA_REQS" | jq -c '[.requests[].url]')"
for wk in "$SUN1" "$SUN2" "$SUN3"; do
  re="$(week_regex "$wk")"
  n="$(printf '%s' "$EIA_REQS" | jq --arg re "end=${re}" '[.requests[] | select(.url | test($re))] | length')"
  [ "$n" = "1" ] || cv_fail "expected exactly 1 EIA gas lookup for week $wk got $n" $LINENO
done

WX_REQS="$(wm_find_requests "$(jq -n --arg k "$WX_KEY" '{method:"GET", urlPathPattern:"/v1/(archive|forecast)", queryParameters:{apikey:{equalTo:$k}}}')")"
echo "Weather requests: $(printf '%s' "$WX_REQS" | jq -c '[.requests[].url]')"
for d in "${DATES[@]}"; do
  n="$(printf '%s' "$WX_REQS" | jq --arg d "start_date=$d" '[.requests[] | select(.url | contains($d))] | length')"
  [ "$n" = "1" ] || cv_fail "expected weather for $d fetched once then reused from storage got $n vendor calls" $LINENO
done

# Import Summary must report enrichment stats (gas prices attached, weather snapshots attached).
GAS_COUNT="$(printf '%s' "$SUMMARY" | jq -r '[paths(scalars) as $p | select(($p[-1]|tostring|ascii_downcase) | test("gas")) | getpath($p)] | first // "missing"')"
WX_COUNT="$(printf '%s' "$SUMMARY" | jq -r '[paths(scalars) as $p | select(($p[-1]|tostring|ascii_downcase) | test("weather")) | getpath($p)] | first // "missing"')"
[ "$GAS_COUNT" = "5" ] || cv_fail "expected Import Summary gas prices attached count 5 got '$GAS_COUNT' in $(printf '%s' "$SUMMARY" | jq -c .)" $LINENO
[ "$WX_COUNT" = "5" ] || cv_fail "expected Import Summary weather snapshots attached count 5 got '$WX_COUNT' in $(printf '%s' "$SUMMARY" | jq -c .)" $LINENO

# ---------------------------------------------------------------------------
# Cleanup
cv_step Cleanup "Delete imported rides and remove WireMock stubs" $LINENO
for rid in "${RIDE_IDS[@]}"; do
  cv_http DELETE "/api/rides/${rid}" "${AUTH[@]}"
done
RIDE_IDS=()
remove_stubs
STUB_IDS=()

echo "CODEVALID_TEST_ASSERTION_OK:api_97504182_1"
