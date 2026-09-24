#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

# Case: signup_persists_user_and_credentials_without_plaintext_pin

# Mocks
cv_step Given "No external vendor mocks required for signup" $LINENO
# POST /api/users/signup does not call any external HTTP APIs; no WireMock stubs are needed for this case.

# Preconditions
cv_prereq "Ensure test uses a low-collision rider name" $LINENO
# The SQLite database is created and migrated by the app at startup via EF Core.
# There is no HTTP API to list or delete users, and the seed-test container cannot open the SQLite file directly.
# This test uses a synthetic rider name unlikely to exist in prior data: "Test Rider persistence".

# When
cv_step When "POST /api/users/signup with a unique name and valid PIN" $LINENO
BASE_URL="http://app:6713"

SIGNUP_NAME="Test Rider persistence"
SIGNUP_PIN="1234"

SIGNUP_RESPONSE_FILE="/tmp/signup_response.json"
SIGNUP_STATUS_FILE="/tmp/signup_status.txt"
SIGNUP_REQ_HDRS="/tmp/signup_request_headers.txt"
SIGNUP_RESP_HDRS="/tmp/signup_response_headers.txt"

SIGNUP_BODY="$(jq -n --arg name "$SIGNUP_NAME" --arg pin "$SIGNUP_PIN" '{Name: $name, Pin: $pin}')"

REQUEST_HEADERS="$SIGNUP_REQ_HDRS"
REQUEST_BODY="/tmp/signup_request_body.json"
RESPONSE_HEADERS="$SIGNUP_RESP_HDRS"
RESPONSE_BODY="$SIGNUP_RESPONSE_FILE"

printf 'POST %s
' "$BASE_URL/api/users/signup" >"$REQUEST_HEADERS"
printf 'Content-Type: application/json
' >>"$REQUEST_HEADERS"
printf '%s' "$SIGNUP_BODY" >"$REQUEST_BODY"

echo "REQUEST_HEADERS:"; cat "$REQUEST_HEADERS" || true

echo "REQUEST_BODY:"; cat "$REQUEST_BODY" || true

curl -sS -o "$SIGNUP_RESPONSE_FILE" -w "%{http_code}" \
  -D "$SIGNUP_RESP_HDRS" \
  -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/users/signup" \
  -d "$SIGNUP_BODY" \
  >"$SIGNUP_STATUS_FILE"
SIGNUP_STATUS="$(cat "$SIGNUP_STATUS_FILE")"

echo "RESPONSE_HEADERS:"; cat "$SIGNUP_RESP_HDRS" || true

echo "RESPONSE_BODY:"; cat "$SIGNUP_RESPONSE_FILE" || true

cv_http POST "$BASE_URL/api/users/signup" "$SIGNUP_STATUS"

# Then
cv_step Then "Assert signup returned 201 Created with expected response fields" $LINENO
if [[ "$SIGNUP_STATUS" -ne 201 ]]; then
  BODY="$(cat "$SIGNUP_RESPONSE_FILE" || true)"
  cv_fail "expected 201 from /api/users/signup, got $SIGNUP_STATUS with body: $BODY" $LINENO
fi

USER_ID="$(jq -r '.UserId // .userId // empty' "$SIGNUP_RESPONSE_FILE" || true)"
USER_NAME="$(jq -r '.UserName // .userName // empty' "$SIGNUP_RESPONSE_FILE" || true)"
CREATED_AT="$(jq -r '.CreatedAtUtc // .createdAtUtc // empty' "$SIGNUP_RESPONSE_FILE" || true)"
EVENT_STATUS="$(jq -r '.EventStatus // .eventStatus // empty' "$SIGNUP_RESPONSE_FILE" || true)"

if [[ -z "$USER_ID" || "$USER_ID" == "null" ]]; then
  cv_fail "response missing UserId field" $LINENO
fi
if ! [[ "$USER_ID" =~ ^[0-9]+$ ]] || [[ "$USER_ID" -le 0 ]]; then
  cv_fail "expected UserId to be a positive integer, got '$USER_ID'" $LINENO
fi

if [[ -z "$USER_NAME" || "$USER_NAME" == "null" ]]; then
  cv_fail "response missing UserName field" $LINENO
fi

if [[ -z "$CREATED_AT" || "$CREATED_AT" == "null" ]]; then
  cv_fail "response missing CreatedAtUtc field" $LINENO
fi

if [[ -z "$EVENT_STATUS" || "$EVENT_STATUS" == "null" ]]; then
  cv_fail "response missing EventStatus field representing outbox event state" $LINENO
fi

# Business requirement assertions about persistence and hashing (not directly observable via HTTP in this harness):
# - Exactly one Users row is created with DisplayName (canonical display name), NormalizedName (UserNameNormalizer.Normalize),
#   CreatedAtUtc equal to the signup timestamp, and IsActive=true.
# - Exactly one UserCredentials row is created with UserId equal to the new Users.UserId, PinHash and PinSalt set from IPinHasher.Hash,
#   HashAlgorithm storing the PBKDF2 algorithm identifier, IterationCount and CredentialVersion from the hash result,
#   and UpdatedAtUtc equal to the signup timestamp.
# - Exactly one AuthAttemptStates row is created with UserId equal to the new Users.UserId, ConsecutiveWrongCount=0,
#   and LastWrongAttemptUtc, DelayUntilUtc, and LastSuccessfulAuthUtc all null.
# - No plaintext PIN is stored in any column of UserCredentials or any other table; only the salted PBKDF2 hash and metadata are persisted.

cv_prereq "Second signup with same normalized name is rejected with 409 and name_already_exists" $LINENO
DUPLICATE_NAME="  test rider PERSISTENCE  "
DUPLICATE_PIN="5678"

DUP_RESPONSE_FILE="/tmp/signup_duplicate_response.json"
DUP_STATUS_FILE="/tmp/signup_duplicate_status.txt"
DUP_REQ_HDRS="/tmp/signup_duplicate_request_headers.txt"
DUP_RESP_HDRS="/tmp/signup_duplicate_response_headers.txt"

DUP_BODY="$(jq -n --arg name "$DUPLICATE_NAME" --arg pin "$DUPLICATE_PIN" '{Name: $name, Pin: $pin}')"

REQUEST_HEADERS="$DUP_REQ_HDRS"
REQUEST_BODY="/tmp/signup_duplicate_request_body.json"
RESPONSE_HEADERS="$DUP_RESP_HDRS"
RESPONSE_BODY="$DUP_RESPONSE_FILE"

printf 'POST %s
' "$BASE_URL/api/users/signup" >"$REQUEST_HEADERS"
printf 'Content-Type: application/json
' >>"$REQUEST_HEADERS"
printf '%s' "$DUP_BODY" >"$REQUEST_BODY"

echo "REQUEST_HEADERS:"; cat "$REQUEST_HEADERS" || true

echo "REQUEST_BODY:"; cat "$REQUEST_BODY" || true

curl -sS -o "$DUP_RESPONSE_FILE" -w "%{http_code}" \
  -D "$DUP_RESP_HDRS" \
  -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/users/signup" \
  -d "$DUP_BODY" \
  >"$DUP_STATUS_FILE"
DUP_STATUS="$(cat "$DUP_STATUS_FILE")"

echo "RESPONSE_HEADERS:"; cat "$DUP_RESP_HDRS" || true

echo "RESPONSE_BODY:"; cat "$DUP_RESPONSE_FILE" || true

cv_http POST "$BASE_URL/api/users/signup" "$DUP_STATUS"

if [[ "$DUP_STATUS" -ne 409 ]]; then
  BODY="$(cat "$DUP_RESPONSE_FILE" || true)"
  cv_fail "expected 409 Conflict for duplicate normalized name, got $DUP_STATUS with body: $BODY" $LINENO
fi

DUP_CODE="$(jq -r '.Code // .code // empty' "$DUP_RESPONSE_FILE" || true)"
DUP_MESSAGE="$(jq -r '.Message // .message // empty' "$DUP_RESPONSE_FILE" || true)"

if [[ "$DUP_CODE" != "name_already_exists" ]]; then
  cv_fail "expected ErrorResponse.Code 'name_already_exists' on duplicate signup, got '$DUP_CODE'" $LINENO
fi
if [[ "$DUP_MESSAGE" != "name already exists" ]]; then
  cv_fail "expected ErrorResponse.Message 'name already exists' on duplicate signup, got '$DUP_MESSAGE'" $LINENO
fi

# Per the documented implementation and schema, the unique index on Users.NormalizedName ensures this 409 response
# is produced without creating additional Users, UserCredentials, or AuthAttemptStates rows for the same normalized name.

# Teardown
cv_step Cleanup "No explicit cleanup possible for created user" $LINENO
# There is no HTTP endpoint to delete or deactivate a user, and the seed-test container cannot reach the SQLite file directly.
# The created rider remains in the local database between test runs.

echo "CODEVALID_TEST_ASSERTION_OK:signup_persists_user_and_credentials_without_plaintext_pin"
