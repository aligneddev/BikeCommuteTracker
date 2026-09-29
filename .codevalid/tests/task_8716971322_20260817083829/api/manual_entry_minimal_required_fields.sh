#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: manual_entry_minimal_required_fields
# Purpose: Record a ride with only required fields and verify optional fields are null/empty in history

# --- Mocks ---
cv_step "Given" "Import no vendor mappings; minimal entry does not call EIA or Open-Meteo" $LINENO
# This scenario omits gas price and user latitude/longitude, so RecordRideService never calls
# IGasPriceLookupService or IWeatherLookupService. No WireMock case-specific stubs are needed.

# --- Preconditions ---
cv_prereq "Signup rider and set basic settings without lat/lon" $LINENO

BASE_URL="http://app:${PORT}"

# 1) Create a rider via POST /api/users/signup
cv_prereq "Create rider account for this case" $LINENO
SIGNUP_BODY_FILE="$(mktemp)"
cat >"$SIGNUP_BODY_FILE" <<JSON
{
  "name": "MinimalRideUser-$(date +%s)",
  "pin": "1234"
}
JSON

SIGNUP_RESP_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="$(cat "$SIGNUP_BODY_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS_SIGNUP="$(curl -sS -o "$SIGNUP_RESP_FILE" -D "$SIGNUP_HDR_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"$SIGNUP_BODY_FILE")" || HTTP_STATUS_SIGNUP="000"

RESPONSE_HEADERS="$(cat "$SIGNUP_HDR_FILE")"
RESPONSE_BODY="$(cat "$SIGNUP_RESP_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "$BASE_URL/api/users/signup" "$HTTP_STATUS_SIGNUP"
if [ "$HTTP_STATUS_SIGNUP" -ne 201 ]; then
  cv_fail "Expected 201 from signup, got $HTTP_STATUS_SIGNUP" $LINENO
fi

RIDER_ID="$(jq -r '.userId' <"$SIGNUP_RESP_FILE")"
if [ -z "$RIDER_ID" ] || [ "$RIDER_ID" = "null" ]; then
  cv_fail "Signup response missing userId" $LINENO
fi

# 2) Set basic user settings without latitude/longitude so weather lookup is skipped
cv_prereq "Set rider settings without lat/lon to avoid auto-weather fetch" $LINENO
SETTINGS_BODY_FILE="$(mktemp)"
cat >"$SETTINGS_BODY_FILE" <<JSON
{
  "averageCarMpg": 30.5,
  "yearlyGoalMiles": 1200,
  "oilChangePrice": 60.00,
  "mileageRateCents": 30.0,
  "locationLabel": "NoLocation",
  "latitude": null,
  "longitude": null,
  "dashboardGallonsAvoidedEnabled": true,
  "dashboardGoalProgressEnabled": true,
  "weatherApiKey": null,
  "eiaGasApiKey": null
}
JSON

SETTINGS_RESP_FILE="$(mktemp)"
SETTINGS_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: $RIDER_ID"
REQUEST_BODY="$(cat "$SETTINGS_BODY_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS_SETTINGS="$(curl -sS -o "$SETTINGS_RESP_FILE" -D "$SETTINGS_HDR_FILE" -w '%{http_code}' \
  -X PUT "$BASE_URL/api/users/me/settings" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $RIDER_ID" \
  --data-binary @"$SETTINGS_BODY_FILE")" || HTTP_STATUS_SETTINGS="000"

RESPONSE_HEADERS="$(cat "$SETTINGS_HDR_FILE")"
RESPONSE_BODY="$(cat "$SETTINGS_RESP_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "PUT" "$BASE_URL/api/users/me/settings" "$HTTP_STATUS_SETTINGS"
if [ "$HTTP_STATUS_SETTINGS" -ne 200 ]; then
  cv_fail "Expected 200 from settings update, got $HTTP_STATUS_SETTINGS" $LINENO
fi

# --- When ---
cv_step "When" "POST /api/rides with only required fields (rideDateTimeLocal, miles)" $LINENO

# Build minimal RecordRideRequest JSON
RIDE_REQ_FILE="$(mktemp)"
CURRENT_LOCAL_ISO="$(date -u +'%Y-%m-%dT%H:%M')"  # client sends local-like ISO; server accepts DateTime
cat >"$RIDE_REQ_FILE" <<JSON
{
  "rideDateTimeLocal": "${CURRENT_LOCAL_ISO}",
  "miles": 10.5,
  "weatherUserOverridden": false
}
JSON

RIDE_RESP_FILE="$(mktemp)"
RIDE_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="Content-Type: application/json; X-User-Id: $RIDER_ID"
REQUEST_BODY="$(cat "$RIDE_REQ_FILE")"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS_RIDE="$(curl -sS -o "$RIDE_RESP_FILE" -D "$RIDE_HDR_FILE" -w '%{http_code}' \
  -X POST "$BASE_URL/api/rides" \
  -H 'Content-Type: application/json' \
  -H "X-User-Id: $RIDER_ID" \
  --data-binary @"$RIDE_REQ_FILE")" || HTTP_STATUS_RIDE="000"

RESPONSE_HEADERS="$(cat "$RIDE_HDR_FILE")"
RESPONSE_BODY="$(cat "$RIDE_RESP_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "POST" "$BASE_URL/api/rides" "$HTTP_STATUS_RIDE"
if [ "$HTTP_STATUS_RIDE" -ne 201 ]; then
  cv_fail "Expected 201 Created from POST /api/rides, got $HTTP_STATUS_RIDE" $LINENO
fi

# --- Then ---
cv_step "Then" "Assert success response and history row with null optional fields" $LINENO

# 1) Assert RecordRideSuccessResponse shape
RIDE_ID="$(jq -r '.rideId' <"$RIDE_RESP_FILE")"
RESP_RIDER_ID="$(jq -r '.riderId' <"$RIDE_RESP_FILE")"
SAVED_AT_UTC="$(jq -r '.savedAtUtc' <"$RIDE_RESP_FILE")"
EVENT_STATUS="$(jq -r '.eventStatus' <"$RIDE_RESP_FILE")"

if [ -z "$RIDE_ID" ] || [ "$RIDE_ID" = "null" ]; then
  cv_fail "RecordRideSuccessResponse missing rideId" $LINENO
fi
if [ "$RESP_RIDER_ID" != "$RIDER_ID" ]; then
  cv_fail "RecordRideSuccessResponse riderId '$RESP_RIDER_ID' does not match '$RIDER_ID'" $LINENO
fi
if [ -z "$SAVED_AT_UTC" ] || [ "$SAVED_AT_UTC" = "null" ]; then
  cv_fail "RecordRideSuccessResponse missing savedAtUtc" $LINENO
fi
if [ -z "$EVENT_STATUS" ] || [ "$EVENT_STATUS" = "null" ]; then
  cv_fail "RecordRideSuccessResponse missing eventStatus" $LINENO
fi

# 2) Fetch history and locate this ride
HISTORY_RESP_FILE="$(mktemp)"
HISTORY_HDR_FILE="$(mktemp)"

REQUEST_HEADERS="X-User-Id: $RIDER_ID"
REQUEST_BODY="(none)"
echo "REQUEST_HEADERS: $REQUEST_HEADERS"
echo "REQUEST_BODY: $REQUEST_BODY"

HTTP_STATUS_HISTORY="$(curl -sS -o "$HISTORY_RESP_FILE" -D "$HISTORY_HDR_FILE" -w '%{http_code}' \
  -X GET "$BASE_URL/api/rides/history" \
  -H "X-User-Id: $RIDER_ID")" || HTTP_STATUS_HISTORY="000"

RESPONSE_HEADERS="$(cat "$HISTORY_HDR_FILE")"
RESPONSE_BODY="$(cat "$HISTORY_RESP_FILE")"
echo "RESPONSE_HEADERS: $RESPONSE_HEADERS"
echo "RESPONSE_BODY: $RESPONSE_BODY"

cv_http "GET" "$BASE_URL/api/rides/history" "$HTTP_STATUS_HISTORY"
if [ "$HTTP_STATUS_HISTORY" -ne 200 ]; then
  cv_fail "Expected 200 from GET /api/rides/history, got $HTTP_STATUS_HISTORY" $LINENO
fi

# Extract the ride row matching rideId
RIDE_ROW_JSON="$(jq -c --arg rid "$RIDE_ID" '.rides[] | select(.rideId|tostring == $rid)' <"$HISTORY_RESP_FILE")"
if [ -z "$RIDE_ROW_JSON" ]; then
  cv_fail "History response does not contain rideId $RIDE_ID" $LINENO
fi

# Compare rideDateTimeLocal (strip any timezone suffix from both request and response)
REQ_RIDE_DT_RAW="$(jq -r '.rideDateTimeLocal' <"$RIDE_REQ_FILE")"
RESP_RIDE_DT_RAW="$(echo "$RIDE_ROW_JSON" | jq -r '.rideDateTimeLocal')"

strip_tz() {
  # Strip timezone suffix (Z, +HH:MM, -HH:MM), then strip trailing :SS seconds only when
  # the datetime already has THH:MM:SS form (i.e. two colons after the T), normalising to minute precision
  echo "$1" | sed -E 's/(Z|[+-][0-9]{2}:[0-9]{2})$//' | sed -E 's/(T[0-9]{2}:[0-9]{2}):[0-9]{2}$/\1/'
}
REQ_RIDE_DT_STRIPPED="$(strip_tz "$REQ_RIDE_DT_RAW")"
RESP_RIDE_DT_STRIPPED="$(strip_tz "$RESP_RIDE_DT_RAW")"

if [ "$REQ_RIDE_DT_STRIPPED" != "$RESP_RIDE_DT_STRIPPED" ]; then
  cv_fail "RideDateTimeLocal mismatch: expected '$REQ_RIDE_DT_STRIPPED' got '$RESP_RIDE_DT_STRIPPED'" $LINENO
fi

# Assert miles equals submitted value
RESP_MILES="$(echo "$RIDE_ROW_JSON" | jq -r '.miles')"
if [ "$RESP_MILES" != "10.5" ]; then
  cv_fail "Miles mismatch: expected 10.5 got '$RESP_MILES'" $LINENO
fi

# Assert weatherUserOverridden is false
RESP_WEATHER_OVERRIDDEN="$(echo "$RIDE_ROW_JSON" | jq -r '.weatherUserOverridden')"
if [ "$RESP_WEATHER_OVERRIDDEN" != "false" ]; then
  cv_fail "Expected weatherUserOverridden=false, got '$RESP_WEATHER_OVERRIDDEN'" $LINENO
fi

# Assert all optional fields are null (or absent treated as null by jq)
assert_null_field() {
  local field="$1"
  local value
  value="$(echo "$RIDE_ROW_JSON" | jq -r ".${field}//\"__MISSING__\"")"
  if [ "$value" != "null" ] && [ "$value" != "__MISSING__" ]; then
    cv_fail "Expected ${field} to be null/absent, got '$value'" $LINENO
  fi
}

# Use only bash and jq to assert null/absent for each optional field.
for FIELD in rideMinutes temperature gasPricePerGallon windSpeedMph windDirectionDeg \
             cloudCoverPercent precipitationType note difficulty \
             windResistanceRating importSource; do
  assert_null_field "$FIELD"
done

# Explicitly assert fields flagged by the linter using the same bash/jq helper
assert_null_field "relativeHumidityPercent"
assert_null_field "primaryTravelDirection"

# --- Teardown ---
cv_step "Cleanup" "No explicit cleanup; test database is ephemeral per run" $LINENO
# SQLite database lives inside the app container and is unique per test run.
# No ride deletion is required; seed-test environment is discarded after execution.

# Success marker required by the runner
echo "CODEVALID_TEST_ASSERTION_OK:manual_entry_minimal_required_fields"
