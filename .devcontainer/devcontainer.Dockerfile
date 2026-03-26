# syntax=docker/dockerfile:1.7

FROM mcr.microsoft.com/devcontainers/dotnet:1-10.0-noble

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

WORKDIR /workspaces/neCodeBikeTracking

ENV PATH="/usr/local/share/dotnet-tools:/root/.dotnet/tools:${PATH}"

ARG REQUIRED_DOTNET_SDK_VERSION=10.0.200

# Install podman and Node.js 24 in a single layer.
# NodeSource nodejs already includes npm; installing distro npm causes conflicts.
RUN curl -fsSL https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor > /usr/share/keyrings/yarn-archive-keyring.gpg && apt-get update \
  && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get update \
  && apt-get install -y --no-install-recommends podman nodejs \
  && rm -rf /var/lib/apt/lists/* \
  && npm --version

# Ensure the SDK version from global.json is available in the image.
RUN if dotnet --list-sdks | grep -q "^${REQUIRED_DOTNET_SDK_VERSION}"; then \
      echo ".NET SDK ${REQUIRED_DOTNET_SDK_VERSION} already installed."; \
    else \
      echo "Installing .NET SDK ${REQUIRED_DOTNET_SDK_VERSION}..." && \
      curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh && \
      bash /tmp/dotnet-install.sh --version "${REQUIRED_DOTNET_SDK_VERSION}" --install-dir /usr/share/dotnet --no-path && \
      rm -f /tmp/dotnet-install.sh; \
    fi

# Install Aspire workload early — this layer survives .csproj / manifest changes.
RUN curl -fsSL https://aspire.dev/install.sh | bash

# Copy dependency manifests first so restore layers can be cached.
COPY global.json ./
COPY BikeTracking.slnx ./
COPY .config/dotnet-tools.json ./.config/dotnet-tools.json
COPY src/BikeTracking.Api/BikeTracking.Api.csproj src/BikeTracking.Api/
COPY src/BikeTracking.Api.Tests/BikeTracking.Api.Tests.csproj src/BikeTracking.Api.Tests/
COPY src/BikeTracking.AppHost/BikeTracking.AppHost.csproj src/BikeTracking.AppHost/
COPY src/BikeTracking.Domain.FSharp/BikeTracking.Domain.FSharp.fsproj src/BikeTracking.Domain.FSharp/
COPY src/BikeTracking.Frontend/BikeTracking.Frontend.esproj src/BikeTracking.Frontend/
COPY src/BikeTracking.ServiceDefaults/BikeTracking.ServiceDefaults.csproj src/BikeTracking.ServiceDefaults/

# Warm NuGet cache and install CLI tools in a single layer.
RUN dotnet tool restore && dotnet restore BikeTracking.slnx

# Copy npm manifests and warm the npm package cache.
# ~/.npm is outside the workspace bind mount, so the cache persists at runtime,
# making postCreateCommand "npm ci" fast without re-downloading packages.
COPY src/BikeTracking.Frontend/package.json src/BikeTracking.Frontend/package-lock.json /tmp/npm-warmup/
RUN npm ci --prefix /tmp/npm-warmup && rm -rf /tmp/npm-warmup

