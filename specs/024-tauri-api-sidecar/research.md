# Research: Bundle .NET API as Tauri Sidecar

**Phase 0 output for `024-tauri-api-sidecar`**

---

## R-001: Tauri v2 Sidecar Plugin API

**Decision**: Use `tauri-plugin-shell ^2` — the official Tauri v2 plugin for external-binary (sidecar) lifecycle management.

**Rationale**: Tauri v2 removed sidecar support from the core crate and moved it to the `tauri-plugin-shell` crate. This is the only supported first-party path. Custom `std::process::Command` spawning is possible but loses Tauri's target-triple resolution, embedded-binary path resolution, and the ability to register permissions in the capability system.

**Alternatives considered**:
- `std::process::Command` directly — rejected because it bypasses Tauri's binary path resolution and capability security model
- Third-party process manager crates — rejected; unnecessary complexity for a single managed child process

**Key API surface**:
```rust
// Cargo.toml
tauri-plugin-shell = "2"

// lib.rs — register plugin
.plugin(tauri_plugin_shell::init())

// lib.rs — spawn sidecar in setup
let sidecar_cmd = app.shell().sidecar("binaries/BikeTracking.Api")?;
let (_rx, child) = sidecar_cmd.spawn()?;

// lib.rs — kill on close
child.kill()?;
```

---

## R-002: Tauri v2 Sidecar Binary Naming Convention

**Decision**: Place binaries in `src-tauri/binaries/` with `{name}-{target-triple}[.exe]` filenames.

**Rationale**: Tauri v2 requires this exact naming so it can locate the correct binary for the build host's target triple at bundle time. The path declared in `tauri.conf.json` under `bundle.externalBin` must match (without the suffix).

**Convention**:

| Platform | File name in `src-tauri/binaries/` |
|---|---|
| Windows x64 | `BikeTracking.Api-x86_64-pc-windows-msvc.exe` |
| Linux x64 | `BikeTracking.Api-x86_64-unknown-linux-gnu` |

**`tauri.conf.json` entry**:
```json
"bundle": {
  "externalBin": ["binaries/BikeTracking.Api"]
}
```

**Rust sidecar identifier** (matches the `externalBin` path):
```rust
app.shell().sidecar("binaries/BikeTracking.Api")
```

**Alternatives considered**:
- Naming in a flat directory (no `binaries/` prefix) — works but collides with Tauri's own release binary naming; subdirectory is the documented convention
- Configurable binary path via app.conf.json — rejected; FR-011 explicitly prohibits user-configurable paths

---

## R-003: Tauri v2 Capability Permissions for Sidecar

**Decision**: Add a scoped `shell:allow-execute` permission entry plus `shell:allow-kill` to `capabilities/default.json`.

**Rationale**: Tauri v2's capability system enforces allowlisting for all plugin operations. Without an explicit permission, the shell plugin will refuse to execute or kill the sidecar binary.

**`capabilities/default.json` additions**:
```json
{
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        { "name": "binaries/BikeTracking.Api", "sidecar": true }
      ]
    },
    "shell:allow-kill"
  ]
}
```

**Alternatives considered**:
- Using `shell:default` — includes web content shell execution which is undesired; scoped `shell:allow-execute` is more restrictive
- No capability change — the plugin will throw a permission-denied error at runtime

---

## R-004: Self-Contained .NET 10 Publish for Windows and Linux

**Decision**: Use `dotnet publish --self-contained true --runtime {rid}` to produce a framework-independent native binary.

**Rationale**: FR-001 requires no .NET runtime on the user's machine. Self-contained publish embeds the runtime. Single-file publish (`-p:PublishSingleFile=true`) produces a single executable matching the Tauri binary naming convention.

**Commands**:
```bash
# Windows x64
dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj \
  --configuration Release \
  --self-contained true \
  --runtime win-x64 \
  -p:PublishSingleFile=true \
  --output api-publish-win/

# Linux x64
dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj \
  --configuration Release \
  --self-contained true \
  --runtime linux-x64 \
  -p:PublishSingleFile=true \
  --output api-publish-linux/
```

**Expected output binary names**:
- `api-publish-win/BikeTracking.Api.exe`
- `api-publish-linux/BikeTracking.Api`

**CI rename step** (to match Tauri naming convention before `tauri build`):
```bash
# Windows (PowerShell)
Copy-Item api-publish-win/BikeTracking.Api.exe src-tauri/binaries/BikeTracking.Api-x86_64-pc-windows-msvc.exe

# Linux (bash)
cp api-publish-linux/BikeTracking.Api src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
chmod +x src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
```

**Size estimate**: Self-contained .NET 10 binary is typically 60–90 MB. SC-006 allows up to 120 MB increase — within range.

**Alternatives considered**:
- `--self-contained false` — requires target machine to have .NET runtime; rejected per FR-001
- Multi-file publish (no `PublishSingleFile`) — produces a directory tree; Tauri sidecar requires a single executable entry point

---

## R-005: GitHub Actions CI Pipeline Strategy

**Decision**: Add two parallel jobs (`publish-api-windows`, `publish-api-linux`) that each run `dotnet publish` on the appropriate runner and upload the renamed binary as a GitHub Actions artefact. The existing `package-windows` and `package-linux` jobs each add a dependency on the relevant publish job and download the binary before running `tauri build`.

**Rationale**: Separating publish from bundle keeps the pipeline composable, matches the existing pattern (`build-frontend` artefact consumed by packaging jobs), and ensures a publish failure blocks the bundle (FR-008).

**Job dependency graph** (additions to existing `release.yml`):

```
build-frontend ──────────────────────┐
                                     ▼
publish-api-windows ──────► package-windows ──► publish-release
publish-api-linux ────────► package-linux ───► publish-release
smoke-test-api ────────────────────────────────────────────────┘
```

**Artefact names**:
- `api-binary-windows` — contains `BikeTracking.Api-x86_64-pc-windows-msvc.exe`
- `api-binary-linux` — contains `BikeTracking.Api-x86_64-unknown-linux-gnu`

**Alternatives considered**:
- Single cross-compilation job — .NET cross-compilation for self-contained binaries is not reliable (native dependencies in SQLite bindings); native runners are required
- Combining publish into the package jobs — rejected; violates single-responsibility and complicates cache management

---

## R-006: Frontend Health-Check Polling Strategy

**Decision**: A new `ApiStartupGuard` React component polls `GET {apiBaseUrl}/health` every 500 ms for up to 10 seconds (20 attempts). It renders a loading UI until success or renders an error UI with a Retry button on timeout.

**Rationale**: The existing `App.tsx` immediately renders the router without checking API readiness. On first launch, the sidecar takes 1–5 s to initialise. Without this guard, users see API connection errors on the first render. The `getApiBaseUrl()` function already resolves lazily from `window.__BIKE_API_URL__` — no changes to the service config layer are needed.

**State machine**:
```
connecting ──(200 OK)──► ready
connecting ──(10s timeout)──► error
error ──(Retry clicked)──► connecting
```

**Polling behaviour**:
- Interval: 500 ms
- Max attempts: 20 (10 s total)
- Stops polling immediately on success or timeout
- Uses `AbortController` to cancel in-flight fetch on unmount

**Alternatives considered**:
- WebSocket or Server-Sent Events for readiness signal — rejected; no server push mechanism exists and polling is simpler for a startup sequence
- Tauri event bus signal from Rust — possible but creates coupling between Rust and React; pure HTTP polling is simpler and testable without Tauri
- Single fetch with long timeout — rejected; does not allow incremental UI feedback
