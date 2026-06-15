---

description: "Task list for Bundle .NET API as Tauri Sidecar"
---

# Tasks: Bundle .NET API as Tauri Sidecar

**Input**: Design documents from `specs/024-tauri-api-sidecar/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅ (sidecar-spawn.md, health-poll.md, ci-pipeline.md)

**Tests**: TDD is mandatory per constitution directive 3. Vitest unit tests for `ApiStartupGuard` and a Playwright E2E test are explicitly required by plan.md. Rust glue code has no new unit tests (thin integration — validated by quickstart scenarios).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the `binaries/` directory skeleton and gitignore rules before any implementation begins. No source code changes — all tasks independent.

- [X] T001 Create `src/BikeTracking.Frontend/src-tauri/binaries/.gitkeep` (empty placeholder so the directory is tracked by git)
- [X] T002 [P] Create `src/BikeTracking.Frontend/src-tauri/binaries/README.md` documenting: (a) Tauri sidecar naming convention `{name}-{target-triple}[.exe]`, (b) expected filenames `BikeTracking.Api-x86_64-pc-windows-msvc.exe` and `BikeTracking.Api-x86_64-unknown-linux-gnu`, (c) that real binaries are populated by CI only and must not be committed
- [X] T003 [P] Add gitignore entries to `.gitignore` (repo root) to exclude sidecar binaries: `src/BikeTracking.Frontend/src-tauri/binaries/*.exe` and `src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-*`

**Checkpoint**: `binaries/` directory exists in git with README; real binaries are git-ignored.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire in the `tauri-plugin-shell` dependency, register it in the Tauri builder, configure `tauri.conf.json` and `capabilities/default.json`, and scaffold the `SidecarState` managed state. These must all be complete before either spawn (US1) or kill (US2) logic can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Add `tauri-plugin-shell = "2"` to `[dependencies]` in `src/BikeTracking.Frontend/src-tauri/Cargo.toml`
- [X] T005 [P] Add `"externalBin": ["binaries/BikeTracking.Api"]` to the `bundle` object in `src/BikeTracking.Frontend/src-tauri/tauri.conf.json` (alongside existing bundle configuration)
- [X] T006 [P] Add sidecar permissions to `src/BikeTracking.Frontend/src-tauri/capabilities/default.json`: replace or extend the `permissions` array to include `{ "identifier": "shell:allow-execute", "allow": [{ "name": "binaries/BikeTracking.Api", "sidecar": true }] }` and `"shell:allow-kill"` alongside the existing `"core:default"` entry
- [X] T007 Add `SidecarState(Mutex<Option<CommandChild>>)` struct, register `tauri_plugin_shell::init()` plugin, and call `app.manage(SidecarState(Mutex::new(None)))` in `src/BikeTracking.Frontend/src-tauri/src/lib.rs` (depends on T004 — requires `tauri-plugin-shell` in Cargo.toml; add necessary `use` imports: `tauri_plugin_shell::process::CommandChild`, `std::sync::Mutex`)

**Checkpoint**: Foundation ready — `cargo check` passes; plugin registered; state type compiles; `tauri.conf.json` and capabilities updated.

---

## Phase 3: User Story 1 — Install and Run Without Setup (Priority: P1) 🎯 MVP

**Goal**: The Tauri host process spawns the API sidecar binary on app startup so a fresh-install user reaches the functional app UI without a .NET runtime or manual steps.

**Independent Test**: Publish the API as a self-contained Linux x64 binary (see quickstart.md Scenario 1), place it at `src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu`, run `npm run tauri dev` from `src/BikeTracking.Frontend`, and verify the Tauri window opens and does not show an "API connection" error within 10 seconds.

### Implementation for User Story 1

- [X] T008 [US1] Implement sidecar spawn in the `setup()` closure in `src/BikeTracking.Frontend/src-tauri/src/lib.rs`: call `app.shell().sidecar("binaries/BikeTracking.Api")?`, call `.spawn()` on the returned command, store the returned `CommandChild` via `*app.state::<SidecarState>().0.lock().unwrap() = Some(child)`, and log (not panic) on any `Err` variant per sidecar-spawn contract (depends on T007)

**Checkpoint**: App launches, sidecar binary is spawned by the Tauri host, and the process appears in `ps aux | grep BikeTracking.Api` while the app is running. Quickstart Scenario 1 passes.

---

## Phase 4: User Story 2 — Close the App Cleanly (Priority: P1)

**Goal**: The API sidecar process is automatically terminated when the user closes the Tauri window — no orphaned processes, no port-lock stale files on restart.

**Independent Test**: With the app running (sidecar visible in `ps`), close the main Tauri window, then run `sleep 5 && ps aux | grep BikeTracking.Api | grep -v grep` — verify no process remains. (Quickstart Scenario 4.)

**Dependency**: Requires US1 (T008) — the `CommandChild` stored in `SidecarState` during spawn is consumed here.

### Implementation for User Story 2

- [X] T009 [US2] Implement `on_window_event` handler in `src/BikeTracking.Frontend/src-tauri/src/lib.rs`: match on `tauri::WindowEvent::Destroyed`, take the `CommandChild` out of `SidecarState` with `.take()`, call `child.kill()`, log any kill error without propagating, allowing the window close to complete regardless (depends on T008; per sidecar-spawn contract kill invariants)

**Checkpoint**: App close terminates the sidecar within 5 seconds on Linux. Quickstart Scenarios 2 (clean close) and 3 (restart after close has no port-conflict error) pass.

---

## Phase 5: User Story 3 — Understand API Startup State (Priority: P2)

**Goal**: The frontend shows a "Connecting…" spinner from window-open until the health check succeeds, transitions automatically to the main app, and shows a descriptive error + Retry if the timeout elapses.

**Independent Test**: Run `npm run test:unit -- --reporter=verbose ApiStartupGuard` (all 5 unit test cases pass). Run `npm run test:e2e -- api-startup-guard` against a running API — "Connecting…" appears within 1 second, transitions to login page. (Quickstart Scenarios 2 and 5.)

### Tests for User Story 3 (TDD — write RED before implementation) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before writing ApiStartupGuard.tsx**

- [X] T010 [P] [US3] Write Vitest unit tests in `src/BikeTracking.Frontend/src/components/api-startup-guard/ApiStartupGuard.test.tsx` covering all five cases from the health-poll contract: T-HSG-01 (spinner visible / children absent while fetch pending), T-HSG-02 (children rendered after mock fetch resolves 200), T-HSG-03 (error message + Retry button after 20 fetch rejections), T-HSG-04 (Retry click resets state to connecting), T-HSG-05 (AbortController aborts on unmount — no setState-after-unmount warning); mock global `fetch` via `vi.stubGlobal`; confirm all tests FAIL with "cannot find module" or similar before implementation (⚠️ RED checkpoint)
- [X] T011 [P] [US3] Write Playwright E2E test in `src/BikeTracking.Frontend/tests/e2e/api-startup-guard.spec.ts`: navigate to app root, assert an element with `role="status"` and text matching `/connecting/i` is visible within 1000ms of page load, then assert it disappears and the login page renders once the health check succeeds against a live API on `http://localhost:55436`; confirm test FAILS when run without the guard in place (⚠️ RED checkpoint)

### Implementation for User Story 3

- [X] T012 [US3] Implement `ApiStartupGuard` component in `src/BikeTracking.Frontend/src/components/api-startup-guard/ApiStartupGuard.tsx`: define `ApiStartupStatus` type (`'connecting' | 'ready' | 'error'`), `HEALTH_POLL_INTERVAL_MS = 500`, `HEALTH_POLL_MAX_ATTEMPTS = 20`, polling loop with `AbortController` cleanup on unmount, render spinner with `role="status"` and `aria-live="polite"` while connecting, render error with `role="alert"` and Retry button after exhausting attempts, render `{children}` when ready — per health-poll contract state machine and invariants (depends on T010 RED checkpoint)
- [X] T013 [US3] Wrap the application router with `<ApiStartupGuard>` in `src/BikeTracking.Frontend/src/App.tsx`: import `ApiStartupGuard` from `./components/api-startup-guard/ApiStartupGuard` and wrap the outermost JSX element so `ApiStartupGuard` is the root component (depends on T012)

**Checkpoint**: `npm run test:unit -- ApiStartupGuard` shows all 5 test cases green. `npm run test:e2e -- api-startup-guard` passes. App shows "Connecting…" on launch and transitions automatically.

---

## Phase 6: User Story 4 — Download Platform Installer from CI (Priority: P2)

**Goal**: The GitHub Actions release pipeline automatically builds self-contained Windows and Linux API binaries, embeds them in the Tauri installer, and publishes both packages as release artefacts without manual steps.

**Independent Test**: Push a release tag (or trigger `release.yml` with `dry_run: true`). Verify `publish-api-windows` and `publish-api-linux` jobs succeed and upload artefacts, `package-windows` and `package-linux` download and embed those artefacts, and both installer artefacts are published. Verify that failing a publish job blocks the downstream package job. (Quickstart Scenario 6.)

### Implementation for User Story 4

- [X] T014 [P] [US4] Add `publish-api-windows` job to `.github/workflows/release.yml`: runs on `windows-latest`, no `needs` (parallel with `build-frontend`), 15-minute timeout; steps: checkout, `actions/setup-dotnet` using `global.json`, `dotnet restore BikeTracking.slnx`, `dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj --configuration Release --self-contained true --runtime win-x64 -p:PublishSingleFile=true --output api-publish-win/ --no-restore`, `Rename-Item api-publish-win/BikeTracking.Api.exe BikeTracking.Api-x86_64-pc-windows-msvc.exe` (PowerShell), upload artefact `api-binary-windows` from path `api-publish-win/BikeTracking.Api-x86_64-pc-windows-msvc.exe` with `retention-days: 1`
- [X] T015 [P] [US4] Add `publish-api-linux` job to `.github/workflows/release.yml`: runs on `ubuntu-latest`, no `needs` (parallel with `build-frontend`), 15-minute timeout; steps: checkout, `actions/setup-dotnet` using `global.json`, `dotnet restore BikeTracking.slnx`, `dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj --configuration Release --self-contained true --runtime linux-x64 -p:PublishSingleFile=true --output api-publish-linux/ --no-restore`, `mv api-publish-linux/BikeTracking.Api api-publish-linux/BikeTracking.Api-x86_64-unknown-linux-gnu && chmod +x api-publish-linux/BikeTracking.Api-x86_64-unknown-linux-gnu`, upload artefact `api-binary-linux` from path `api-publish-linux/BikeTracking.Api-x86_64-unknown-linux-gnu` with `retention-days: 1`
- [X] T016 [US4] Update `package-windows` job in `.github/workflows/release.yml`: add `publish-api-windows` to its `needs` list, and insert an `actions/download-artifact@v4` step (name: `api-binary-windows`, path: `src/BikeTracking.Frontend/src-tauri/binaries/`) immediately before the `tauri build` step (depends on T014)
- [X] T017 [US4] Update `package-linux` job in `.github/workflows/release.yml`: add `publish-api-linux` to its `needs` list, insert an `actions/download-artifact@v4` step (name: `api-binary-linux`, path: `src/BikeTracking.Frontend/src-tauri/binaries/`) and a `chmod +x src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu` step immediately before the `tauri build` step (depends on T015)

**Checkpoint**: `release.yml` has the correct 5-job dependency graph (`publish-api-windows` + `publish-api-linux` → `package-windows` + `package-linux` → `publish-release`). A publish-job failure prevents the downstream bundle step.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate edge cases from spec, confirm quickstart scenarios pass end-to-end, and verify installer size stays within SC-006 bounds.

- [X] T018 [P] Validate quickstart Scenario 5 (missing binary error state): remove the binary from `src/BikeTracking.Frontend/src-tauri/binaries/`, run `npm run tauri dev`, confirm the error state (not a crash or blank screen) is shown after 10 seconds and the Retry button is present
- [X] T019 [P] Validate installer size constraint (SC-006): after a successful CI build, compare the Windows and Linux installer sizes against their pre-sidecar baselines and confirm the delta does not exceed 120 MB per installer
- [X] T020 Verify `cargo check` and `cargo clippy` pass with no new warnings in `src/BikeTracking.Frontend/src-tauri/` after all Rust changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately; T002 and T003 are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
  - T004, T005, T006 are parallel (different files)
  - T007 depends on T004 (plugin crate must be in Cargo.toml first)
- **US1 (Phase 3)**: Depends on Foundational (T007 complete)
- **US2 (Phase 4)**: Depends on US1 (T008) — consumes `CommandChild` stored in spawn
- **US3 (Phase 5)**: Depends on Foundational (T007 complete); independent of US1/US2
  - T010 and T011 (test writing) are parallel and must FAIL before T012
  - T012 depends on T010 RED checkpoint
  - T013 depends on T012
- **US4 (Phase 6)**: Depends on Foundational (Phase 2); independent of US1/US2/US3
  - T014 and T015 are parallel (different YAML job blocks)
  - T016 depends on T014; T017 depends on T015
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational; no story dependencies
- **US2 (P1)**: Depends on US1 (needs the `CommandChild` handle from spawn)
- **US3 (P2)**: Depends on Foundational; independent of US1/US2 (pure frontend work)
- **US4 (P2)**: Depends on Foundational; independent of US1/US2/US3 (pure CI work)

### Within Each User Story

- TDD gate for US3: T010 and T011 must be written and confirmed FAILING before T012 begins
- US2 kill logic follows US1 spawn logic in the same file — do not implement kill before spawn
- CI jobs T014/T015 (new publish jobs) must exist before T016/T017 (updating existing jobs)

---

## Parallel Opportunities

### Phase 2 (Foundational) — run in parallel

```bash
# These three tasks touch different files:
Task T004: Edit src/BikeTracking.Frontend/src-tauri/Cargo.toml
Task T005: Edit src/BikeTracking.Frontend/src-tauri/tauri.conf.json
Task T006: Edit src/BikeTracking.Frontend/src-tauri/capabilities/default.json
# Then T007 (lib.rs) after T004 lands
```

### Phase 5 (US3) — TDD tests in parallel

```bash
# Both test files can be written simultaneously:
Task T010: src/BikeTracking.Frontend/src/components/api-startup-guard/ApiStartupGuard.test.tsx
Task T011: src/BikeTracking.Frontend/tests/e2e/api-startup-guard.spec.ts
```

### Phase 6 (US4) — publish jobs in parallel

```bash
# Two new CI jobs targeting different runners:
Task T014: publish-api-windows job (windows-latest)
Task T015: publish-api-linux job (ubuntu-latest)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — sidecar spawns on launch
4. Complete Phase 4: US2 — sidecar killed on close
5. **STOP and VALIDATE**: Run quickstart Scenarios 1 and 4; confirm sidecar starts and terminates correctly
6. Users can install and use the app end-to-end; startup guard (US3) polishes the UX; CI pipeline (US4) automates releases

### Incremental Delivery

1. Setup + Foundational → plugin wired in, state scaffolded
2. US1 → Sidecar spawns ✅
3. US2 → Sidecar killed on close ✅ ← **Functional MVP**
4. US3 → Startup guard UX: "Connecting…" / error / retry ✅
5. US4 → CI produces self-contained installers ✅
6. Polish → edge-case validation, size check, lint clean

### Single Developer Strategy

Work stories strictly in priority order:

1. Phase 1 → Phase 2 → US1 → US2 (P1 pair complete)
2. US3 (frontend-only, no Rust dependency after Phase 2)
3. US4 (CI-only, independent of all source changes)
4. Phase 7 polish

---

## Notes

- **[P]** tasks modify different files with no shared write dependencies — safe to run concurrently
- **[Story]** label maps each task to its user story for independent traceability and demo
- US3 is the only story with explicit TDD: unit tests (T010) must be red-committed before T012
- Rust glue code (US1 + US2) has no new unit tests by design (plan.md explicit); validated by quickstart scenarios and E2E
- `binaries/` directory must exist in git before any `tauri build` command runs (Phase 1 blocks everything)
- Binary naming (`BikeTracking.Api-{triple}[.exe]`) is a hard constraint — any deviation silently breaks sidecar resolution at runtime
- Port 5079 is fixed and non-configurable; no task should introduce a configuration mechanism
