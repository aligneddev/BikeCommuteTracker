# Research: PWA Desktop Packaging & Automated Release Pipeline

**Feature**: 023-pwa-desktop-packaging  
**Phase**: 0 — Unknowns Resolution  
**Date**: 2026-06-10

---

## Decision 1: Desktop Shell — Tauri 2

**Decision**: Use **Tauri 2** (`@tauri-apps/cli@^2`) as the desktop shell.

**Rationale**:
- Produces dramatically smaller installers (~5–15 MB) versus Electron (~120–200 MB). This directly supports SC-006 (first-time install < 5 minutes on modest connections).
- Uses the platform's native WebView: **WebView2** (Windows 10 22H2+ ships it built-in; older machines auto-update via Edge) and **WebKit/GTK3** (Ubuntu 20.04+). React 19 + modern CSS are fully compatible with both.
- Vite integration is first-class via `@tauri-apps/vite-plugin` — wraps the existing Vite dev server and build pipeline with no changes to React application code.
- Active development cadence (v2 released 2024); official GitHub Actions recipes published and maintained.
- Rust toolchain is the only new DevContainer requirement; it can be added via `rustup` in `.devcontainer/post-create.sh`.

**Alternatives Considered**:

| Tool | Rejected Because |
|------|-----------------|
| **Electron + electron-builder** | 120–200 MB bundle; Chromium bundled regardless of whether system already has it; higher RAM footprint at runtime. Acceptable for complex apps needing Node.js APIs, overkill here. |
| **Neutralino.js** | Smaller ecosystem, fewer maintained GitHub Action integrations, limited IPC API. |
| **NW.js** | Legacy; low community activity; no Vite plugin. |
| **PWA to APK/EXE wrappers (e.g., PWABuilder)** | Produces MSIX (requires code signing for distribution on Win 10+) or unreliable app-shell wrappers with poor update semantics. |

**Risk Mitigations**:
- WebView2 availability on Windows: Tauri's NSIS installer bundles a WebView2 bootstrapper that silently installs it if absent (configurable in `tauri.conf.json` → `bundle.windows.webviewInstallMode`).
- WebKit on Linux: Any Ubuntu 20.04+ or Debian 11+ installation includes `libwebkit2gtk-4.1`. The `.deb` package declares this as a dependency; AppImage bundles the required libs.

---

## Decision 2: Semantic Versioning — release-please

**Decision**: Use **`googleapis/release-please-action@v4`** for automated versioning and changelog management.

**Rationale**:
- Native GitHub integration: creates a "Release PR" that bumps version in `package.json` and `Cargo.toml`, updates `CHANGELOG.md`, and when merged automatically creates a git tag (e.g., `v1.2.3`) and a GitHub Release.
- Works exclusively from **Conventional Commits** (spec: `feat:`, `fix:`, `chore:`, `BREAKING CHANGE:`), which the spec requires the team to adopt (Assumption).
- Zero-config for the standard release type (`node` manifest); minimal YAML for a workspace with both `package.json` and `Cargo.toml`.
- Satisfies FR-007 (tag push triggers release pipeline) because release-please pushes the tag on PR merge; the tag push then fires `.github/workflows/release.yml`.
- Satisfies FR-008 (manual dispatch) through `workflow_dispatch` input on `release.yml`.
- Satisfies FR-006 (release notes) through the auto-generated changelog grouped by commit type.

**Workflow interaction**:
```
conventional commit → merge to main
  → release-please.yml runs → creates/updates "chore(main): release 1.2.3" PR
Maintainer merges release PR
  → release-please pushes tag v1.2.3 + creates GitHub Release draft
  → release.yml triggers on tag push v*.*.* → builds artifacts, uploads to release
```

**Alternatives Considered**:

| Tool | Rejected Because |
|------|-----------------|
| **semantic-release** | More complex multi-package config; requires NPM tokens even for GitHub-only releases; more moving parts for a single-developer project. Valid choice if deeper customisation is needed later. |
| **Manual git tags** | Violates FR-004 (no manual version input); doesn't auto-generate release notes (FR-006). |
| **standard-version** | Deprecated in favour of release-please by its own maintainers (cliftonlabs/standard-version). |
| **changesets** | Optimised for NPM monorepos with multiple publishable packages; over-engineered for this use case. |

**Conventional Commit Adoption**:  
The team must use conventional commit prefixes from this feature forward. Pre-release versions use the `-beta.N` or `-rc.N` suffix (handled by release-please's pre-release mode), satisfying FR-012.

---

## Decision 3: Windows Artifact — NSIS Installer (.exe)

**Decision**: Use **NSIS installer** (`.exe`) as the primary Windows artifact (Tauri default).

**Rationale**:
- Familiar "Next → Next → Finish" install experience; supported by Tauri out of the box via `tauri build --bundles nsis`.
- Creates Start Menu entry, desktop shortcut (optional), and uninstaller — satisfying the acceptance scenario in User Story 1.
- No code-signing requirement to run (per spec: code signing deferred to v2); Windows SmartScreen will show a warning but the app is still installable.
- Filename templating: Tauri names it `BikeTracking_{version}_x64-setup.exe` by default; `tauri.conf.json` `productName` controls the prefix.

**Alternatives Considered**:
- **MSI**: Requires WiX toolset; more complex pipeline; still triggers SmartScreen without signing. Lower user familiarity than NSIS exe. Viable for enterprise/MSP scenarios in a future version.
- **MSIX**: Microsoft's modern package format; requires code signing from a trusted CA to install on most Windows 10 machines. Deferred to v2 with code signing.

---

## Decision 4: Linux Artifacts — AppImage + .deb

**Decision**: Produce both **AppImage** and **`.deb`** from the same Linux build job.

**Rationale**:
- AppImage is distribution-agnostic and runs without installation on any Linux with FUSE support — broadest compatibility.
- `.deb` covers Ubuntu, Debian, Linux Mint, Pop!_OS (majority of desktop Linux users in the commuter/productivity space).
- Tauri generates both from a single `tauri build --bundles appimage,deb` invocation; no extra pipeline complexity.
- Satisfies FR-003 ("at least one Linux distributable"); producing two exceeds the requirement at zero extra cost.

**Alternatives Considered**:
- **RPM only**: Covers Fedora/CentOS; lower desktop Linux marketshare. Can be added later with one line change to Tauri config.
- **Flatpak**: Requires a Flatpak repository to serve updates; overkill for a local-first app distributed via GitHub Releases.
- **Snap**: Desktop snaps have known WebKit/GTK confinement issues; Canonical's store requirement adds friction.

---

## Decision 5: Backend URL Configuration

**Decision**: Compile-time default (`http://localhost:5079`) baked into the frontend build, with runtime override support via a **user-editable config file** (`app.conf.json`) read at startup by the Tauri shell and injected as a JS global.

**Rationale**:
- Spec assumption: "backend connection URL will be configurable at install time or via an app setting".
- Vite's `VITE_API_BASE_URL` env var is already used by the frontend services; the Tauri shell can write the value into the app's HTML at launch using a Tauri plugin or inject it via a JS `window.__BIKE_API_URL__` global before the React app initialises.
- Config file lives in the Tauri app data directory (OS-managed, user-writable):  
  - Windows: `%APPDATA%\BikeTracking\app.conf.json`  
  - Linux: `~/.config/BikeTracking/app.conf.json`
- First-run default is written if the file doesn't exist.

**Alternatives Considered**:
- **Environment variable only**: Not user-friendly on Windows (requires editing system environment variables). Fine for Linux power users; rejected because it doesn't satisfy "configurable at install time" for Windows.
- **In-app settings screen**: Ideal UX; deferred to a follow-on feature (outside scope of this packaging feature).
- **Build-time env var only**: Works only if users always run their own backend on the default port. Too rigid.

---

## Decision 6: CI Runners — Native (No Cross-Compilation)

**Decision**: Use **`ubuntu-latest`** for Linux builds and **`windows-latest`** for Windows builds. No cross-compilation.

**Rationale**:
- Tauri requires the target platform's native WebView libraries at build time (`libwebkit2gtk` on Linux, WebView2 SDK on Windows). Cross-compiling Rust with these native deps is complex and fragile.
- GitHub-hosted runners for both platforms are available at no extra cost. `windows-latest` = Windows Server 2022; `ubuntu-latest` = Ubuntu 24.04.
- Both jobs can run in parallel (FR-011 — parallel packaging jobs) to stay within the 15-minute budget (SC-002).
- Linux build includes cache for Rust (`~/.cargo`) and node_modules to keep repeat builds fast.

**Alternatives Considered**:
- **Cross-compilation via `cross` / Docker**: Complex; unsupported for Tauri's WebView2 dependency on Windows; rejected.
- **Single Linux runner producing both**: Not possible without cross-compilation.
- **Self-hosted runners**: Adds infrastructure overhead; not warranted for a project of this scale.

---

## Decision 7: Artifact Consolidation — Upload + Single Release Job

**Decision**: Parallel packaging jobs upload artifacts via `actions/upload-artifact@v4`; a downstream **`publish-release`** job downloads all artifacts and creates/updates the GitHub Release using **`softprops/action-gh-release@v2`**.

**Rationale**:
- `softprops/action-gh-release` supports glob patterns for bulk artifact upload, creating the release and attaching assets in a single step.
- The `needs: [package-linux, package-windows]` dependency ensures all platform artifacts are ready before the release is created (satisfying FR-011 and FR-009).
- Release-please has already created the GitHub Release (as a draft) with the release notes when it pushed the tag; `action-gh-release` can update/overwrite the draft or create a new one.
- On `workflow_dispatch`, the version is taken from the workflow input (defaults to current `package.json` version read via `jq`).

---

## Decision 8: Tauri Vite Plugin Integration

**Decision**: Use `@tauri-apps/vite-plugin` (Tauri 2 official plugin) to integrate Tauri into the existing Vite config.

**Rationale**:
- Replaces the previous `@tauri-apps/cli` build invocation with a Vite plugin, providing:
  - Correct `devServer.url` injection for Tauri dev mode
  - `__TAURI_INTERNALS__` globals
  - Hot-reload support in Tauri window during development
- Minimal changes to `vite.config.ts` — add the plugin alongside the existing `@vitejs/plugin-react`.
- The existing `vite-plugin-pwa` configuration for the PWA manifest (from feature 022) continues to work in browser mode; in Tauri mode, the PWA manifest is ignored (native app has its own manifest via `tauri.conf.json`).

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| Desktop shell | Tauri 2 (NSIS + AppImage + .deb) |
| Versioning tool | release-please v4 (conventional commits) |
| Windows artifact format | NSIS .exe installer |
| Linux artifact formats | AppImage + .deb (both from single job) |
| Backend URL config | Compile-time default + runtime app.conf.json |
| CI runners | Native: ubuntu-latest + windows-latest |
| Artifact consolidation | upload-artifact → publish-release job |
| Vite integration | @tauri-apps/vite-plugin |
