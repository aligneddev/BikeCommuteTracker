# Contract: Sidecar Spawn and Kill

**Scope**: Rust host process (`src/BikeTracking.Frontend/src-tauri/src/lib.rs`)

---

## Overview

The Tauri host process is responsible for spawning and killing the API sidecar. This contract defines the exact Rust API surface, the shared state type, and the event hooks used to manage the sidecar lifecycle.

---

## State Type

```rust
/// Holds the running sidecar child process handle.
/// Wrapped in Mutex so the setup() closure and the window event handler can both access it.
struct SidecarState(Mutex<Option<CommandChild>>);
```

Registered with `app.manage(SidecarState(Mutex::new(None)))` before `.setup()` runs.

---

## Plugin Registration

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(SidecarState(Mutex::new(None)))
    // ... rest of builder
```

---

## Spawn Contract (`setup`)

Called once when the app starts, after the Tauri runtime is initialised.

**Inputs**: `&mut tauri::App`

**Side effects**:
- Spawns `binaries/BikeTracking.Api` as a sidecar child process
- Stores the `CommandChild` handle in `SidecarState`
- Injects `window.__BIKE_API_URL__` (existing behaviour, unchanged)

**Error behaviour**:
- If `sidecar("binaries/BikeTracking.Api")` fails (binary not found): log the error, do not panic; `SidecarState` remains `None`; the frontend will hit the 10 s error timeout
- If `.spawn()` fails (OS error, port conflict): same as above — log and continue

**Pseudo-code**:
```rust
.setup(|app| {
    // --- existing: inject API URL ---
    let api_base_url = read_api_base_url(app.handle());
    let window = app.get_webview_window("main").expect("main window not found");
    window.eval(&format!("window.__BIKE_API_URL__ = \"{}\";", api_base_url))?;

    // --- new: spawn sidecar ---
    match app.shell().sidecar("binaries/BikeTracking.Api") {
        Ok(cmd) => match cmd.spawn() {
            Ok((_rx, child)) => {
                *app.state::<SidecarState>().0.lock().unwrap() = Some(child);
            }
            Err(e) => eprintln!("[BikeTracking] Sidecar spawn failed: {e}"),
        },
        Err(e) => eprintln!("[BikeTracking] Sidecar resolve failed: {e}"),
    }

    Ok(())
})
```

---

## Kill Contract (`on_window_event`)

Called when a window emits `WindowEvent::Destroyed` (fires on normal close and forced quit).

**Side effects**:
- Takes `CommandChild` out of `SidecarState` (leaves `None`)
- Calls `child.kill()` — sends SIGKILL on Linux, `TerminateProcess` on Windows

**Contract**:
- At most one kill call per child handle (handle is taken, not cloned)
- `kill()` errors are logged but do not propagate; the window close completes regardless

**Pseudo-code**:
```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        let state = window.state::<SidecarState>();
        if let Some(child) = state.0.lock().unwrap().take() {
            if let Err(e) = child.kill() {
                eprintln!("[BikeTracking] Sidecar kill failed: {e}");
            }
        }
    }
})
```

---

## Capability Permission

File: `src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "Default capability for BikeTracking desktop app",
  "windows": ["main"],
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

---

## `tauri.conf.json` Addition

```json
"bundle": {
  "externalBin": ["binaries/BikeTracking.Api"],
  ...existing bundle config...
}
```

---

## Invariants

1. There is at most one live sidecar `CommandChild` at any time (enforced by the `Option` in `SidecarState`)
2. The child is always killed before the Tauri process exits (enforced by `WindowEvent::Destroyed`)
3. The sidecar binary path is never configurable at runtime (FR-011)
4. The sidecar name `"binaries/BikeTracking.Api"` must exactly match the `externalBin` entry in `tauri.conf.json`
