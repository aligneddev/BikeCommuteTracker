#!/usr/bin/env bash
set -euo pipefail

# Source shared infra
source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

# Case: login_fail_unknown_name

# -------------------------
# Mocks / External deps
# -------------------------
cv_step "Given" "No external HTTP vendors are involved in /api/users/identify, so no per-case WireMock stubs are required" $LINENO
# IdentifyService.IdentifyAsync only uses BikeTrackingDbContext (SQLite) and the
# IPinHasher to validate credentials and apply throttle state. It does not call
# any external HTTP services such as gas price or weather APIs.
# The shared WireMock boot-health mapping at .codevalid/wiremock/mappings/shared/boot-health.json
# is already loaded by default and is sufficient for this case.

# -------------------------
# Preconditions
# -------------------------
cv_step "Given" "No rider exists with the normalized name of the attempted login" $LINENO
cv_prereq "Ensure no user signup API is called before identify so the Users and UserCredentials tables have no matching user" $LINENO
# EF Core SQLite is in-process inside the app container; seed-test cannot reach
# the database directly and must express Given state via HTTP endpoints.
# For this case we rely on the default empty database: we do NOT call
# POST /api/users/signup or any other endpoint that creates a UserEntity.
# IdentifyService queries:
#   dbContext.Users
#     .Include(x => x.Credential)
#     .Include(x => x.AuthAttemptState)
#     .SingleOrDefaultAsync(x => x.NormalizedName == normalizedName)
# with normalizedName = UserNameNormalizer.Normalize(request.Name).
# With no prior signup, there is no UserEntity or UserCredentialEntity whose
# NormalizedName equals the normalized form of "Unknown Rider".

API_BASE="http://app:${PORT}"
REQUEST_BODY='{"name":"Unknown Rider","pin":"1234"}'

# -------------------------
# When: call identify
# -------------------------
cv_step "When" "Call POST /api/users/identify with an unknown normalized name and a valid-format PIN" $LINENO

# Make request observable
REQUEST_HEADERS="Content-Type: application/json"
echo "REQUEST_HEADERS: ${REQUEST_HEADERS}"
echo "REQUEST_BODY: ${REQUEST_BODY}"

HEADER_FILE="/tmp/login_fail_unknown_name_headers.txt"
BODY_FILE="/tmp/login_fail_unknown_name_body.json"

HTTP_STATUS_AND_HEADERS=$(curl -sS \
  -D "${HEADER_FILE}" \
  -o "${BODY_FILE}" \
  -w "%{http_code}" \
  -H "${REQUEST_HEADERS}" \
  -X POST \
  --data "${REQUEST_BODY}" \
  "${API_BASE}/api/users/identify") || cv_fail "curl to /api/users/identify failed" $LINENO

STATUS_CODE="${HTTP_STATUS_AND_HEADERS}"
cv_http "POST" "/api/users/identify" "${STATUS_CODE}"

echo "RESPONSE_HEADERS:"
cat "${HEADER_FILE}"
echo "RESPONSE_BODY:"
cat "${BODY_FILE}"

# -------------------------
# Then: assertions
# -------------------------
cv_step "Then" "API denies authorization and returns a clear, user-friendly error without revealing whether the name exists" $LINENO

EXPECTED_STATUS=401
if [[ "${STATUS_CODE}" -ne "${EXPECTED_STATUS}" ]]; then
  cv_fail "expected HTTP ${EXPECTED_STATUS} for unknown user identify, got ${STATUS_CODE}" $LINENO
fi

# The business requirement specifies that when the normalized name is not found
# or the PIN is incorrect, the login must be denied and a clear, user-friendly
# error message must be returned that does not reveal whether the name exists.
# IdentifyResult.Unauthorized() constructs:
#   new ErrorResponse(UsersErrorCodes.InvalidCredentials, "Invalid name or PIN.")
# and the endpoint should surface this ErrorResponse in the 401 response.

if ! jq . >/dev/null 2>&1 <"${BODY_FILE}"; then
  cv_fail "expected JSON error body for unauthorized identify response" $LINENO
fi

ERROR_CODE=$(jq -r '.code // empty' <"${BODY_FILE}")
ERROR_MESSAGE=$(jq -r '.message // empty' <"${BODY_FILE}")

if [[ "${ERROR_CODE}" != "invalid_credentials" ]]; then
  cv_fail "expected error code 'invalid_credentials' for unknown user, got '${ERROR_CODE}'" $LINENO
fi

if [[ "${ERROR_MESSAGE}" != "Invalid name or PIN." ]]; then
  cv_fail "expected error message 'Invalid name or PIN.' for unknown user, got '${ERROR_MESSAGE}" $LINENO
fi

# The identify endpoint itself does not create server-side sessions or emit
# authentication cookies. The frontend manages a client-side session only when
# it receives IdentifySuccessResponse { userId, userName, authorized: true }.
# Because this call returned an ErrorResponse with invalid_credentials, no
# IdentifySuccessResponse is present and the client cannot establish an
# authenticated rider session from this response.

# -------------------------
# Cleanup
# -------------------------
cv_step "Cleanup" "No cleanup required for login_fail_unknown_name; no persistent state was created" $LINENO
# The request used an unknown name against an empty database and IdentifyService
# does not create any entities when the user is not found. There is therefore
# nothing to clean up for this case.

# Success marker required by runner
echo "CODEVALID_TEST_ASSERTION_OK:login_fail_unknown_name"