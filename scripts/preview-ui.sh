#!/usr/bin/env bash
# Screenshot a frontend route at desktop and phone width, with the API mocked.
# Usage: scripts/preview-ui.sh /dashboard [out-dir]
# Mocks: scripts/ui-preview-mocks/<name>.json answers **/api/<name>, with "__" for "/"
# (dashboard__advanced.json -> **/api/dashboard/advanced); other /api calls get {}.
# Needs scripts/sandbox-setup.sh (or the DevContainer) first.
set -euo pipefail

ROUTE="${1:?usage: preview-ui.sh <route> [out-dir]}"
OUT="${2:-$PWD/ui-preview}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
FE_LINUX="${FE_LINUX:-$HOME/biketracking-frontend-linux}"
APP=http://127.0.0.1:5173
CORS=(--header "Access-Control-Allow-Origin: *" --header "Access-Control-Allow-Headers: *" --header "Access-Control-Allow-Methods: *")
NAME="$(echo "${ROUTE#/}" | tr '/' '-')"; NAME="${NAME:-home}"

FE="$REPO/src/BikeTracking.Frontend"
rm -rf "$FE_LINUX/src" "$FE_LINUX/public"
cp -r "$FE/src" "$FE/public" "$FE/index.html" "$FE/vite.config.ts" "$FE/tsconfig"*.json "$FE_LINUX/"

(cd "$FE_LINUX" && exec npx vite --host 127.0.0.1 --strictPort >"$FE_LINUX/vite.log" 2>&1) &
VITE_PID=$!
# playwright-cli reads .playwright/cli.config.json from the working directory.
cd "$REPO"
trap 'playwright-cli close >/dev/null 2>&1 || true; kill $VITE_PID 2>/dev/null || true' EXIT
for _ in $(seq 30); do curl -s -o /dev/null "$APP/" && break; sleep 1; done

pw() { playwright-cli "$@" >/dev/null; }
pw open about:blank
pw route "**/health" --body ok "${CORS[@]}"
pw route "**/api/**" --body '{}' --content-type application/json "${CORS[@]}"
for mock in "$REPO"/scripts/ui-preview-mocks/*.json; do
  [ -e "$mock" ] || continue
  api="$(basename "$mock" .json)"; api="${api//__//}"
  pw route "**/api/$api" --body "$(cat "$mock")" --content-type application/json "${CORS[@]}"
done
pw goto "$APP/login"
pw sessionstorage-set bike_tracking_auth_session '{"userId":1,"userName":"rider"}'
pw goto "$APP$ROUTE"
sleep 2

mkdir -p "$OUT"
pw resize 1280 900
pw screenshot --full-page --filename="$OUT/$NAME-desktop.png"
pw resize 390 844
pw screenshot --full-page --filename="$OUT/$NAME-phone.png"
playwright-cli eval "() => document.documentElement.scrollWidth > innerWidth ? 'WARNING: page scrolls sideways at phone width' : 'phone width: no sideways scroll'" | sed -n 2p
echo "Screenshots: $OUT/$NAME-desktop.png $OUT/$NAME-phone.png"
