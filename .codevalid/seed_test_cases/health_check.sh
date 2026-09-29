#!/usr/bin/env bash
set -euo pipefail
HEALTH_URL="${HEALTH_URL:-http://app:6713/health}"
code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")"
if [ "$code" = "200" ]; then
  echo "${SEED_ASSERTION_MESSAGE:-CODEVALID_SEED_OK}"
else
  echo "health failed: HTTP $code"; exit 1
fi
