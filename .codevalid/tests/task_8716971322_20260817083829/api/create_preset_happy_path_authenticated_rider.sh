#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case mappings
# | case_id                                | purpose                                      |
# |----------------------------------------|----------------------------------------------|
# | create_preset_happy_path_authenticated_rider | Create a new ride preset and verify listing |

# Case: create_preset_happy_path_authenticated_rider

# Mocks
# No external vendor calls are made by POST /api/rides/presets or GET /api/rides/presets.
# WireMock mappings are not required for this case.

# Preconditions
cv_step "Given" "API is healthy and a rider account exists for preset creation" $LINENO
API_BASE="http://app:${PORT}"

# Health check
HEALTH_STATUS_FILE="$(mktemp)"
HEALTH_BODY_FILE="$(mktemp)"
HEALTH_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: GET ${API_BASE}/health" >&2
echo "REQUEST_BODY: (none)" >&2
curl -sS -D "${HEALTH_HDR_FILE}" -o "${HEALTH_BODY_FILE}" -w "%{http_code}" "${API_BASE}/health" > "${HEALTH_STATUS_FILE}" || true
HEALTH_STATUS="$(cat "${HEALTH_STATUS_FILE}")"
echo "RESPONSE_HEADERS:" >&2
cat "${HEALTH_HDR_FILE}" >&2
echo "RESPONSE_BODY:" >&2
cat "${HEALTH_BODY_FILE}" >&2
cv_http "GET" "${API_BASE}/health" "${HEALTH_STATUS}"
if [ "${HEALTH_STATUS}" -ne 200 ]; then
  cv_fail "Expected health status 200 got ${HEALTH_STATUS}" $LINENO
fi

# Signup a new rider to obtain a real userId for X-User-Id authentication
cv_prereq "Create rider via POST /api/users/signup to obtain userId" $LINENO
SIGNUP_STATUS_FILE="$(mktemp)"
SIGNUP_BODY_FILE="$(mktemp)"
SIGNUP_HDR_FILE="$(mktemp)"
RIDER_NAME="PresetUser_$(date +%s)"
RIDER_PIN="1234"

SIGNUP_PAYLOAD="$(printf '{"name":"%s","pin":"%s"}' "${RIDER_NAME}" "${RIDER_PIN}")"
echo "REQUEST_HEADERS: POST ${API_BASE}/api/users/signup" >&2
echo "  Content-Type: application/json" >&2
echo "REQUEST_BODY: ${SIGNUP_PAYLOAD}" >&2
curl -sS -D "${SIGNUP_HDR_FILE}" -o "${SIGNUP_BODY_FILE}" -w "%{http_code}" \
  -X POST "${API_BASE}/api/users/signup" \
  -H "Content-Type: application/json" \
  --data-binary "${SIGNUP_PAYLOAD}" \
  > "${SIGNUP_STATUS_FILE}" || true
SIGNUP_STATUS="$(cat "${SIGNUP_STATUS_FILE}")"
echo "RESPONSE_HEADERS:" >&2
cat "${SIGNUP_HDR_FILE}" >&2
echo "RESPONSE_BODY:" >&2
cat "${SIGNUP_BODY_FILE}" >&2
cv_http "POST" "${API_BASE}/api/users/signup" "${SIGNUP_STATUS}"
if [ "${SIGNUP_STATUS}" -ne 201 ]; then
  cv_fail "Expected signup status 201 got ${SIGNUP_STATUS}" $LINENO
fi

RIDER_ID="$(jq -r '.userId // .UserId' < "${SIGNUP_BODY_FILE}")"
if ! printf '%s' "${RIDER_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Signup response did not contain numeric userId: ${RIDER_ID}" $LINENO
fi

# When
cv_step "When" "Authenticated rider posts a valid preset to POST /api/rides/presets" $LINENO
CREATE_STATUS_FILE="$(mktemp)"
CREATE_BODY_FILE="$(mktemp)"
CREATE_HDR_FILE="$(mktemp)"

PRESET_NAME="Morning Commute"
PRIMARY_DIRECTION="SW"
PERIOD_TAG="morning"
EXACT_START_TIME="07:45"
DURATION_MINUTES=34
MILES_VALUE="7.2"

CREATE_PAYLOAD="$(printf '{"name":"%s","primaryDirection":"%s","periodTag":"%s","exactStartTimeLocal":"%s","durationMinutes":%d,"miles":%s}' "${PRESET_NAME}" "${PRIMARY_DIRECTION}" "${PERIOD_TAG}" "${EXACT_START_TIME}" "${DURATION_MINUTES}" "${MILES_VALUE}")"
echo "REQUEST_HEADERS: POST ${API_BASE}/api/rides/presets" >&2
echo "  Content-Type: application/json" >&2
echo "  X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: ${CREATE_PAYLOAD}" >&2
curl -sS -D "${CREATE_HDR_FILE}" -o "${CREATE_BODY_FILE}" -w "%{http_code}" \
  -X POST "${API_BASE}/api/rides/presets" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${RIDER_ID}" \
  --data-binary "${CREATE_PAYLOAD}" \
  > "${CREATE_STATUS_FILE}" || true
CREATE_STATUS="$(cat "${CREATE_STATUS_FILE}")"
echo "RESPONSE_HEADERS:" >&2
cat "${CREATE_HDR_FILE}" >&2
echo "RESPONSE_BODY:" >&2
cat "${CREATE_BODY_FILE}" >&2
cv_http "POST" "${API_BASE}/api/rides/presets" "${CREATE_STATUS}"

# Then
cv_step "Then" "Response is 201 Created and preset is persisted and listed for this rider" $LINENO
if [ "${CREATE_STATUS}" -ne 201 ]; then
  cv_fail "Expected create preset status 201 got ${CREATE_STATUS}" $LINENO
fi

# Assert response body fields for RidePresetDto
PRESET_ID="$(jq -r '.presetId' < "${CREATE_BODY_FILE}")"
RESP_NAME="$(jq -r '.name' < "${CREATE_BODY_FILE}")"
RESP_PRIMARY_DIR="$(jq -r '.primaryDirection' < "${CREATE_BODY_FILE}")"
RESP_PERIOD_TAG="$(jq -r '.periodTag' < "${CREATE_BODY_FILE}")"
RESP_EXACT_START="$(jq -r '.exactStartTimeLocal' < "${CREATE_BODY_FILE}")"
RESP_DURATION_MINUTES="$(jq -r '.durationMinutes' < "${CREATE_BODY_FILE}")"
RESP_MILES="$(jq -r '.miles' < "${CREATE_BODY_FILE}")"

if ! printf '%s' "${PRESET_ID}" | grep -Eq '^[0-9]+$'; then
  cv_fail "Expected numeric presetId in create response, got '${PRESET_ID}'" $LINENO
fi
if [ "${RESP_NAME}" != "${PRESET_NAME}" ]; then
  cv_fail "Expected name '${PRESET_NAME}' got '${RESP_NAME}'" $LINENO
fi
if [ "${RESP_PRIMARY_DIR}" != "${PRIMARY_DIRECTION}" ]; then
  cv_fail "Expected primaryDirection '${PRIMARY_DIRECTION}' got '${RESP_PRIMARY_DIR}'" $LINENO
fi
# PeriodTag is normalized to lowercase by NormalizePresetRequest
if [ "${RESP_PERIOD_TAG}" != "${PERIOD_TAG}" ]; then
  cv_fail "Expected periodTag '${PERIOD_TAG}' got '${RESP_PERIOD_TAG}'" $LINENO
fi
if [ "${RESP_EXACT_START}" != "${EXACT_START_TIME}" ]; then
  cv_fail "Expected exactStartTimeLocal '${EXACT_START_TIME}' got '${RESP_EXACT_START}'" $LINENO
fi
if [ "${RESP_DURATION_MINUTES}" -ne "${DURATION_MINUTES}" ]; then
  cv_fail "Expected durationMinutes ${DURATION_MINUTES} got ${RESP_DURATION_MINUTES}" $LINENO
fi
# Compare miles numerically to avoid string formatting differences
awk -v expected="${MILES_VALUE}" -v actual="${RESP_MILES}" 'BEGIN {
  if (actual+0 != expected+0) {
    exit 1
  }
}' || cv_fail "Expected miles ${MILES_VALUE} got ${RESP_MILES}" $LINENO

# Verify preset is listed via GET /api/rides/presets for this rider
LIST_STATUS_FILE="$(mktemp)"
LIST_BODY_FILE="$(mktemp)"
LIST_HDR_FILE="$(mktemp)"

echo "REQUEST_HEADERS: GET ${API_BASE}/api/rides/presets" >&2
echo "  Content-Type: application/json" >&2
echo "  X-User-Id: ${RIDER_ID}" >&2
echo "REQUEST_BODY: (none)" >&2
curl -sS -D "${LIST_HDR_FILE}" -o "${LIST_BODY_FILE}" -w "%{http_code}" \
  -X GET "${API_BASE}/api/rides/presets" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${RIDER_ID}" \
  > "${LIST_STATUS_FILE}" || true
LIST_STATUS="$(cat "${LIST_STATUS_FILE}")"
echo "RESPONSE_HEADERS:" >&2
cat "${LIST_HDR_FILE}" >&2
echo "RESPONSE_BODY:" >&2
cat "${LIST_BODY_FILE}" >&2
cv_http "GET" "${API_BASE}/api/rides/presets" "${LIST_STATUS}"

if [ "${LIST_STATUS}" -ne 200 ]; then
  cv_fail "Expected list presets status 200 got ${LIST_STATUS}" $LINENO
fi

PRESET_COUNT="$(jq '.presets | length' < "${LIST_BODY_FILE}")"
if [ "${PRESET_COUNT}" -ne 1 ]; then
  cv_fail "Expected exactly 1 preset for rider got ${PRESET_COUNT}" $LINENO
fi

LISTED_PRESET_ID="$(jq -r '.presets[0].presetId' < "${LIST_BODY_FILE}")"
LISTED_NAME="$(jq -r '.presets[0].name' < "${LIST_BODY_FILE}")"
LISTED_PRIMARY_DIR="$(jq -r '.presets[0].primaryDirection' < "${LIST_BODY_FILE}")"
LISTED_PERIOD_TAG="$(jq -r '.presets[0].periodTag' < "${LIST_BODY_FILE}")"
LISTED_EXACT_START="$(jq -r '.presets[0].exactStartTimeLocal' < "${LIST_BODY_FILE}")"
LISTED_DURATION_MINUTES="$(jq -r '.presets[0].durationMinutes' < "${LIST_BODY_FILE}")"
LISTED_MILES="$(jq -r '.presets[0].miles' < "${LIST_BODY_FILE}")"

if [ "${LISTED_PRESET_ID}" != "${PRESET_ID}" ]; then
  cv_fail "Expected listed presetId ${PRESET_ID} got ${LISTED_PRESET_ID}" $LINENO
fi
if [ "${LISTED_NAME}" != "${PRESET_NAME}" ]; then
  cv_fail "Expected listed name '${PRESET_NAME}' got '${LISTED_NAME}'" $LINENO
fi
if [ "${LISTED_PRIMARY_DIR}" != "${PRIMARY_DIRECTION}" ]; then
  cv_fail "Expected listed primaryDirection '${PRIMARY_DIRECTION}' got '${LISTED_PRIMARY_DIR}'" $LINENO
fi
if [ "${LISTED_PERIOD_TAG}" != "${PERIOD_TAG}" ]; then
  cv_fail "Expected listed periodTag '${PERIOD_TAG}' got '${LISTED_PERIOD_TAG}'" $LINENO
fi
if [ "${LISTED_EXACT_START}" != "${EXACT_START_TIME}" ]; then
  cv_fail "Expected listed exactStartTimeLocal '${EXACT_START_TIME}' got '${LISTED_EXACT_START}'" $LINENO
fi
if [ "${LISTED_DURATION_MINUTES}" -ne "${DURATION_MINUTES}" ]; then
  cv_fail "Expected listed durationMinutes ${DURATION_MINUTES} got ${LISTED_DURATION_MINUTES}" $LINENO
fi
awk -v expected="${MILES_VALUE}" -v actual="${LISTED_MILES}" 'BEGIN {
  if (actual+0 != expected+0) {
    exit 1
  }
}' || cv_fail "Expected listed miles ${MILES_VALUE} got ${LISTED_MILES}" $LINENO

# Teardown
cv_step "Cleanup" "No explicit teardown required; case-local SQLite DB and user/preset rows are confined to this test run" $LINENO
# Files created by mktemp will be cleaned up automatically on container teardown.

echo "CODEVALID_TEST_ASSERTION_OK:create_preset_happy_path_authenticated_rider"
