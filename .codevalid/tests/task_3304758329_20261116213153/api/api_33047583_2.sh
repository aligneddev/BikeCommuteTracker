#!/usr/bin/env bash
set -euo pipefail
source "${CODEVALID_ROOT:-.}/.codevalid/lib/cv.sh"

BASE_URL="${BASE_URL:-http://app:6713}"
SUFFIX="$(date +%s%N)"
RIDER_NAME="preset-rider-${SUFFIX}"
RIDER_PIN="4826"
PRESET_ID=""
USER_ID=""

# Given
cv_step Given "register and identify a rider" $LINENO
cv_prereq "sign up rider ${RIDER_NAME}" $LINENO
cv_http POST /api/users/signup "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
if [ "$CV_HTTP_STATUS" != "201" ]; then
  cv_fail "expected signup 201 got ${CV_HTTP_STATUS}" $LINENO
fi
cv_prereq "identify rider" $LINENO
cv_http POST /api/users/identify "{\"name\":\"${RIDER_NAME}\",\"pin\":\"${RIDER_PIN}\"}"
if [ "$CV_HTTP_STATUS" != "200" ]; then
  cv_fail "expected identify 200 got ${CV_HTTP_STATUS}" $LINENO
fi
USER_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.userId // empty')"
if [ -z "$USER_ID" ]; then
  cv_fail "expected userId in identify response got ${CV_HTTP_BODY}" $LINENO
fi
AUTH=(-H "X-User-Id: ${USER_ID}")

# When
cv_step When "create preset 'Commute AM' (morning, SW, 07:30, 40 min, 12.5 mi)" $LINENO
cv_http POST /api/rides/presets '{"name":"Commute AM","primaryDirection":"SW","periodTag":"morning","exactStartTimeLocal":"07:30","durationMinutes":40,"miles":12.5}' "${AUTH[@]}"
if [ "$CV_HTTP_STATUS" != "201" ]; then
  cv_fail "expected create preset 201 got ${CV_HTTP_STATUS}: ${CV_HTTP_BODY}" $LINENO
fi
PRESET_ID="$(printf '%s' "$CV_HTTP_BODY" | jq -r '.presetId // empty')"
if [ -z "$PRESET_ID" ]; then
  cv_fail "expected presetId in create response got ${CV_HTTP_BODY}" $LINENO
fi

# Then
cv_step Then "read presets back and verify every field matches" $LINENO
cv_http GET /api/rides/presets 200 "${AUTH[@]}"
P="$(printf '%s' "$CV_HTTP_BODY" | jq -c --argjson id "$PRESET_ID" '[.presets[] | select(.presetId == $id)] | first // empty')"
if [ -z "$P" ]; then
  cv_fail "expected preset ${PRESET_ID} in list got ${CV_HTTP_BODY}" $LINENO
fi
ACTUAL="$(printf '%s' "$P" | jq -r '.name')"
if [ "$ACTUAL" != "Commute AM" ]; then
  cv_fail "expected name=Commute AM got ${ACTUAL}" $LINENO
fi
ACTUAL="$(printf '%s' "$P" | jq -r '.primaryDirection')"
if [ "$ACTUAL" != "SW" ]; then
  cv_fail "expected primaryDirection=SW got ${ACTUAL}" $LINENO
fi
ACTUAL="$(printf '%s' "$P" | jq -r '.periodTag')"
if [ "$ACTUAL" != "morning" ]; then
  cv_fail "expected periodTag=morning got ${ACTUAL}" $LINENO
fi
ACTUAL="$(printf '%s' "$P" | jq -r '.exactStartTimeLocal')"
if [ "$ACTUAL" != "07:30" ]; then
  cv_fail "expected exactStartTimeLocal=07:30 got ${ACTUAL}" $LINENO
fi
ACTUAL="$(printf '%s' "$P" | jq -r '.durationMinutes')"
if [ "$ACTUAL" != "40" ]; then
  cv_fail "expected durationMinutes=40 got ${ACTUAL}" $LINENO
fi
MILES_OK="$(printf '%s' "$P" | jq '.miles == 12.5')"
if [ "$MILES_OK" != "true" ]; then
  cv_fail "expected miles=12.5 got $(printf '%s' "$P" | jq -r '.miles')" $LINENO
fi

# Cleanup
cv_step Cleanup "delete the created preset" $LINENO
if [ -n "$PRESET_ID" ]; then
  cv_http DELETE "/api/rides/presets/${PRESET_ID}" "${AUTH[@]}" || true
fi

echo "CODEVALID_TEST_ASSERTION_OK:api_33047583_2"
