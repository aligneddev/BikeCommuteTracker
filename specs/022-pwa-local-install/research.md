# Research: Local PWA Installation

**Feature**: 022-pwa-local-install  
**Date**: 2026-05-20  
**Status**: Complete

## Decision 1: Installability Approach

**Decision**: Implement installability as a standards-based PWA shell for the existing frontend, using a valid web app manifest, service worker registration, and explicit install UI entry point in-app.

**Rationale**: This directly satisfies local install goals for Chrome/Edge on Windows without introducing native packaging, and keeps delivery aligned with the current React + Vite architecture.

**Alternatives considered**:
- Native desktop wrappers (Electron/Tauri): rejected for v1 due to larger runtime footprint and additional release complexity.
- Browser-only usage with no install support: rejected because it fails FR-001 through FR-005.

## Decision 2: Supported Environment Scope

**Decision**: v1 install support is Windows desktop on current Chrome and Edge only; all other environments are explicitly unsupported for install but remain supported for browser usage.

**Rationale**: A focused support matrix reduces ambiguity and test matrix size, enabling reliable first-release behavior while preserving access for non-supported environments.

**Alternatives considered**:
- Multi-OS v1 support (Windows + macOS + Linux): rejected due to increased validation and support overhead.
- Best-effort all-browser support: rejected because it weakens testability and acceptance criteria.

## Decision 3: Offline Policy for v1

**Decision**: v1 installed app is online-only for ride operations.

**Rationale**: This keeps feature scope centered on installation and launch UX, avoids introducing queue/sync conflict complexity, and aligns with current backend-dependent ride workflows.

**Alternatives considered**:
- Full offline create/edit with later sync: rejected for v1 due to complexity and conflict-resolution requirements.
- Read-only offline mode: rejected because it still requires additional caching and invalidation logic not needed for initial install milestone.

## Decision 4: Update Behavior

**Decision**: Installed app updates automatically to latest available version on relaunch or refresh, with clear update-in-progress/failure messaging.

**Rationale**: Automatic updates minimize support burden and reduce long-lived outdated clients while preserving simple user expectations.

**Alternatives considered**:
- Manual update trigger only: rejected as higher UX friction and higher stale-version risk.
- Reinstall-only updates: rejected due to poor usability.

## Decision 5: Session Persistence Rule

**Decision**: Keep user signed in for up to 7 days of inactivity, then require re-authentication.

**Rationale**: Balances convenience and security for a locally installed daily-use app; prevents indefinite stale sessions.

**Alternatives considered**:
- Indefinite sign-in: rejected for higher security risk on shared devices.
- Sign-in every launch: rejected for unnecessary friction.

## Decision 6: Contract Surface

**Decision**: Treat PWA behavior as a frontend/platform contract (manifest/service-worker/install/update/session state transitions) with no mandatory backend API schema changes for v1.

**Rationale**: The feature requirements are primarily runtime/client behavior; keeping backend contracts stable minimizes risk and implementation time.

**Alternatives considered**:
- New backend install-state endpoints: rejected as unnecessary for initial scope.
- Persisting install metadata server-side: rejected because installability is environment-local and not cross-device in v1.
