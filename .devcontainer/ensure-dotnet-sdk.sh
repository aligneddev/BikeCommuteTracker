#!/bin/bash
set -euo pipefail

REQUIRED_SDK_VERSION="10.0.200"

if dotnet --list-sdks 2>/dev/null | grep -q "^${REQUIRED_SDK_VERSION}"; then
  echo ".NET SDK ${REQUIRED_SDK_VERSION} already installed."
  exit 0
fi

echo "Installing .NET SDK ${REQUIRED_SDK_VERSION}..."
curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
bash /tmp/dotnet-install.sh --version "${REQUIRED_SDK_VERSION}" --install-dir /usr/share/dotnet --no-path
rm -f /tmp/dotnet-install.sh

if dotnet --list-sdks | grep -q "^${REQUIRED_SDK_VERSION}"; then
  echo "Installed .NET SDK ${REQUIRED_SDK_VERSION}."
else
  echo "Failed to install .NET SDK ${REQUIRED_SDK_VERSION}." >&2
  exit 1
fi
