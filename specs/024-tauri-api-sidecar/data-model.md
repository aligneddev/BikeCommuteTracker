# Data Model: Bundle .NET API as Tauri Sidecar

**Phase 1 output for `024-tauri-api-sidecar`**

This feature introduces no new persistent entities. The data model section covers:
1. Runtime state machines (non-persistent)
2. Configuration values (compile-time constants)
3. Process lifecycle ownership

---

## 1. Sidecar Process State (Rust host — `lib.rs`)

Managed as shared `AppState` behind a `Mutex`. Not persisted; lives only for the duration of one app session.

```
State: SidecarProcessState
  None        — before setup() runs (initial state)
  Active(CommandChild) — sidecar spawned successfully
```

**Transitions**:

```
app.setup()
  ├─ spawn() OK  ──► Active(child)
  └─ spawn() Err ──► None  (startup error logged; app continues without sidecar)

WindowEvent::Destroyed
  ├─ Active(child) ──► child.kill() called ──► None
  └─ None ──► no-op
```

**Rust type**:
```rust
struct SidecarState(Mutex<Option<CommandChild>>);
```

---

## 2. Frontend API Startup Guard State (`ApiStartupGuard.tsx`)

A React component-local state machine. Not persisted; resets on every app launch or Retry action.

```
ApiStartupStatus enum:
  Connecting   — health check in progress (initial state)
  Ready        — GET /health returned 200
  Error        — 20 attempts exhausted without 200
```

**Transitions**:

```
mount / Retry
  └─► Connecting

Connecting + poll attempt ≤ 20
  ├─ fetch 200 OK  ──► Ready
  ├─ fetch non-200 / network error ──► stay Connecting (retry after 500 ms)
  └─ attempt = 20 without success ──► Error

Error
  └─ user clicks Retry ──► Connecting (resets attempt counter)
```

**React state shape**:
```typescript
type ApiStartupStatus = 'connecting' | 'ready' | 'error';

interface ApiStartupState {
  status: ApiStartupStatus;
  attemptCount: number;     // 0–20; reset to 0 on Retry
}
```

---

## 3. Configuration Constants (compile-time, not user-configurable)

| Constant | Value | Location | Notes |
|---|---|---|---|
| `SIDECAR_NAME` | `"binaries/BikeTracking.Api"` | `lib.rs` | Must match `externalBin` path in `tauri.conf.json` |
| `API_PORT` | `5079` | existing `app.conf.json` default | FR-010: fixed, not configurable |
| `HEALTH_POLL_INTERVAL_MS` | `500` | `ApiStartupGuard.tsx` | 500 ms between polls |
| `HEALTH_POLL_MAX_ATTEMPTS` | `20` | `ApiStartupGuard.tsx` | 20 × 500 ms = 10 s timeout |
| `HEALTH_ENDPOINT` | `/health` | `ApiStartupGuard.tsx` | Existing endpoint; no changes to API needed |

---

## 4. CI Artefact Naming (build-time)

| Artefact | File name | Job | Platform |
|---|---|---|---|
| API binary (Windows) | `BikeTracking.Api-x86_64-pc-windows-msvc.exe` | `publish-api-windows` | `windows-latest` |
| API binary (Linux) | `BikeTracking.Api-x86_64-unknown-linux-gnu` | `publish-api-linux` | `ubuntu-latest` |

**Destination in bundle job**: `src/BikeTracking.Frontend/src-tauri/binaries/`

These names are derived from the Tauri v2 sidecar naming convention (see `research.md` R-002). They are not user-visible and require no runtime configuration.

---

## 5. No Domain Model Changes

- No new EF Core entities
- No new domain events (F# layer unchanged)
- No new projections
- No new migrations
- SQLite data file path unchanged (`biketracking.local.db` in app-data directory)
