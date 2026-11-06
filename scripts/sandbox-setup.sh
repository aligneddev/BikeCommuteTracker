#!/usr/bin/env bash
# One-time setup for a Linux sandbox that is not the DevContainer: .NET SDK,
# a Linux copy of the frontend's node_modules, and playwright-cli + Chromium.
# Idempotent: rerun it after the sandbox is recreated.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
# The repo's node_modules may hold Windows binaries (host mount), so Linux tools run from this copy.
FE_LINUX="${FE_LINUX:-$HOME/biketracking-frontend-linux}"
PERSIST=/etc/sandbox-persistent.sh

mkdir -p "$FE_LINUX"
cp "$REPO/src/BikeTracking.Frontend/package.json" "$REPO/src/BikeTracking.Frontend/package-lock.json" "$FE_LINUX/"
(cd "$FE_LINUX" && npm ci --ignore-scripts)

command -v playwright-cli >/dev/null || npm i -g @playwright/cli@latest
(cd "$REPO" && playwright-cli install-browser chromium)
(cd "$FE_LINUX" && sudo -n npx playwright install-deps chromium)

# Last, so the frontend tools above still work if the .NET download is blocked.
if ! command -v dotnet >/dev/null && [ ! -x "$HOME/.dotnet/dotnet" ]; then
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  bash /tmp/dotnet-install.sh --jsonfile "$REPO/global.json" --install-dir "$HOME/.dotnet"
fi
if [ -w "$PERSIST" ] && ! grep -q 'DOTNET_ROOT' "$PERSIST"; then
  echo 'export DOTNET_ROOT="$HOME/.dotnet"; export PATH="$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH"' >> "$PERSIST"
fi

echo "Ready. Linux frontend copy: $FE_LINUX"
