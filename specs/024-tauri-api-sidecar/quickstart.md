# Quickstart Validation Guide: Bundle .NET API as Tauri Sidecar

**Phase 1 output for `024-tauri-api-sidecar`**

This guide describes how to validate the feature end-to-end once implemented. It is not an implementation guide — for implementation steps see `tasks.md` (Phase 2).

---

## Prerequisites

- DevContainer running (all tooling pre-configured)
- Rust stable toolchain installed (`rustup toolchain install stable`)
- Tauri system libraries present (pre-installed in DevContainer): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`
- .NET 10 SDK present (`dotnet --version` shows `10.x`)

---

## Scenario 1: Local Sidecar Smoke Test (Dev Mode)

Validates that the sidecar binary is correctly resolved and spawned by the Tauri host.

**Setup**:
```bash
# 1. Publish the API binary as self-contained for the current host (Linux x64 in DevContainer)
dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj \
  --configuration Release \
  --self-contained true \
  --runtime linux-x64 \
  -p:PublishSingleFile=true \
  --output /tmp/api-sidecar-test/

# 2. Place it at the expected Tauri sidecar path
cp /tmp/api-sidecar-test/BikeTracking.Api \
  src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
chmod +x src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
```

**Run**:
```bash
cd src/BikeTracking.Frontend
npm run tauri dev
```

**Expected**:
- Tauri window opens showing "Connecting…" spinner for ≤ 10 s
- Spinner transitions to the main app login screen automatically
- No "API connection" error message appears

---

## Scenario 2: Unit Test — `ApiStartupGuard` States

Validates the three component states (connecting, ready, error) and the Retry action in isolation.

**Run**:
```bash
cd src/BikeTracking.Frontend
npm run test:unit -- --reporter=verbose ApiStartupGuard
```

**Expected test coverage**:
- ✅ `connecting` state: spinner visible, app content hidden
- ✅ `ready` state: spinner gone, app content rendered (after mock fetch resolves 200)
- ✅ `error` state: error message + Retry button visible after 20 mock poll failures
- ✅ `Retry`: clicking Retry resets state to `connecting` and restarts polling
- ✅ fetch abort: component unmount cancels in-flight poll (no state update after unmount)

---

## Scenario 3: E2E — Startup Guard Flow

Validates the full connecting → ready transition against a live API.

**Prerequisites**: API running on `http://localhost:55436` (Aspire stack or manual start)

**Run**:
```bash
cd src/BikeTracking.Frontend
npm run test:e2e -- api-startup-guard
```

**Expected**:
- "Connecting…" indicator appears within 1 second of page load
- Indicator disappears and login page renders after API health check succeeds
- Test passes end-to-end in CI

---

## Scenario 4: Sidecar Termination on App Close

Validates FR-003 (SC-002): sidecar terminates within 5 seconds of app close.

**Run (Linux)**:
```bash
# Note the sidecar PID once app starts
ps aux | grep BikeTracking.Api

# Close the Tauri window (or Ctrl+C in the tauri dev terminal)
# Wait up to 5 seconds, then re-check:
sleep 5 && ps aux | grep BikeTracking.Api | grep -v grep
```

**Expected**: No `BikeTracking.Api` process appears after 5 seconds.

---

## Scenario 5: Error State — Missing Binary

Validates that a missing sidecar binary triggers the error state (not a crash).

**Setup**: Remove or rename the binary from `src-tauri/binaries/`.

**Run**: Launch the app (`npm run tauri dev`)

**Expected**:
- After 10 seconds, the error state is shown with a descriptive message and a Retry button
- The Tauri window does not crash or display a blank screen

---

## Scenario 6: CI Release Pipeline

Validates FR-008 — CI produces self-contained installers for both platforms.

**Trigger**: Push a release tag (`v*.*.*`) or run the `release` workflow with `dry_run: true`

**Expected** (see [contracts/ci-pipeline.md](./contracts/ci-pipeline.md)):
- `publish-api-windows` produces artefact `api-binary-windows` containing the renamed `.exe`
- `publish-api-linux` produces artefact `api-binary-linux` containing the renamed Linux binary
- `package-windows` and `package-linux` each download their respective API binary before `tauri build`
- NSIS installer (Windows) and `.deb` package (Linux) are uploaded as release artefacts
- If `publish-api-windows` or `publish-api-linux` fails, the downstream package job does not run

---

## Validation Checklist (maps to spec success criteria)

| Criterion | Validated By |
|---|---|
| SC-001: no manual .NET install needed | Scenario 1 (clean binary, no SDK on PATH) |
| SC-002: process terminates within 5 s | Scenario 4 |
| SC-003: "Connecting…" visible within 1 s | Scenario 3 (E2E timing assertion) |
| SC-004: error state after 10 s timeout | Scenario 2 (unit) + Scenario 5 (integration) |
| SC-005: CI produces installers automatically | Scenario 6 |
| SC-006: installer size increase ≤ 120 MB | Check installer file size diff in Scenario 6 |
