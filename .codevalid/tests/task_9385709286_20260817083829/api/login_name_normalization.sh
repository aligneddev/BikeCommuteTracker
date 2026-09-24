#!/usr/bin/env bash
set -euo pipefail

source .codevalid/tests/task_9385709286_20260817083829/api/_infra.sh

cv_step "Given" "Create a new rider 'Alice Rider' via signup with PIN 1234" $LINENO

API_BASE="http://app:${PORT}"

# No external HTTP vendors are called during /api/users/signup or /api/users/identify.
# Throttle and credential checks are entirely local to the SQLite-backed database.
cv_step "Given" "No vendor mocks required for login_name_normalization" $LINENO

cv_prereq "Create a new rider 'Alice Rider' via signup with PIN 1234" $LINENO

# Signup request payload with mixed-case, trimmed name and valid numeric PIN.
signup_body='{"name":"Alice Rider","pin":"1234"}'

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="${signup_body}"
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

signup_hdrs_file="/tmp/signup_headers.$$"
signup_body_file="/tmp/signup_body.$$"

curl -sS -D "${signup_hdrs_file}" -o "${signup_body_file}" -w '%{http_code}' -X POST \
  "${API_BASE}/api/users/signup" \
  -H 'Content-Type: application/json' \
  -d "${signup_body}" > /tmp/signup_status.$$ || cv_fail "Signup request failed for Alice Rider" $LINENO

signup_status="$(cat /tmp/signup_status.$$)"
signup_json="$(cat "${signup_body_file}")"

printf 'RESPONSE_HEADERS
'
cat "${signup_hdrs_file}"
printf 'RESPONSE_BODY
%s
' "${signup_json}"

cv_http "POST" "/api/users/signup" "${signup_status}"

if [ "${signup_status}" != "201" ]; then
  cv_fail "Expected 201 from /api/users/signup, got ${signup_status} with body: ${signup_json}" $LINENO
fi

# Extract userId and userName from the signup success response.
user_id="$(jq -r '.userId' <<<"${signup_json}")"
user_name="$(jq -r '.userName' <<<"${signup_json}")"

if [ -z "${user_id}" ] || [ "${user_id}" = "null" ] || [ "${user_id}" -le 0 ] 2>/dev/null; then
  cv_fail "Signup response did not contain a valid positive userId: ${signup_json}" $LINENO
fi

if [ "${user_name}" != "Alice Rider" ]; then
  cv_fail "Expected userName 'Alice Rider' in signup response, got '${user_name}'" $LINENO
fi

cv_step "When" "Identify the rider using trimmed, lowercased name with surrounding spaces" $LINENO

# First identify attempt: name with leading/trailing spaces and all lowercase.
identify_body_spaced_lower='{"name":"  alice rider  ","pin":"1234"}'

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="${identify_body_spaced_lower}"
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

identify1_hdrs_file="/tmp/identify1_headers.$$"
identify1_body_file="/tmp/identify1_body.$$"

curl -sS -D "${identify1_hdrs_file}" -o "${identify1_body_file}" -w '%{http_code}' -X POST \
  "${API_BASE}/api/users/identify" \
  -H 'Content-Type: application/json' \
  -d "${identify_body_spaced_lower}" > /tmp/identify1_status.$$ || cv_fail "Identify request 1 failed" $LINENO

identify_status1="$(cat /tmp/identify1_status.$$)"
identify_json1="$(cat "${identify1_body_file}")"

printf 'RESPONSE_HEADERS
'
cat "${identify1_hdrs_file}"
printf 'RESPONSE_BODY
%s
' "${identify_json1}"

cv_http "POST" "/api/users/identify" "${identify_status1}"

cv_step "When" "Identify the rider using uppercase name without extra spaces" $LINENO

# Second identify attempt: same name, all uppercase, no extra spaces.
identify_body_upper='{"name":"ALICE RIDER","pin":"1234"}'

REQUEST_HEADERS="Content-Type: application/json"
REQUEST_BODY="${identify_body_upper}"
printf 'REQUEST_HEADERS
%s
' "${REQUEST_HEADERS}"
printf 'REQUEST_BODY
%s
' "${REQUEST_BODY}"

identify2_hdrs_file="/tmp/identify2_headers.$$"
identify2_body_file="/tmp/identify2_body.$$"

curl -sS -D "${identify2_hdrs_file}" -o "${identify2_body_file}" -w '%{http_code}' -X POST \
  "${API_BASE}/api/users/identify" \
  -H 'Content-Type: application/json' \
  -d "${identify_body_upper}" > /tmp/identify2_status.$$ || cv_fail "Identify request 2 failed" $LINENO

identify_status2="$(cat /tmp/identify2_status.$$)"
identify_json2="$(cat "${identify2_body_file}")"

printf 'RESPONSE_HEADERS
'
cat "${identify2_hdrs_file}"
printf 'RESPONSE_BODY
%s
' "${identify_json2}"

cv_http "POST" "/api/users/identify" "${identify_status2}"

cv_step "Then" "Both identify attempts succeed and return the same userId and original userName with authorized=true" $LINENO

# Assert first identify attempt succeeded with 200 OK.
if [ "${identify_status1}" != "200" ]; then
  cv_fail "Expected 200 from first /api/users/identify, got ${identify_status1} with body: ${identify_json1}" $LINENO
fi

user_id1="$(jq -r '.userId' <<<"${identify_json1}")"
user_name1="$(jq -r '.userName' <<<"${identify_json1}")"
authorized1="$(jq -r '.authorized' <<<"${identify_json1}")"

if [ "${user_id1}" != "${user_id}" ]; then
  cv_fail "First identify response userId '${user_id1}' does not match signup userId '${user_id}'" $LINENO
fi

if [ "${user_name1}" != "Alice Rider" ]; then
  cv_fail "First identify response userName expected 'Alice Rider', got '${user_name1}'" $LINENO
fi

if [ "${authorized1}" != "true" ]; then
  cv_fail "First identify response authorized expected true, got '${authorized1}'" $LINENO
fi

# Assert second identify attempt also succeeded with 200 OK.
if [ "${identify_status2}" != "200" ]; then
  cv_fail "Expected 200 from second /api/users/identify, got ${identify_status2} with body: ${identify_json2}" $LINENO
fi

user_id2="$(jq -r '.userId' <<<"${identify_json2}")"
user_name2="$(jq -r '.userName' <<<"${identify_json2}")"
authorized2="$(jq -r '.authorized' <<<"${identify_json2}")"

if [ "${user_id2}" != "${user_id}" ]; then
  cv_fail "Second identify response userId '${user_id2}' does not match signup userId '${user_id}'" $LINENO
fi

if [ "${user_name2}" != "Alice Rider" ]; then
  cv_fail "Second identify response userName expected 'Alice Rider', got '${user_name2}'" $LINENO
fi

if [ "${authorized2}" != "true" ]; then
  cv_fail "Second identify response authorized expected true, got '${authorized2}'" $LINENO
fi

cv_step "Cleanup" "No explicit teardown; user data remains in local SQLite for this isolated test run" $LINENO
# The database is scoped to the app container and test run; no DELETE endpoint exists for users.

echo "CODEVALID_TEST_ASSERTION_OK:login_name_normalization"
