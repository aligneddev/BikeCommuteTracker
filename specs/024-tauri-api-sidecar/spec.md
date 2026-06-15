# Feature Specification: Bundle .NET API as Tauri Sidecar

**Feature Branch**: `024-tauri-api-sidecar`

**Created**: 2026-06-15

**Status**: Draft

**Input**: Bundle the .NET API as a Tauri sidecar so the installer is fully self-contained and the API starts automatically when the app launches.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and Run Without Setup (Priority: P1)

As a commuter who has just downloaded and run the BikeTracking installer on a fresh Windows or Linux machine, I want the app to start and be fully operational without needing to install .NET or start any extra services, so I can log my first ride immediately after installation.

**Why this priority**: This is the core problem being solved. Every other story depends on the API being bundled and auto-started. A fresh install that requires separate setup steps represents a broken product experience.

**Independent Test**: Perform a clean install of the BikeTracking installer on a machine with no .NET runtime installed. Launch the app. Verify the ride-tracking UI loads and all features function without any manual steps.

**Acceptance Scenarios**:

1. **Given** the BikeTracking installer is run on a machine with no prior .NET runtime, **When** installation completes and the app is launched, **Then** the full ride-tracking interface appears without any "API connection" error message.
2. **Given** the app is freshly launched, **When** the API is initialising (running database migrations), **Then** a "Connecting…" indicator is displayed rather than an error.
3. **Given** the app has fully started, **When** the user navigates any feature (record ride, view history, etc.), **Then** all API-backed features respond correctly.
4. **Given** the app is launched on a machine where it was previously installed, **When** the app opens, **Then** previously recorded ride data is still accessible.

---

### User Story 2 - Close the App Cleanly (Priority: P1)

As a user who closes the BikeTracking desktop app, I want the background API process to terminate automatically so there are no orphaned background processes consuming resources or locking data files after the app is closed.

**Why this priority**: Orphaned processes cause resource leaks, prevent re-launching the app cleanly, and erode user trust. This is a basic correctness requirement that must ship with the sidecar feature.

**Independent Test**: Open the app (confirm the API process is running via Task Manager / `ps`), close the main Tauri window, then verify no BikeTracking.Api process remains in the process list.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** the user closes the main window, **Then** the API background process is also terminated within 5 seconds.
2. **Given** the app is running, **When** the user force-quits the application, **Then** the API process does not linger as an orphaned process.
3. **Given** the app is restarted after a clean close, **When** it launches again, **Then** the API starts fresh without port-conflict errors or stale lock files.

---

### User Story 3 - Understand API Startup State (Priority: P2)

As a user who launches the app, I want clear feedback about whether the app is ready to use or still connecting, so I am never left staring at a blank screen or a confusing error when the API is still starting up.

**Why this priority**: SQLite migrations run on API startup and can take a few seconds. Without feedback, users may believe the app is broken and attempt to restart or re-install.

**Independent Test**: Launch the app and observe the loading phase. Measure the window between app window appearing and the UI becoming interactive. Verify a "Connecting…" state is visible during that window.

**Acceptance Scenarios**:

1. **Given** the app launches, **When** the API is not yet ready, **Then** a "Connecting…" or spinner indicator is visible within 1 second of the window opening.
2. **Given** the API becomes ready, **When** the health check succeeds, **Then** the "Connecting…" state transitions to the main app view without requiring a user action.
3. **Given** the API does not respond within 10 seconds, **When** the timeout elapses, **Then** an error state is displayed with a message explaining the API failed to start and offering a "Retry" action.
4. **Given** the user clicks "Retry" in the error state, **When** clicked, **Then** the app re-attempts the health-check polling sequence from the beginning.

---

### User Story 4 - Download Platform Installer from CI (Priority: P2)

As a project maintainer, I want the GitHub Actions release pipeline to automatically build the self-contained API binary, embed it in the Tauri installer, and publish both Windows and Linux packages as release artefacts, so each release is fully self-contained without manual build steps.

**Why this priority**: Without automated CI integration, every release requires manual intervention to produce the embedded binary, making the process error-prone and unsustainable.

**Independent Test**: Push a release tag; verify the GitHub Actions workflow runs, produces a Windows NSIS installer and a Linux `.deb` or `.AppImage` that each contain the API binary, and publishes them as GitHub Release artefacts.

**Acceptance Scenarios**:

1. **Given** a release tag is pushed, **When** the CI workflow completes, **Then** a Windows installer containing the self-contained API binary is published as a GitHub Release artefact.
2. **Given** a release tag is pushed, **When** the CI workflow completes, **Then** a Linux package containing the self-contained API binary is published as a GitHub Release artefact.
3. **Given** the API publish step fails, **When** the failure occurs, **Then** the downstream Tauri bundle step does not proceed and the release is not published.
4. **Given** the installer produced by CI is installed on a target machine, **When** the app is launched, **Then** the bundled API binary starts automatically (same as User Story 1).

---

### Edge Cases

- What happens when the API process crashes after successfully starting? The app should detect the lost connection and display a reconnection or error state rather than silently failing.
- What happens if port 5079 is already occupied by another process when the app starts? The API will fail to bind; the 10-second timeout will trigger the error state, allowing the user to close conflicting software and retry.
- What happens if the user has multiple instances of the app open? Each instance attempts to start an API on the same port; the second instance fails to bind, hits the timeout, and shows the error state. Concurrent instances are out of scope for this feature.
- What happens on Windows when anti-virus software blocks the unsigned sidecar binary? The app cannot start the API; the error state is shown. Code-signing is a prerequisite for a smooth Windows experience but is tracked separately.
- What happens if the installer does not contain the API binary (e.g., a broken CI build)? The app launches without a runnable sidecar and immediately enters the error state after the timeout.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The BikeTracking installer MUST include the .NET API executable bundled as a Tauri sidecar so no separate .NET runtime is required on the user's machine.
- **FR-002**: The API sidecar MUST start automatically when the Tauri app launches, before the main UI is rendered as interactive.
- **FR-003**: The API sidecar MUST be terminated automatically when the Tauri app process exits (normal close or forced quit).
- **FR-004**: The frontend MUST display a "Connecting…" or spinner state from the moment the app window opens until the API health endpoint responds with a success status.
- **FR-005**: The frontend MUST transition from the "Connecting…" state to the main app view automatically, without requiring any user interaction, once the API is healthy.
- **FR-006**: The frontend MUST display an actionable error state if the API does not become healthy within 10 seconds of app launch, including a "Retry" option.
- **FR-007**: The "Retry" action MUST restart the health-check polling sequence without requiring the user to relaunch the app.
- **FR-008**: The release CI workflow MUST publish the self-contained API binary for Windows (x64) and Linux (x64) as intermediate artefacts, and the Tauri bundle step MUST consume those artefacts to produce the final installer.
- **FR-009**: The API binary filenames MUST follow the Tauri sidecar naming convention so Tauri can locate them at runtime without configuration changes.
- **FR-010**: The API MUST continue to listen on port 5079 (the existing configured default) when launched as a sidecar.
- **FR-011**: The app MUST NOT require the user to configure a port, file path, or any other network setting to use the sidecar API.

### Key Entities

- **Sidecar Process**: The self-contained .NET API binary spawned and managed by the Tauri host process. Scoped to the lifetime of a single app session.
- **Health Endpoint**: The existing `GET /health` endpoint on the API, used by the frontend to determine API readiness. No new endpoint is needed.
- **Connecting State**: A transient frontend view shown while the API is starting. Replaces the current immediate error on app load.
- **Error State**: A frontend view shown when API startup times out or the connection is lost. Provides a Retry action.
- **CI Artefact**: The self-contained API binary produced by the `dotnet publish` step in the release workflow, uploaded so the Tauri bundle step can download and embed it.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user on a machine with no prior .NET runtime can install and launch BikeTracking and reach the functional app UI within 30 seconds of first launch, with zero manual configuration steps.
- **SC-002**: On app close, all BikeTracking API background processes are terminated within 5 seconds on both Windows and Linux.
- **SC-003**: The "Connecting…" feedback state is visible to the user within 1 second of the app window appearing, on every launch where the API has not yet responded.
- **SC-004**: If the API does not become healthy within 10 seconds, a descriptive error state with a Retry option is displayed rather than a blank screen or unformatted error message.
- **SC-005**: The release CI workflow produces self-contained installers for both Windows and Linux without any manual intervention, on every tagged release.
- **SC-006**: The installer file size increase from bundling the self-contained API binary does not exceed 120 MB over the current installer size (reasonable for a self-contained .NET binary).

---

## Assumptions

- The app is single-instance per user session; concurrent desktop instances of BikeTracking are not a supported scenario for this feature.
- Port 5079 remains the fixed, non-configurable port for the sidecar API; no mechanism for the user to change it is required.
- The `.NET 10` self-contained publish produces a standalone native binary that requires no system-level .NET installation on the target machine.
- The existing `GET /health` endpoint on the API is sufficient for readiness polling; no new dedicated startup endpoint is needed.
- Code-signing of the sidecar binary (for Windows SmartScreen / macOS Gatekeeper) is out of scope for this feature and will be addressed as a separate concern.
- macOS is not a target platform for this feature; only Windows (x64) and Linux (x64) are in scope.
- The Tauri v2 sidecar mechanism handles the process lifecycle (spawn on app start, kill on exit) via the `tauri-plugin-shell` crate; no custom process-management code beyond invoking the plugin API is needed.
- The frontend currently uses a hard-coded `window.__BIKE_API_URL__` injection by the Tauri setup function; this injection mechanism remains unchanged and the sidecar is expected to bind to the same URL.
- The existing smoke-test-api CI job that validates `/health` provides sufficient confidence that the API binary is functional after publish; no additional API integration tests are required for this feature.
