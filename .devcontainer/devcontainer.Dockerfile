# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/devcontainers/dotnet:1-10.0-noble

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG REQUIRED_DOTNET_SDK_VERSION=10.0.200

# Ensure the SDK version from global.json is available in the image.
RUN if dotnet --list-sdks | grep -q "^${REQUIRED_DOTNET_SDK_VERSION}"; then \
      echo ".NET SDK ${REQUIRED_DOTNET_SDK_VERSION} already installed."; \
    else \
      echo "Installing .NET SDK ${REQUIRED_DOTNET_SDK_VERSION}..." && \
      curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh && \
      bash /tmp/dotnet-install.sh --version "${REQUIRED_DOTNET_SDK_VERSION}" --install-dir /usr/share/dotnet --no-path && \
      rm -f /tmp/dotnet-install.sh; \
    fi

# Install required CLI tools once at image build time.
RUN dotnet tool restore
    
RUN curl -fsSL https://aspire.dev/install.sh | bash

ENV PATH="/usr/local/share/dotnet-tools:/root/.dotnet/tools:${PATH}"

