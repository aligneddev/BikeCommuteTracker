# Quickstart: PWA Desktop Packaging — Validation Guide

**Feature**: 023-pwa-desktop-packaging  
**Phase**: 1 — Design  
**Date**: 2026-06-10

---

## Purpose

This guide describes how to validate that the PWA desktop packaging feature works end-to-end — both locally (for development iteration) and via the CI release pipeline. It covers prerequisites, environment setup, build commands, and expected outcomes for each major scenario.

For artifact naming rules see [contracts/release-artifacts.md](contracts/release-artifacts.md). For workflow trigger details see [contracts/workflow-dispatch.md](contracts/workflow-dispatch.md).

---

## Prerequisites

### Local Development

**All development MUST occur inside the DevContainer.** The DevContainer is extended by this feature to include:

- Rust toolchain (via `rustup`, stable channel)
- Tauri system libraries:
  - `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` (Linux)
- `@tauri-apps/cli` v2 (installed as a project devDependency in `package.json`)

**One-time setup** (after cloning / rebuilding DevContainer):
```bash
# Inside DevContainer — verify Rust is present
rustc --version          # expect: rustc 1.80+
cargo --version          # expect: cargo 1.80+

# Install npm dependencies (includes @tauri-apps/cli)
cd src/BikeTracking.Frontend
npm ci
```

### CI Pipeline

- GitHub repository with Actions enabled
- `contents: write` permission on `GITHUB_TOKEN` (set in workflow)
- At least one conventional commit merged to `main` since the previous release
- No existing release/tag with the target version number

---

## Scenario 1: Run the Desktop App Locally (Development Mode)

**Validates**: Tauri + Vite integration works; app launches as a desktop window in dev mode.

```bash
cd src/BikeTracking.Frontend
npm run tauri:dev
```

**Expected outcome**:
- Vite dev server starts on `http://localhost:5173`
- A native desktop window opens titled "BikeTracking"
- The full BikeTracking UI renders — ride tracking, dashboard, history pages
- Hot-reload works: edit a `.tsx` file and the desktop window updates without restart
- Browser console (via Tauri devtools: right-click → Inspect) shows no errors

**If the backend is not running**: The app launches but API calls fail with network errors. Start the backend first:
```bash
dotnet run --project src/BikeTracking.AppHost
```

---

## Scenario 2: Build a Desktop Installer Locally (Production Build)

**Validates**: `tauri build` produces platform-appropriate installers with the correct version embedded.

```bash
cd src/BikeTracking.Frontend

# Build for the current platform only
npm run tauri:build
```

**Expected output locations**:
```
src/BikeTracking.Frontend/src-tauri/target/release/bundle/
├── nsis/
│   └── BikeTracking_<version>_x64-setup.exe    (on Windows)
├── appimage/
│   └── BikeTracking_<version>_amd64.AppImage   (on Linux)
└── deb/
    └── biketracking_<version>_amd64.deb         (on Linux)
```

**Version check**:
```bash
# The version in the installer filename must match package.json
node -e "console.log(require('./package.json').version)"
```

**Expected outcome**: Installer file exists at the path above; filename contains the current version string from `package.json` and `src-tauri/Cargo.toml`.

---

## Scenario 3: Install and Launch the Desktop App (User Acceptance)

**Validates**: User Story 1 — a downloaded installer produces a functional, launchable app (SC-006: < 5 min from download to launch).

### Windows
1. Run `BikeTracking_{version}_x64-setup.exe`
2. Accept the security prompt (SmartScreen warning expected in v1 without code signing)
3. Click through the NSIS installer wizard
4. Locate "BikeTracking" in the Windows Start Menu
5. Launch the app
6. **Expected**: Native app window opens with the BikeTracking UI

### Linux (AppImage)
```bash
chmod +x BikeTracking_{version}_amd64.AppImage
./BikeTracking_{version}_amd64.AppImage
```
**Expected**: App window opens. No installation required; runs in place.

### Linux (.deb)
```bash
sudo dpkg -i biketracking_{version}_amd64.deb
# Or via apt to auto-resolve dependencies:
sudo apt install ./biketracking_{version}_amd64.deb
biketracking   # or launch from application menu
```
**Expected**: App appears in application menu; launches from terminal with `biketracking`.

---

## Scenario 4: Trigger the Release Pipeline via a Tag Push

**Validates**: User Story 4 + FR-007 — tag push triggers automated pipeline.

```bash
# Ensure all changes are committed to main
git checkout main
git pull

# Create and push a version tag (use the version from package.json)
VERSION=$(node -e "console.log(require('./src/BikeTracking.Frontend/package.json').version)")
git tag "v${VERSION}"
git push origin "v${VERSION}"
```

**Expected outcome**:
1. Navigate to GitHub Actions → `release.yml` workflow — a new run appears within seconds
2. `build-frontend`, `package-linux`, and `package-windows` jobs run (Linux + Windows in parallel)
3. `publish-release` job completes; navigate to GitHub Releases
4. Release `v{version}` is published with:
   - Three artifact files attached (see [contracts/release-artifacts.md](contracts/release-artifacts.md))
   - Auto-generated release notes in the release body
   - SHA-256 checksums section

---

## Scenario 5: Trigger the Release Pipeline Manually (workflow_dispatch)

**Validates**: FR-008 — manual pipeline trigger.

1. Navigate to GitHub Actions → `release.yml` → "Run workflow"
2. Fill in:
   - `version`: leave blank to use `package.json` version, or enter `1.0.0-rc.1` for a pre-release test
   - `pre_release`: `true` if testing a pre-release
   - `dry_run`: `true` to test artifact building without publishing
3. Click "Run workflow"

**Expected outcome**:
- For `dry_run: true`: All build/package jobs complete, artifacts are uploaded as workflow run artifacts (visible in the run summary), no GitHub Release is created
- For `dry_run: false`: Same as Scenario 4 above

---

## Scenario 6: Verify Auto-Generated Release Notes

**Validates**: User Story 2 + FR-006 — release notes include commit history since previous release.

**Setup**: Ensure at least two conventional commits have been merged since the last release:
```bash
git log --oneline v{prev-version}..HEAD
# expect: list of commits with feat:/fix:/chore: prefixes
```

**Trigger**: Merge a release-please PR (or trigger manually as in Scenario 5).

**Expected outcome** in GitHub Release body:
```markdown
## What's Changed

### Features
* feat: add desktop packaging for Windows and Linux (#45) by @developer

### Bug Fixes
* fix: correct backend URL handling in Tauri shell (#46) by @developer

**Full Changelog**: https://github.com/.../compare/v0.9.0...v1.0.0
```

Each entry must reference a PR number or commit SHA (SC-004, User Story 2 Scenario 3).

---

## Scenario 7: Verify Version Consistency (SC-005)

**Validates**: Version agrees across artefact filenames, installer metadata, and GitHub Release title.

After a release, verify all three match:

```bash
# 1. GitHub Release title: should be "BikeTracking v1.2.3"
gh release view v1.2.3 --json name -q .name

# 2. Artifact filenames: download and check name
gh release download v1.2.3 --dir /tmp/release-check
ls /tmp/release-check/
# expect: BikeTracking_1.2.3_x64-setup.exe, BikeTracking_1.2.3_amd64.AppImage, biketracking_1.2.3_amd64.deb

# 3. Installed app version (Linux AppImage example)
./BikeTracking_1.2.3_amd64.AppImage --version 2>/dev/null || \
  strings BikeTracking_1.2.3_amd64.AppImage | grep -E '^[0-9]+\.[0-9]+\.[0-9]'
```

---

## Scenario 8: Pipeline Failure Does Not Publish a Partial Release (FR-009)

**Validates**: No broken or partial releases reach GitHub Releases if the pipeline fails.

**Simulation**:
1. Temporarily break the frontend build (introduce a TypeScript error in `src/App.tsx`)
2. Push a tag
3. **Expected**: `build-frontend` job fails; downstream jobs are skipped; no GitHub Release is created

**Verify**:
```bash
gh release list --limit 5
# The test version tag should NOT appear in the releases list
```

---

## Common Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `tauri dev` fails: "WebKitGTK not found" | Missing Linux system libraries | Rebuild DevContainer (Tauri libs added to devcontainer setup) |
| `tauri build` fails: "Rust not found" | Rust toolchain not installed | Run `rustup toolchain install stable` inside DevContainer |
| NSIS installer triggers SmartScreen warning | No code signing (expected in v1) | Click "More info" → "Run anyway"; add code signing in v2 |
| `.AppImage` won't run: "FUSE not available" | Some container/sandbox environments | Run with `--appimage-extract-and-run` flag or `--no-sandbox` |
| Pipeline: "Release already exists" | Tag pushed twice | Delete tag and release: `gh release delete v1.2.3 --cleanup-tag -y` then re-push |
| release-please PR not created | No conventional commits since last release | Ensure commits use `feat:`, `fix:`, `chore:` prefixes |
