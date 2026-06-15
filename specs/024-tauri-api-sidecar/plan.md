# Implementation Plan: Bundle .NET API as Tauri Sidecar

**Branch**: `024-tauri-api-sidecar` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/024-tauri-api-sidecar/spec.md`

## Summary

Bundle the .NET 10 API as a self-contained native binary embedded in the Tauri v2 desktop installer. On launch, the Tauri host process spawns the API as a sidecar (via `tauri-plugin-shell`), and the React frontend polls `GET /health` before revealing the main UI. On close, the sidecar is killed automatically. The release CI pipeline publishes self-contained Windows and Linux binaries as intermediate artefacts that the Tauri bundle step downloads and embeds before producing the final installer.

## Technical Context

**Language/Version**:
- Rust stable — Tauri v2 host process (`src-tauri/`)
- C# / .NET 10 — API sidecar binary (`src/BikeTracking.Api/`)
- TypeScript / React 19 / Vite — Frontend (`src/BikeTracking.Frontend/src/`)

**Primary Dependencies**:
- `tauri = "^2"` (existing) — Tauri core
- `tauri-plugin-shell = "^2"` (**new**) — sidecar spawn/kill API
- `tauri-plugin-shell` JS bindings (**new**) — not used directly; the shell plugin is Rust-only for sidecar management
- `dotnet publish --self-contained true --runtime win-x64|linux-x64` — produces native binary requiring no system .NET installation

**Storage**: SQLite (existing, via EF Core; sidecar persists the existing `biketracking.local.db` in the Tauri app-data directory)

**Testing**:
- Rust: no new unit tests (thin glue code)
- Frontend unit: Vitest (`npm run test:unit`) — new tests for `ApiStartupGuard` component
- Frontend E2E: Playwright (`npm run test:e2e`) — new test covering connecting → ready transition
- Backend: `dotnet test BikeTracking.slnx` — no changes to existing tests

**Target Platform**: Windows x64, Linux x64 (macOS explicitly out of scope per spec)

**Project Type**: Desktop app (Tauri v2, packaged installer)

**Performance Goals**:
- Sidecar must reach `GET /health → 200` within 10 seconds of app launch (SC-003, SC-004)
- On app close, sidecar terminates within 5 seconds on both platforms (SC-002)
- Connecting feedback visible within 1 second of window appearing (SC-003)

**Constraints**:
- No .NET runtime on target machine (self-contained binary required — FR-001)
- Port 5079 is fixed; no user configuration required (FR-010, FR-011)
- Binary naming must follow Tauri sidecar convention: `{name}-{target-triple}[.exe]` (FR-009)
- Installer size increase must not exceed 120 MB (SC-006)

**Scale/Scope**: Single desktop user, single concurrent instance per machine

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — ✅ all gates clear.*

| Directive | Status | Notes |
|---|---|---|
| DevContainer development | ✅ Pass | No new tooling required outside DevContainer |
| Trunk-based delivery, PR-only merge | ✅ Pass | Feature on `024-tauri-api-sidecar` branch |
| TDD mandatory | ✅ Pass | `ApiStartupGuard` Vitest tests written red before implementation; E2E test covers startup flow |
| E2E on every PR | ✅ Pass | New Playwright test added for API startup guard |
| Ports-and-adapters | ✅ Pass | Sidecar management is infrastructure (`lib.rs`); no domain/app layer changes |
| Result-style values | ✅ Pass | Rust `Result` / `tauri::Error` used for spawn errors; no panics in the hot path |
| Event-sourced model unchanged | ✅ Pass | No domain event or projection changes |
| Local-first posture | ✅ Pass | Sidecar is a local binary; no cloud dependency added |

## Project Structure

### Documentation (this feature)

```text
specs/024-tauri-api-sidecar/
├── plan.md              # This file
├── research.md          # Phase 0: Tauri v2 sidecar API, binary naming, CI patterns
├── data-model.md        # Phase 1: State transitions, process lifecycle, frontend states
├── quickstart.md        # Phase 1: End-to-end validation guide
├── contracts/
│   ├── sidecar-spawn.md # Phase 1: Rust sidecar spawn/kill contract
│   ├── health-poll.md   # Phase 1: Frontend health-poll protocol
│   └── ci-pipeline.md   # Phase 1: CI artefact pipeline contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/BikeTracking.Frontend/
├── src/
│   ├── components/
│   │   └── api-startup-guard/
│   │       ├── ApiStartupGuard.tsx          # NEW: wraps app with connecting/error/ready states
│   │       └── ApiStartupGuard.test.tsx     # NEW: Vitest unit tests (red-proof required)
│   └── App.tsx                              # MODIFIED: wrapped by ApiStartupGuard
├── tests/e2e/
│   └── api-startup-guard.spec.ts            # NEW: Playwright E2E — startup guard flow
└── src-tauri/
    ├── binaries/                            # NEW directory (git-ignored binaries, placeholder README)
    │   ├── .gitkeep
    │   └── README.md                        # Documents naming convention for CI download step
    ├── Cargo.toml                           # MODIFIED: add tauri-plugin-shell = "^2"
    ├── src/
    │   └── lib.rs                           # MODIFIED: register plugin, spawn sidecar, kill on close
    ├── tauri.conf.json                      # MODIFIED: add bundle.externalBin
    └── capabilities/
        └── default.json                     # MODIFIED: add shell sidecar execute permission

.github/workflows/
└── release.yml                              # MODIFIED: add publish-api-windows / publish-api-linux jobs;
                                             # update package-windows / package-linux to download + place binary
```

**Structure Decision**: Minimal footprint — no new projects or packages. All changes are confined to:
1. Tauri Rust host (`src-tauri/`) — plugin registration and sidecar lifecycle
2. React frontend (`src/`) — `ApiStartupGuard` component for startup UX
3. CI pipeline (`release.yml`) — parallel API publish jobs feeding into existing bundle jobs

## Complexity Tracking

> No constitution violations — table not required.
