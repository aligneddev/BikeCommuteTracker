# Implementation Plan: PWA Desktop Packaging & Automated Release Pipeline

**Branch**: `023-pwa-desktop-packaging` | **Date**: 2026-06-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/023-pwa-desktop-packaging/spec.md`

---

## Summary

Package the existing BikeTracking React 19 / Vite frontend as distributable desktop applications for **Windows** (NSIS `.exe` installer) and **Linux** (`.AppImage` + `.deb`) using **Tauri 2**, with a **GitHub Actions release pipeline** driven by `release-please` for automatic semantic versioning from conventional commits, CHANGELOG generation, and GitHub Release creation with attached artifacts.

**Key approach**: Tauri 2 wraps the existing Vite SPA in a native window with zero changes to React application logic. The packaging layer adds a `src-tauri/` directory alongside the frontend and two new workflow files. `release-please` manages version numbers across `package.json` and `Cargo.toml` automatically; the release pipeline runs Windows and Linux builds in parallel on native GitHub-hosted runners.

---

## Technical Context

**Language/Version**: TypeScript 6 (frontend, unchanged), Rust stable 1.80+ (Tauri shell — minimal), YAML (GitHub Actions workflows)

**Primary Dependencies**:
- `@tauri-apps/cli@^2` + `@tauri-apps/vite-plugin@^2` — desktop shell + Vite integration
- `@tauri-apps/api@^2` — Tauri JS API (config file read on startup)
- `googleapis/release-please-action@v4` — semantic versioning + CHANGELOG + release PR automation
- `softprops/action-gh-release@v2` — artifact upload and GitHub Release creation
- `actions/cache@v4` — Rust `~/.cargo` + `target/` caching for sub-15-minute builds

**Storage**: No new storage for the packaging layer. The existing SQLite database path must be moved to the OS app-data directory for packaged installs (`%APPDATA%\BikeTracking\` on Windows, `~/.local/share/BikeTracking/` on Linux) — noted as a configuration change, not a schema change.

**Testing**:
- Existing: Vitest (unit), Playwright (E2E) — unchanged and continue to run in CI
- New: `tauri build --debug` in DevContainer validates the Tauri config on every PR; live pipeline run validates the full release workflow

**Target Platform**: Windows 10 version 22H2+ (WebView2 built-in), Ubuntu 20.04+ / Debian 11+ (WebKit/GTK3 via `libwebkit2gtk-4.1-0`)

**Project Type**: Desktop app packaging + CI/CD release pipeline

**Performance Goals**: Full release pipeline (build → package → release) completes in **< 15 minutes** from trigger (SC-002). Achieved via:
- Single shared `build-frontend` job (Vite build runs once)
- Parallel `package-windows` + `package-linux` jobs
- Rust compilation cached via `~/.cargo` + `target/` action cache

**Constraints**:
- No code signing in v1 (per spec assumptions — SmartScreen warning acceptable on Windows)
- No macOS packaging (out of scope for this feature)
- No bundled backend; backend URL defaults to `http://localhost:5079`, runtime-overridable via `app.conf.json`
- DevContainer must include Rust toolchain and WebKit GTK dev libraries

**Scale/Scope**: Single pipeline producing 3 artifacts (Windows `.exe`, Linux `.AppImage`, Linux `.deb`) per release; single-developer project; GitHub-hosted runners only

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — all statuses confirmed.*

| Directive | Status | Notes |
|-----------|--------|-------|
| DevContainer development (1) | ✅ PASS | Rust toolchain + `libwebkit2gtk-4.1-dev` + Tauri system deps added to `.devcontainer/` post-create script |
| Trunk-based delivery / PR flow (2) | ✅ PASS | `release-please` creates a "release PR" to `main`; feature work merges via normal PRs; no direct pushes to `main` |
| TDD mandatory (3) | ⚠️ JUSTIFIED DEVIATION | GitHub Actions YAML and Tauri JSON config are declarative infrastructure — not unit-testable in the red-green-refactor sense. Validated by: (a) `tauri build --debug` check in PR CI, (b) live pipeline run as integration test, (c) version-consistency check script is a testable unit. See Complexity Tracking. |
| E2E required on every PR (4) | ✅ PASS | Existing Playwright E2E suite continues unchanged; `tauri build --debug` check added to CI for packaging config validation |
| Ports-and-adapters / boundary protection (5) | ✅ PASS | Tauri shell is pure infrastructure (wires WebView to `dist/`); React app is unchanged; backend URL injected via config, never hardcoded in source |
| Result-style domain outcomes (6) | N/A | No domain logic added by this feature |
| Event-sourced write model (7) | N/A | No data persistence changes |
| Local-first runtime (8) | ✅ PASS | Tauri packaged app is inherently local; no cloud dependency; backend runs locally per existing architecture |

---

## Project Structure

### Documentation (this feature)

```text
specs/023-pwa-desktop-packaging/
├── plan.md                        # This file
├── research.md                    # Phase 0: tooling decisions (Tauri, release-please, etc.)
├── data-model.md                  # Phase 1: config schema, version model, release entity
├── quickstart.md                  # Phase 1: validation guide (local dev → CI release)
├── contracts/
│   ├── release-artifacts.md       # Artifact naming, formats, compatibility matrix
│   └── workflow-dispatch.md       # Workflow triggers, inputs, job graph, failure behaviour
└── tasks.md                       # Phase 2: /speckit.tasks command output (NOT yet created)
```

### Source Code Changes (repository root)

```text
src/BikeTracking.Frontend/
├── src-tauri/                          # NEW: Tauri 2 shell
│   ├── Cargo.toml                      # Rust manifest; version synced by release-please
│   ├── Cargo.lock                      # Committed (Tauri convention for apps)
│   ├── build.rs                        # Tauri build script (required boilerplate)
│   ├── tauri.conf.json                 # App metadata, window config, bundle targets
│   ├── capabilities/
│   │   └── default.json               # Tauri v2 permissions (fs:read for app.conf.json)
│   └── src/
│       └── lib.rs                      # Minimal Tauri entry point; reads app.conf.json
│                                       # and injects window.__BIKE_API_URL__ global
├── icons/                              # NEW: Tauri icon set (generated from existing PWA icons)
│   ├── 32x32.png
│   ├── 128x128.png
│   ├── icon.ico                        # Windows taskbar/installer icon
│   └── icon.icns                       # macOS (placeholder — macOS out of scope)
├── vite.config.ts                      # UPDATED: add @tauri-apps/vite-plugin alongside react()
│                                       # Set clearScreen: false, server.strictPort: true
├── package.json                        # UPDATED: add @tauri-apps/cli, @tauri-apps/vite-plugin,
│                                       # @tauri-apps/api as devDeps; add tauri:dev, tauri:build scripts
└── ... (all existing source files unchanged)

.github/workflows/
├── ci.yaml                             # EXISTING — no changes
├── release-please.yml                  # NEW: version bump + release PR on push to main
└── release.yml                         # NEW: build, package, publish on tag push or workflow_dispatch

.devcontainer/
└── post-create.sh (or Dockerfile)      # UPDATED: add rustup install + tauri system deps
```

**Structure Decision**: Tauri's `src-tauri/` directory sits alongside `src/BikeTracking.Frontend/src/` — this is the standard Tauri workspace layout. The React source is untouched. Two new workflow files are added under `.github/workflows/`. DevContainer setup is extended to include Rust and WebKit GTK libraries.

---

## Implementation Approach

### Phase A: Tauri Integration (Local)

1. **DevContainer update**: Add `rustup` and Tauri system libraries to `.devcontainer/` setup. Rebuild container.
2. **Scaffold `src-tauri/`**: Run `npm run tauri init` (via `@tauri-apps/cli`) to generate `src-tauri/` with `Cargo.toml`, `tauri.conf.json`, `capabilities/`, and minimal `lib.rs`.
3. **Configure `tauri.conf.json`**: Set `productName: "BikeTracking"`, window dimensions, CSP policy for `localhost:5079`, bundle targets (nsis, appimage, deb), WebView2 bootstrapper mode.
4. **Update `vite.config.ts`**: Add `@tauri-apps/vite-plugin` to the plugins array; set `clearScreen: false` and `server.strictPort: true` (Tauri requirements).
5. **Update `package.json`**: Add `tauri:dev` and `tauri:build` scripts; add Tauri packages as devDependencies.
6. **Generate icons**: Use `npm run tauri icon` with the existing `pwa-512.png` from feature 022 to generate all required icon formats.
7. **Implement `app.conf.json` reader** in `lib.rs`: Read config on startup, inject `apiBaseUrl` as a JavaScript global via Tauri's `eval_script` API before the WebView loads the app.
8. **Validate locally**: `npm run tauri:dev` in DevContainer → app window opens with full BikeTracking UI.
9. **Validate build**: `npm run tauri:build` → confirm installer produced at `src-tauri/target/release/bundle/`.
10. **Update CI (`ci.yaml`)**: Add a `tauri-config-check` step: `npm run tauri build --debug -- --ci` (builds debug binary to catch config errors on every PR without full release overhead).

### Phase B: Release Pipeline (GitHub Actions)

11. **Create `release-please.yml`**: Configure `release-please-action@v4` with `release-type: node` (reads `package.json`); add `extra-files` to also bump `src-tauri/Cargo.toml` version.
12. **Create `release.yml`**: Implement four-job pipeline:
    - `build-frontend`: `npm ci` + `npm run build` + upload `dist/` as artifact
    - `package-linux`: Download `dist/`, `npm ci`, `tauri build --bundles deb`, upload artifact
    - `package-windows`: Same on `windows-latest` with `--bundles nsis`
    - `publish-release`: Download all artifacts, compute SHA-256 checksums, create/update GitHub Release
13. **Implement duplicate-tag guard**: Pre-check in `publish-release`: `gh release view $TAG --json isDraft -q '.isDraft'` → if output is `false` (published release already exists), fail with clear message; if `true` (draft from release-please), proceed.
14. **Implement pre-release detection**: If `$TAG` contains `-`, set `prerelease: true` and `make_latest: false` on the release action.
15. **Wire Rust caching**: Add `actions/cache@v4` for `~/.cargo` and `src-tauri/target/` in both packaging jobs.

### Phase C: Validation

16. **End-to-end pipeline run**: Push a conventional commit, merge a release-please PR, verify the full artifact set appears on the GitHub Releases page.
17. **Version consistency check**: Verify `package.json` version = `Cargo.toml` version = artifact filename version = GitHub Release title version (SC-005).
18. **Install validation**: Download Windows installer + Linux `.deb` from GitHub Releases, install, launch — verify BikeTracking UI appears (User Story 1 acceptance scenarios).

---

## Complexity Tracking

> Constitution Check violation justification (TDD gate)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| TDD gate deviation for CI/CD workflows and Tauri config | GitHub Actions YAML and `tauri.conf.json` are declarative configuration files — there is no meaningful unit-testable logic to put under a failing-test gate. Validation is done by execution: `tauri build --debug` in PR CI + live pipeline run. | There is no practical "unit test" for a workflow YAML file. The conventional TDD gate applies to domain/application logic; infra configuration is validated by execution (as recognised in the Testing and Quality Gates instruction pack). |
