# Contract: Release Artifacts

**Feature**: 023-pwa-desktop-packaging  
**Version**: 1.0  
**Date**: 2026-06-10

---

## Overview

This contract defines the naming conventions, formats, and integrity requirements for all distributable artifacts produced by the release pipeline and published to GitHub Releases. Consumers (end users, download scripts, CI validation jobs) MUST NOT assume any filename format not defined here.

---

## Artifact Naming Convention

All artifact filenames follow the pattern produced by Tauri's bundle naming, where `productName` = `"BikeTracking"` and `version` matches the semantic version from `Cargo.toml`:

| Platform | Bundle Type | Filename Pattern | Example |
|----------|-------------|-----------------|---------|
| Windows 10+ (x64) | NSIS installer | `BikeTracking_{version}_x64-setup.exe` | `BikeTracking_1.2.3_x64-setup.exe` |
| Linux (x64) | AppImage | `BikeTracking_{version}_amd64.AppImage` | `BikeTracking_1.2.3_amd64.AppImage` |
| Linux (x64) | Debian package | `biketracking_{version}_amd64.deb` | `biketracking_1.2.3_amd64.deb` |

> **Note**: Tauri lowercases the product name for `.deb` filenames (`biketracking_...`) while preserving case for `.exe` and `.AppImage`. Consumers must account for this case difference.

**Version format in filenames**: `{major}.{minor}.{patch}` for stable releases; `{major}.{minor}.{patch}-{preRelease}` for pre-releases (e.g., `1.2.3-beta.1`).

---

## Artifact Integrity

Each release MUST include SHA-256 checksums for all published artifacts. The checksums are posted as a fenced code block in the GitHub Release body under the heading `## Checksums`:

```
## Checksums

| Artifact | SHA-256 |
|----------|---------|
| BikeTracking_1.2.3_x64-setup.exe | abc123...def456 |
| BikeTracking_1.2.3_amd64.AppImage | 789abc...012def |
| biketracking_1.2.3_amd64.deb | 456789...abcdef |
```

**Validation**: Consumers can verify with:
```bash
# Linux
sha256sum -c <<< "abc123...def456  BikeTracking_1.2.3_amd64.AppImage"

# Windows (PowerShell)
(Get-FileHash -Algorithm SHA256 'BikeTracking_1.2.3_x64-setup.exe').Hash -eq 'ABC123...'
```

---

## Required Artifact Set

Every stable GitHub Release (non-pre-release) MUST contain all three artifacts:

| # | Required? | Artifact |
|---|-----------|---------|
| 1 | REQUIRED | `BikeTracking_{version}_x64-setup.exe` |
| 2 | REQUIRED | `BikeTracking_{version}_amd64.AppImage` |
| 3 | REQUIRED | `biketracking_{version}_amd64.deb` |

A release MUST NOT be published (i.e., the `publish-release` job MUST fail) if any required artifact is missing from the upload matrix.

---

## Pre-Release Artifact Behaviour

Pre-release versions (where `version` contains a `-` separator, e.g., `1.2.3-beta.1`) follow the same naming convention and artifact set. The GitHub Release for a pre-release:

- MUST have `prerelease: true` set (FR-012)
- MUST NOT be designated as the `latest` release (`make_latest: false`)
- MAY include a reduced artifact set (e.g., Linux-only for early testing) — documented in the release notes body

---

## Artifact Size Guidance

Approximate sizes for planning download/install estimates (SC-006: install < 5 min):

| Artifact | Approx. Size | Install Time Estimate (10 Mbps) |
|----------|-------------|--------------------------------|
| Windows NSIS `.exe` | 8–15 MB | < 30 seconds download |
| Linux `.AppImage` | 8–12 MB | < 20 seconds download |
| Linux `.deb` | 5–10 MB | < 15 seconds download |

These estimates assume a Tauri 2 app embedding React 19 + Recharts. Actual sizes depend on final dependency tree.

---

## Artifact Compatibility Matrix

| Artifact | Minimum OS Version | WebView Requirement |
|----------|-------------------|---------------------|
| Windows `.exe` | Windows 10 version 22H2 (WebView2 ships built-in) | WebView2; bootstrapper installs automatically if absent |
| Linux `.AppImage` | Any Linux with FUSE support (Ubuntu 20.04+, Debian 11+) | WebKit/GTK bundled in AppImage |
| Linux `.deb` | Ubuntu 20.04 / Debian 11 | Requires `libwebkit2gtk-4.1-0` (declared as dependency, auto-installed by `apt`) |

---

## Artifact Location

All artifacts are attached to the GitHub Release at:  
`https://github.com/{owner}/{repo}/releases/tag/{tag}`

Direct download URL pattern:  
`https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}`

Example:  
`https://github.com/owner/neCodeBikeTracking/releases/download/v1.2.3/BikeTracking_1.2.3_x64-setup.exe`
