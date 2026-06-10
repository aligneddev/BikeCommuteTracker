# Contract: GitHub Actions Workflow Dispatch Interface

**Feature**: 023-pwa-desktop-packaging  
**Version**: 1.0  
**Date**: 2026-06-10

---

## Overview

This contract defines the interfaces (triggers, inputs, outputs, and environment requirements) for the two new GitHub Actions workflows introduced by this feature. It is the authoritative reference for anyone triggering, extending, or consuming these workflows.

---

## Workflow 1: `release-please.yml`

**File**: `.github/workflows/release-please.yml`  
**Purpose**: Automated version bump, CHANGELOG update, and release PR management using `release-please`.

### Trigger

```yaml
on:
  push:
    branches: [main]
```

Fires automatically on every merge to `main`. Manual execution is not supported (use `release.yml` workflow_dispatch for manual releases).

### Behaviour

1. Reads conventional commits since the last release tag.
2. Creates or updates a PR titled `chore(main): release {computed-version}` with:
   - Bumped `version` in `src/BikeTracking.Frontend/package.json`
   - Bumped `version` in `src/BikeTracking.Frontend/src-tauri/Cargo.toml`
   - Updated `src/BikeTracking.Frontend/CHANGELOG.md`
3. When the release PR is merged:
   - Pushes git tag `v{version}` (e.g., `v1.2.3`)
   - Creates a GitHub Release (in draft state with release notes pre-populated)
4. The tag push fires `release.yml` to build and attach artifacts.

### Outputs (on release PR merge)

| Output | Description |
|--------|-------------|
| Git tag | `v{major}.{minor}.{patch}` pushed to the repository |
| GitHub Release | Draft release created with auto-generated release notes |
| `release_created` | `true` when a release was published (available as step output) |
| `tag_name` | The tag that was created (e.g., `v1.2.3`) |
| `major`, `minor`, `patch` | Parsed version components |

### Required Permissions

```yaml
permissions:
  contents: write       # push tags, create releases
  pull-requests: write  # create/update release PR
```

### Conventional Commit → Version Bump Rules

| Commit prefix | Version bump | Example |
|--------------|-------------|---------|
| `feat:` | `minor` | `1.1.0` → `1.2.0` |
| `fix:` | `patch` | `1.1.0` → `1.1.1` |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:` | `patch` | `1.1.0` → `1.1.1` |
| `BREAKING CHANGE:` (commit footer) | `major` | `1.1.0` → `2.0.0` |
| `feat!:` or `fix!:` | `major` | `1.1.0` → `2.0.0` |

---

## Workflow 2: `release.yml`

**File**: `.github/workflows/release.yml`  
**Purpose**: Build the Vite frontend, package for Windows and Linux using Tauri, and publish all artifacts to a GitHub Release.

### Triggers

#### Automatic (tag push)
```yaml
on:
  push:
    tags: ['v*.*.*']
```
Fires when a version tag matching `v{major}.{minor}.{patch}` (or `v{major}.{minor}.{patch}-{prerelease}`) is pushed. This is the primary trigger, fired automatically by `release-please` after a release PR is merged.

#### Manual (workflow dispatch)
```yaml
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g. 1.2.3). Defaults to version in package.json.'
        required: false
        type: string
      pre_release:
        description: 'Mark as pre-release?'
        required: false
        type: boolean
        default: false
      dry_run:
        description: 'Build and package artifacts without publishing the GitHub Release'
        required: false
        type: boolean
        default: false
```

### Inputs (workflow_dispatch only)

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | string | *(read from `package.json`)* | Override the version string. MUST be a valid SemVer. If omitted, `jq` reads `.version` from `package.json`. |
| `pre_release` | boolean | `false` | When `true`, sets `prerelease: true` on the GitHub Release and `make_latest: false`. |
| `dry_run` | boolean | `false` | When `true`, builds and packages artifacts but does NOT create or update a GitHub Release. Artifacts remain as workflow run artifacts for 7 days. |

### Jobs

```
build-frontend (ubuntu-latest)
    │  Outputs: dist/ artifact uploaded as 'frontend-dist'
    │
    ├──────────────────────────────────────────────────────┐
    ▼                                                      ▼
package-windows (windows-latest)              package-linux (ubuntu-latest)
    needs: [build-frontend]                       needs: [build-frontend]
    Downloads: frontend-dist                      Downloads: frontend-dist
    Runs: tauri build --bundles nsis              Runs: tauri build --bundles appimage,deb
    Uploads: BikeTracking_*_x64-setup.exe         Uploads: BikeTracking_*_amd64.AppImage
                                                           biketracking_*_amd64.deb
    │                                                      │
    └──────────────────────────┬───────────────────────────┘
                               ▼
                   publish-release (ubuntu-latest)
                       needs: [package-windows, package-linux]
                       if: inputs.dry_run != true
                       Creates/updates GitHub Release
                       Attaches all 3 artifacts
                       Posts SHA-256 checksums to release body
```

### Environment Variables (set on all jobs)

| Variable | Value | Purpose |
|----------|-------|---------|
| `CI` | `"true"` | Standard CI flag; suppresses interactive prompts |
| `DOTNET_NOLOGO` | `"true"` | Suppress .NET telemetry (inherited from ci.yml convention) |
| `TAURI_SIGNING_PRIVATE_KEY` | *(GitHub Secret — optional in v1)* | Tauri updater signing key; leave unset until code signing is implemented |

### Required Repository Secrets / Permissions

| Permission / Secret | Required | Purpose |
|--------------------|----------|---------|
| `GITHUB_TOKEN` | Yes (auto-provided) | Create releases, upload assets, push release PR |
| `contents: write` | Yes | Attach release assets and push tags |
| `TAURI_SIGNING_PRIVATE_KEY` | No (v1) | Desktop update signing; add in v2 when code signing is implemented |

### Failure Behaviour (FR-009)

| Failure Point | Behaviour |
|--------------|-----------|
| `build-frontend` fails | `package-windows` and `package-linux` are skipped; `publish-release` is skipped; no release is created |
| `package-windows` fails | `publish-release` is skipped (via `needs` dependency); no partial release |
| `package-linux` fails | Same as above |
| `publish-release` fails | GitHub Release remains as draft (not published); workflow run is marked failed; maintainer receives notification |
| Duplicate tag detected | `publish-release` pre-check exits 1 with message: `Release {tag} already exists. Delete the tag and draft release first.` |

### Outputs (after successful run)

| Output | Description |
|--------|-------------|
| GitHub Release URL | `https://github.com/{owner}/{repo}/releases/tag/{tag}` |
| Workflow summary | Per-job pass/fail status posted to Actions summary (SC-007) |
| Uploaded artifact names | Listed in workflow run artifacts; also available as release assets |

### Timeout Budget

| Job | `timeout-minutes` | Notes |
|-----|------------------|-------|
| `build-frontend` | 10 | Vite build + npm ci |
| `package-windows` | 20 | Rust compile + NSIS packaging |
| `package-linux` | 20 | Rust compile + AppImage + .deb |
| `publish-release` | 5 | Upload + release creation |
| **Total (parallel)** | **~35 max** | Parallel jobs; end-to-end usually 12–18 min |

> SC-002 target: complete pipeline in < 15 minutes from trigger. Rust compilation is cached via `actions/cache` for `~/.cargo` and `src-tauri/target`. First build (cold cache) may take up to 25 minutes; subsequent runs target < 12 minutes.

---

## Caching Strategy

Both packaging jobs cache Rust compilation artifacts to reduce repeat build times:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      ~/.cargo/git/db/
      src/BikeTracking.Frontend/src-tauri/target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
    restore-keys: ${{ runner.os }}-cargo-
```

Node modules are cached via `actions/setup-node` with `cache: npm` and `cache-dependency-path: src/BikeTracking.Frontend/package-lock.json` (matching the existing `ci.yml` pattern).
