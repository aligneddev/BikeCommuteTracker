#!/usr/bin/env bash
set -euo pipefail

export PORT="${PORT:-6713}"
export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://+:6713}"
export ConnectionStrings__BikeTracking="${ConnectionStrings__BikeTracking:-Data Source=/app/data/app.db}"
export ExternalApis__EiaGasPriceBaseUrl="${ExternalApis__EiaGasPriceBaseUrl:-http://toxiproxy:8585}"
export ExternalApis__OpenMeteoForecastBaseUrl="${ExternalApis__OpenMeteoForecastBaseUrl:-http://toxiproxy:8586}"
export ExternalApis__OpenMeteoArchiveBaseUrl="${ExternalApis__OpenMeteoArchiveBaseUrl:-http://toxiproxy:8587}"
export WAIT_FOR_TCP="${WAIT_FOR_TCP:-toxiproxy:8585 toxiproxy:8586 toxiproxy:8587}"
export MIGRATE_CMD="${MIGRATE_CMD:-true}"

export WIREMOCK_ADMIN_URL="${WIREMOCK_ADMIN_URL:-http://wiremock:8080}"
wiremock_admin_import_mappings() {
  local dir="$1" f
  for f in "$dir"/*.json; do
    [ -e "$f" ] || { echo "no mappings in $dir" >&2; return 1; }
    curl -sS -f -o /dev/null -X POST "$WIREMOCK_ADMIN_URL/__admin/mappings" \
      -H 'Content-Type: application/json' --data-binary @"$f" \
      || { echo "wiremock import failed: $f" >&2; return 1; }
  done
}

# --- CodeValid diagnosis markers (parsed by the test runner; do not edit) ---
# cv_step  <Given|When|Then|Cleanup> "<what this section does>" $LINENO
# cv_prereq "<setup being done>" $LINENO
# cv_http  <METHOD> <url> <http_status>          (after every curl)
# cv_fail  "<expected X got Y>" $LINENO           (prints marker, exits 1)
cv_step() { printf 'CV_STEP|%s|%s|line=%s\n' "$1" "$2" "${3:-}"; }
cv_prereq() { printf 'CV_PREREQ|%s|line=%s\n' "$1" "${2:-}"; }
cv_http() { printf 'CV_HTTP|%s|%s|%s\n' "$1" "$2" "$3"; }
cv_fail() { printf 'CV_ASSERT_FAIL|%s|line=%s\n' "$1" "${2:-}"; exit 1; }
# --- end CodeValid diagnosis markers ---
