# Delivery And Git Workflow

## Scope
Branching, PR, CI, and feature-flag governance.

## Required
- Follow trunk-based development with short-lived feature branches.
- Open PRs for all changes; do not push directly to main.
- Link each PR to a GitHub issue.
- Keep branches current with main before merge.
- Use feature flags for in-progress work merged to main.
- Limit active feature flags and remove them after rollout.
- Preserve owner-controlled final merge authority.

## CI Expectations
- Validation checks must pass before merge.
- Include build, formatting/linting, unit/integration checks, and E2E.

## Release Pipeline
- Installers are fully self-contained: .NET API bundled as Tauri sidecar binary alongside React frontend.
- Release workflow (`release.yml`) runs: `build-frontend` + `publish-api-windows` + `publish-api-linux` (parallel) → `package-windows` + `package-linux` → `smoke-test-api` → `publish-release`.
- `release-please` owns version files (`package.json`, `Cargo.toml`) in the repo via PRs — never commit version bumps directly to `main`.
- On manual dispatch without version input: versions patched in CI workspace only (no commit); artifact carries correct version, repo files unchanged.
- Binary naming for sidecar must follow Tauri triple convention: `BikeTracking.Api-x86_64-pc-windows-msvc.exe` (Windows), `BikeTracking.Api-x86_64-unknown-linux-gnu` (Linux).
