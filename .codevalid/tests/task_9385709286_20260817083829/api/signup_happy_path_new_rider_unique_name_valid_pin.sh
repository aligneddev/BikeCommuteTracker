#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

cv_prereq "API container is healthy on /health and EF Core migrations have been applied" $LINENO

# Health check request
HEALTH_URL="http://app:6713/health"
echo "REQUEST_HEADERS: GET $HEALTH_URL" >&2
echo "REQUEST_BODY: (none)" >&2
health_response_with_status="$(
  curl -sS -D /tmp/health_headers.txt -o /tmp/health.json -w '
%{http_code}' "$HEALTH_URL" || true
)"
health_status_code="$(echo "$health_response_with_status" | tail -n1)"

echo "RESPONSE_HEADERS:" >&2
cat /tmp/health_headers.txt >&2 || true
echo "RESPONSE_BODY:" >&2
cat /tmp/health.json >&2 || true

cv_http "GET" "$HEALTH_URL" "$health_status_code"
if [ "$health_status_code" != "200" ]; then
  cv_fail "Expected health endpoint to return 200, got $health_status_code" $LINENO
fi

cv_step "Given" "Ensure no existing user with the normalized name key for this signup request" $LINENO

# Because SQLite is in-process inside the app container and there is no direct DB access from seed-test,
# we choose a display name that is extremely unlikely to exist already and use a UUID suffix.
unique_suffix="$(cat /proc/sys/kernel/random/uuid | cut -c1-8)"
signup_name="  Alice Rider ${unique_suffix}  "
signup_pin="1234"  # 4-digit numeric PIN satisfying the documented PIN policy

echo "Using signup name: '${signup_name}'" >&2
echo "Using signup PIN: '${signup_pin}'" >&2

cv_step "When" "POST /api/users/signup with trimmed, non-empty, unique name and valid PIN" $LINENO

signup_payload="$(jq -n --arg name "$signup_name" --arg pin "$signup_pin" '{name: $name, pin: $pin}')"

SIGNUP_URL="http://app:6713/api/users/signup"
echo "REQUEST_HEADERS: POST $SIGNUP_URL" >&2
echo "  Content-Type: application/json" >&2
echo "REQUEST_BODY:" >&2
echo "$signup_payload" >&2

signup_response_with_status="$(
  curl -sS -D /tmp/signup_headers.txt -o /tmp/signup_response.json -w '
%{http_code}' \
    -X POST "$SIGNUP_URL" \
    -H "Content-Type: application/json" \
    -d "$signup_payload" || true
)"
signup_status_code="$(echo "$signup_response_with_status" | tail -n1)"

echo "RESPONSE_HEADERS:" >&2
cat /tmp/signup_headers.txt >&2 || true
echo "RESPONSE_BODY:" >&2
cat /tmp/signup_response.json >&2 || true

cv_http "POST" "$SIGNUP_URL" "$signup_status_code"

cv_step "Then" "Verify 201 Created and SignupSuccessResponse with queued/published event status" $LINENO

if [ "$signup_status_code" != "201" ]; then
  body="$(cat /tmp/signup_response.json 2>/dev/null || echo '')"
  cv_fail "Expected 201 Created from /api/users/signup, got ${signup_status_code}. Body: ${body}" $LINENO
fi

# Parse response
signup_user_id="$(jq -r '.userId // empty' /tmp/signup_response.json)"
signup_user_name="$(jq -r '.userName // empty' /tmp/signup_response.json)"
signup_created_at="$(jq -r '.createdAtUtc // empty' /tmp/signup_response.json)"
signup_event_status="$(jq -r '.eventStatus // empty' /tmp/signup_response.json)"

# Assert required fields are present
if [ -z "$signup_user_id" ] || [ "$signup_user_id" = "null" ]; then
  cv_fail "Signup response missing userId" $LINENO
fi
if ! printf '%s\n' "$signup_user_id" | grep -Eq '^[0-9]+$'; then
  cv_fail "Signup response userId is not a number: '$signup_user_id'" $LINENO
fi
if [ "$signup_user_id" -le 0 ] 2>/dev/null; then
  cv_fail "Signup response userId must be positive, got '$signup_user_id'" $LINENO
fi

if [ -z "$signup_user_name" ] || [ "$signup_user_name" = "null" ]; then
  cv_fail "Signup response missing userName" $LINENO
fi

# The API applies UserNameNormalizer.CanonicalDisplayName to the trimmed input.
trimmed_name="$(printf '%s' "$signup_name" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
# We expect the canonical display name to preserve the trimmed content; the UUID suffix
# makes it unique, so equality with the trimmed input is a strong signal.
if [ "$signup_user_name" != "$trimmed_name" ]; then
  cv_fail "Expected userName '$signup_user_name' to equal trimmed display name '$trimmed_name'" $LINENO
fi

if [ -z "$signup_created_at" ] || [ "$signup_created_at" = "null" ]; then
  cv_fail "Signup response missing createdAtUtc" $LINENO
fi
# Basic ISO-8601 shape check: contains 'T' separator.
if ! printf '%s\n' "$signup_created_at" | grep -q 'T'; then
  cv_fail "Signup createdAtUtc is not an ISO-8601 timestamp: '$signup_created_at'" $LINENO
fi

if [ -z "$signup_event_status" ] || [ "$signup_event_status" = "null" ]; then
  cv_fail "Signup response missing eventStatus" $LINENO
fi

# Business requirement: eventStatus should reflect that a user-registered outbox event
# has been queued or published (e.g., "queued" or "published").
if [ "$signup_event_status" != "queued" ] && [ "$signup_event_status" != "published" ]; then
  cv_fail "Expected eventStatus to be 'queued' or 'published' to reflect outbox event emission, got '$signup_event_status'" $LINENO
fi

cv_step "Cleanup" "No explicit cleanup; user row remains for subsequent tests or manual inspection" $LINENO

# With SQLite in-process and no DELETE endpoint for users, we leave the created user in place.
# Future tests should choose distinct, UUID-suffixed names to avoid collisions.

echo "CODEVALID_TEST_ASSERTION_OK:signup_happy_path_new_rider_unique_name_valid_pin"