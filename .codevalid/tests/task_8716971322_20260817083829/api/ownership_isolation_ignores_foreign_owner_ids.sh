#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_8716971322_20260817083829/api/_infra.sh

# Case: ownership_isolation_ignores_foreign_owner_ids

# Mocks
cv_step "Given" "No vendor stubs required for preset creation; endpoint only touches local SQLite via EF Core" $LINENO
# This case does not call EIA or Open-Meteo. No WireMock mappings are needed.

# Preconditions
cv_prereq "Sign up two riders and verify the API is healthy before creating presets" $LINENO
API_BASE="http://app:${PORT}"

cv_prereq "Health check on /health endpoint" $LINENO
HEALTH_STATUS_FILE="$(mktemp)"
HEALTH_HDRS_FILE="$(mktemp)"
curl -sS -D "${HEALTH_HDRS_FILE}" -o /dev/null -w '%{http_code}' "${API_BASE}/health" >"${HEALTH_STATUS_FILE}" || cv_fail "Health check request failed" $LINENO
HEALTH_STATUS="$(cat "${HEALTH_STATUS_FILE}")"
echo "REQUEST_HEADERS: GET ${API_BASE}/health (no body)"
echo "RESPONSE_HEADERS:"; cat "${HEALTH_HDRS_FILE}"
cv_http "GET" "/health" "${HEALTH_STATUS}"
rm -f "${HEALTH_STATUS_FILE}" "${HEALTH_HDRS_FILE}"
[ "${HEALTH_STATUS}" -eq 200 ] || cv_fail "Expected 200 from /health, got ${HEALTH_STATUS}" $LINENO

cv_prereq "Signup Rider A via POST /api/users/signup" $LINENO
RIDER_A_NAME="PresetOwnerA-$(date +%s)"
SIGNUP_A_BODY="$(mktemp)"
cat >"${SIGNUP_A_BODY}" <<JSON
{
  "name": "${RIDER_A_NAME}",
  "pin": "1234"
}
JSON

echo "REQUEST_HEADERS: POST ${API_BASE}/api/users/signup"
echo "REQUEST_BODY:"; cat "${SIGNUP_A_BODY}"

SIGNUP_A_RESP_FILE="$(mktemp)"
SIGNUP_A_STATUS_FILE="$(mktemp)"
SIGNUP_A_HDRS_FILE="$(mktemp)"
curl -sS -D "${SIGNUP_A_HDRS_FILE}" -o "${SIGNUP_A_RESP_FILE}" -w '%{http_code}' \
  -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_A_BODY}" >"${SIGNUP_A_STATUS_FILE}" || cv_fail "Signup Rider A request failed" $LINENO
SIGNUP_A_STATUS="$(cat "${SIGNUP_A_STATUS_FILE}")"
echo "RESPONSE_HEADERS:"; cat "${SIGNUP_A_HDRS_FILE}"
echo "RESPONSE_BODY:"; cat "${SIGNUP_A_RESP_FILE}"
cv_http "POST" "/api/users/signup" "${SIGNUP_A_STATUS}"
[ "${SIGNUP_A_STATUS}" -eq 201 ] || cv_fail "Expected 201 from signup for Rider A, got ${SIGNUP_A_STATUS}" $LINENO
RIDER_A_ID="$(jq -r '.userId' <"${SIGNUP_A_RESP_FILE}")"
[ -n "${RIDER_A_ID}" ] && [ "${RIDER_A_ID}" != "null" ] || cv_fail "Failed to extract Rider A userId from signup response" $LINENO
rm -f "${SIGNUP_A_BODY}" "${SIGNUP_A_RESP_FILE}" "${SIGNUP_A_STATUS_FILE}" "${SIGNUP_A_HDRS_FILE}"

cv_prereq "Signup Rider B via POST /api/users/signup" $LINENO
RIDER_B_NAME="PresetOwnerB-$(date +%s)"
SIGNUP_B_BODY="$(mktemp)"
cat >"${SIGNUP_B_BODY}" <<JSON
{
  "name": "${RIDER_B_NAME}",
  "pin": "5678"
}
JSON

echo "REQUEST_HEADERS: POST ${API_BASE}/api/users/signup"
echo "REQUEST_BODY:"; cat "${SIGNUP_B_BODY}"

SIGNUP_B_RESP_FILE="$(mktemp)"
SIGNUP_B_STATUS_FILE="$(mktemp)"
SIGNUP_B_HDRS_FILE="$(mktemp)"
curl -sS -D "${SIGNUP_B_HDRS_FILE}" -o "${SIGNUP_B_RESP_FILE}" -w '%{http_code}' \
  -X POST "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  --data-binary @"${SIGNUP_B_BODY}" >"${SIGNUP_B_STATUS_FILE}" || cv_fail "Signup Rider B request failed" $LINENO
SIGNUP_B_STATUS="$(cat "${SIGNUP_B_STATUS_FILE}")"
echo "RESPONSE_HEADERS:"; cat "${SIGNUP_B_HDRS_FILE}"
echo "RESPONSE_BODY:"; cat "${SIGNUP_B_RESP_FILE}"
cv_http "POST" "/api/users/signup" "${SIGNUP_B_STATUS}"
[ "${SIGNUP_B_STATUS}" -eq 201 ] || cv_fail "Expected 201 from signup for Rider B, got ${SIGNUP_B_STATUS}" $LINENO
RIDER_B_ID="$(jq -r '.userId' <"${SIGNUP_B_RESP_FILE}")"
[ -n "${RIDER_B_ID}" ] && [ "${RIDER_B_ID}" != "null" ] || cv_fail "Failed to extract Rider B userId from signup response" $LINENO
rm -f "${SIGNUP_B_BODY}" "${SIGNUP_B_RESP_FILE}" "${SIGNUP_B_STATUS_FILE}" "${SIGNUP_B_HDRS_FILE}"

cv_prereq "Ensure both riders initially have no presets via GET /api/rides/presets" $LINENO
PRESETS_A_RESP_FILE_INIT="$(mktemp)"
PRESETS_A_STATUS_FILE_INIT="$(mktemp)"
PRESETS_A_HDRS_FILE_INIT="$(mktemp)"
echo "REQUEST_HEADERS: GET ${API_BASE}/api/rides/presets"
echo "REQUEST_BODY: (none)"
curl -sS -D "${PRESETS_A_HDRS_FILE_INIT}" -o "${PRESETS_A_RESP_FILE_INIT}" -w '%{http_code}' \
  -X GET "${API_BASE}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_A_ID}" >"${PRESETS_A_STATUS_FILE_INIT}" || cv_fail "Initial presets list for Rider A failed" $LINENO
PRESETS_A_STATUS_INIT="$(cat "${PRESETS_A_STATUS_FILE_INIT}")"
echo "RESPONSE_HEADERS:"; cat "${PRESETS_A_HDRS_FILE_INIT}"
echo "RESPONSE_BODY:"; cat "${PRESETS_A_RESP_FILE_INIT}"
cv_http "GET" "/api/rides/presets" "${PRESETS_A_STATUS_INIT}"
[ "${PRESETS_A_STATUS_INIT}" -eq 200 ] || cv_fail "Expected 200 from initial presets list for Rider A, got ${PRESETS_A_STATUS_INIT}" $LINENO
PRESETS_A_COUNT_INIT="$(jq '.presets | length' <"${PRESETS_A_RESP_FILE_INIT}")"
rm -f "${PRESETS_A_RESP_FILE_INIT}" "${PRESETS_A_STATUS_FILE_INIT}" "${PRESETS_A_HDRS_FILE_INIT}"

PRESETS_B_RESP_FILE_INIT="$(mktemp)"
PRESETS_B_STATUS_FILE_INIT="$(mktemp)"
PRESETS_B_HDRS_FILE_INIT="$(mktemp)"
echo "REQUEST_HEADERS: GET ${API_BASE}/api/rides/presets"
echo "REQUEST_BODY: (none)"
curl -sS -D "${PRESETS_B_HDRS_FILE_INIT}" -o "${PRESETS_B_RESP_FILE_INIT}" -w '%{http_code}' \
  -X GET "${API_BASE}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_B_ID}" >"${PRESETS_B_STATUS_FILE_INIT}" || cv_fail "Initial presets list for Rider B failed" $LINENO
PRESETS_B_STATUS_INIT="$(cat "${PRESETS_B_STATUS_FILE_INIT}")"
echo "RESPONSE_HEADERS:"; cat "${PRESETS_B_HDRS_FILE_INIT}"
echo "RESPONSE_BODY:"; cat "${PRESETS_B_RESP_FILE_INIT}"
cv_http "GET" "/api/rides/presets" "${PRESETS_B_STATUS_INIT}"
[ "${PRESETS_B_STATUS_INIT}" -eq 200 ] || cv_fail "Expected 200 from initial presets list for Rider B, got ${PRESETS_B_STATUS_INIT}" $LINENO
PRESETS_B_COUNT_INIT="$(jq '.presets | length' <"${PRESETS_B_RESP_FILE_INIT}")"
rm -f "${PRESETS_B_RESP_FILE_INIT}" "${PRESETS_B_STATUS_FILE_INIT}" "${PRESETS_B_HDRS_FILE_INIT}"

# When
cv_step "When" "Authenticated Rider B creates a ride preset via POST /api/rides/presets" $LINENO

cv_prereq "Authenticated Rider B creates a ride preset via POST /api/rides/presets" $LINENO
PRESET_NAME="OwnershipIsolation-$(date +%s)"
CREATE_PRESET_BODY_FILE="$(mktemp)"
cat >"${CREATE_PRESET_BODY_FILE}" <<JSON
{
  "name": "${PRESET_NAME}",
  "primaryDirection": "SW",
  "periodTag": "morning",
  "exactStartTimeLocal": "07:45",
  "durationMinutes": 30,
  "miles": 6.5
}
JSON

echo "REQUEST_HEADERS: POST ${API_BASE}/api/rides/presets"
echo "REQUEST_BODY:"; cat "${CREATE_PRESET_BODY_FILE}"

CREATE_PRESET_RESP_FILE="$(mktemp)"
CREATE_PRESET_STATUS_FILE="$(mktemp)"
CREATE_PRESET_HDRS_FILE="$(mktemp)"
curl -sS -D "${CREATE_PRESET_HDRS_FILE}" -o "${CREATE_PRESET_RESP_FILE}" -w '%{http_code}' \
  -X POST "${API_BASE}/api/rides/presets" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: ${RIDER_B_ID}" \
  --data-binary @"${CREATE_PRESET_BODY_FILE}" >"${CREATE_PRESET_STATUS_FILE}" || cv_fail "Create preset request for Rider B failed" $LINENO
CREATE_PRESET_STATUS="$(cat "${CREATE_PRESET_STATUS_FILE}")"
echo "RESPONSE_HEADERS:"; cat "${CREATE_PRESET_HDRS_FILE}"
echo "RESPONSE_BODY:"; cat "${CREATE_PRESET_RESP_FILE}"
cv_http "POST" "/api/rides/presets" "${CREATE_PRESET_STATUS}"
[ "${CREATE_PRESET_STATUS}" -eq 201 ] || cv_fail "Expected 201 from POST /api/rides/presets for Rider B, got ${CREATE_PRESET_STATUS}" $LINENO

CREATED_PRESET_ID="$(jq -r '.presetId' <"${CREATE_PRESET_RESP_FILE}")"
CREATED_PRESET_NAME="$(jq -r '.name' <"${CREATE_PRESET_RESP_FILE}")"
[ -n "${CREATED_PRESET_ID}" ] && [ "${CREATED_PRESET_ID}" != "null" ] || cv_fail "Failed to extract presetId from create response" $LINENO
[ "${CREATED_PRESET_NAME}" = "${PRESET_NAME}" ] || cv_fail "Expected created preset name ${PRESET_NAME}, got ${CREATED_PRESET_NAME}" $LINENO
rm -f "${CREATE_PRESET_BODY_FILE}" "${CREATE_PRESET_RESP_FILE}" "${CREATE_PRESET_STATUS_FILE}" "${CREATE_PRESET_HDRS_FILE}"

cv_prereq "Fetch presets for both riders after creation using Rider B's authenticated session" $LINENO
PRESETS_B_RESP_FILE="$(mktemp)"
PRESETS_B_STATUS_FILE="$(mktemp)"
PRESETS_B_HDRS_FILE="$(mktemp)"
echo "REQUEST_HEADERS: GET ${API_BASE}/api/rides/presets"
echo "REQUEST_BODY: (none)"
curl -sS -D "${PRESETS_B_HDRS_FILE}" -o "${PRESETS_B_RESP_FILE}" -w '%{http_code}' \
  -X GET "${API_BASE}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_B_ID}" >"${PRESETS_B_STATUS_FILE}" || cv_fail "Presets list for Rider B after creation failed" $LINENO
PRESETS_B_STATUS="$(cat "${PRESETS_B_STATUS_FILE}")"
echo "RESPONSE_HEADERS:"; cat "${PRESETS_B_HDRS_FILE}"
echo "RESPONSE_BODY:"; cat "${PRESETS_B_RESP_FILE}"
cv_http "GET" "/api/rides/presets" "${PRESETS_B_STATUS}"
[ "${PRESETS_B_STATUS}" -eq 200 ] || cv_fail "Expected 200 from presets list for Rider B after creation, got ${PRESETS_B_STATUS}" $LINENO

PRESETS_A_RESP_FILE="$(mktemp)"
PRESETS_A_STATUS_FILE="$(mktemp)"
PRESETS_A_HDRS_FILE="$(mktemp)"
echo "REQUEST_HEADERS: GET ${API_BASE}/api/rides/presets"
echo "REQUEST_BODY: (none)"
curl -sS -D "${PRESETS_A_HDRS_FILE}" -o "${PRESETS_A_RESP_FILE}" -w '%{http_code}' \
  -X GET "${API_BASE}/api/rides/presets" \
  -H "X-User-Id: ${RIDER_A_ID}" >"${PRESETS_A_STATUS_FILE}" || cv_fail "Presets list for Rider A after creation failed" $LINENO
PRESETS_A_STATUS="$(cat "${PRESETS_A_STATUS_FILE}")"
echo "RESPONSE_HEADERS:"; cat "${PRESETS_A_HDRS_FILE}"
echo "RESPONSE_BODY:"; cat "${PRESETS_A_RESP_FILE}"
cv_http "GET" "/api/rides/presets" "${PRESETS_A_STATUS}"
[ "${PRESETS_A_STATUS}" -eq 200 ] || cv_fail "Expected 200 from presets list for Rider A after creation, got ${PRESETS_A_STATUS}" $LINENO

# Then
cv_step "Then" "Assert preset is owned by Rider B only and not visible under Rider A" $LINENO
PRESETS_B_COUNT_AFTER="$(jq '.presets | length' <"${PRESETS_B_RESP_FILE}")"
[ "${PRESETS_B_COUNT_AFTER}" -eq $((PRESETS_B_COUNT_INIT + 1)) ] || cv_fail "Expected Rider B presets count to increase by 1 (from ${PRESETS_B_COUNT_INIT} to $((PRESETS_B_COUNT_INIT + 1))), got ${PRESETS_B_COUNT_AFTER}" $LINENO

# Verify the created presetId appears in Rider B's presets list with matching name
MATCH_B="$(jq --arg id "${CREATED_PRESET_ID}" --arg name "${PRESET_NAME}" \
  '.presets[] | select((.presetId | tostring) == $id and .name == $name)' <"${PRESETS_B_RESP_FILE}")"
[ -n "${MATCH_B}" ] || cv_fail "Created presetId ${CREATED_PRESET_ID} with name ${PRESET_NAME} not found in Rider B presets list" $LINENO

# Verify Rider A's presets list has not gained this presetId
PRESETS_A_COUNT_AFTER="$(jq '.presets | length' <"${PRESETS_A_RESP_FILE}")"
[ "${PRESETS_A_COUNT_AFTER}" -eq "${PRESETS_A_COUNT_INIT}" ] || cv_fail "Expected Rider A presets count to remain ${PRESETS_A_COUNT_INIT}, got ${PRESETS_A_COUNT_AFTER}" $LINENO

MATCH_A="$(jq --arg id "${CREATED_PRESET_ID}" '.presets[] | select((.presetId | tostring) == $id)' <"${PRESETS_A_RESP_FILE}")"
[ -z "${MATCH_A}" ] || cv_fail "PresetId ${CREATED_PRESET_ID} unexpectedly present in Rider A presets list, ownership isolation violated" $LINENO

rm -f "${PRESETS_B_RESP_FILE}" "${PRESETS_B_STATUS_FILE}" "${PRESETS_B_HDRS_FILE}" "${PRESETS_A_RESP_FILE}" "${PRESETS_A_STATUS_FILE}" "${PRESETS_A_HDRS_FILE}"

# Teardown
cv_step "Cleanup" "No explicit teardown; riders and presets remain in SQLite DB for this isolated case" $LINENO
# SQLite DB is per-container and ephemeral for tests; no additional cleanup is required.

echo "CODEVALID_TEST_ASSERTION_OK:ownership_isolation_ignores_foreign_owner_ids"
