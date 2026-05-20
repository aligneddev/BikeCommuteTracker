# Data Model: Local PWA Installation

**Feature**: 022-pwa-local-install  
**Date**: 2026-05-20  
**Status**: Complete

## Overview

This feature introduces client-side runtime state models for installability, launch context, update lifecycle, and 7-day inactivity session timeout. No new server database entities are required for v1.

## Entities

### 1. InstallationState

Represents install capability and install progression for the current environment.

| Field | Type | Description |
|------|------|-------------|
| `isInstallSupported` | boolean | Whether current browser+OS matches v1 support matrix and install prerequisites are satisfied |
| `installPromptAvailable` | boolean | Whether install prompt can be triggered in current session |
| `status` | enum | `unavailable` \| `available` \| `prompting` \| `installed` \| `failed` |
| `reasonCode` | enum? | Optional code for unavailable/failed states (`unsupported_os`, `unsupported_browser`, `prompt_dismissed`, `policy_blocked`) |
| `lastTransitionAtUtc` | string (ISO-8601) | Timestamp for diagnostics and telemetry correlation |

**Validation rules**:
- `status=installed` implies `isInstallSupported=true`.
- `reasonCode` required when `status` is `unavailable` or `failed`.

### 2. LaunchContext

Represents app runtime context at startup.

| Field | Type | Description |
|------|------|-------------|
| `mode` | enum | `browser_tab` \| `installed_window` |
| `isOnline` | boolean | Network availability at startup |
| `platform` | enum | `windows` \| `non_windows` |
| `browserFamily` | enum | `chrome` \| `edge` \| `other` |
| `appVersion` | string | Current loaded app version identifier |

**Validation rules**:
- `mode=installed_window` only valid when install criteria were previously met.
- `platform=non_windows` forces `InstallationState.status=unavailable` for v1 support policy.

### 3. SessionState

Represents authenticated state persistence across launches with inactivity expiration.

| Field | Type | Description |
|------|------|-------------|
| `isAuthenticated` | boolean | Rider is currently authenticated |
| `lastActivityAtUtc` | string (ISO-8601) | Last authenticated user activity timestamp |
| `expiresAtUtc` | string (ISO-8601) | Computed expiration timestamp (`lastActivityAtUtc + 7 days`) |
| `expiredByInactivity` | boolean | True when reopening after expiration threshold |

**Validation rules**:
- When `nowUtc > expiresAtUtc`, app must set `isAuthenticated=false` and require sign-in.
- Explicit sign-out invalidates session regardless of inactivity timer.

### 4. UpdateState

Represents automatic update lifecycle for installed instances.

| Field | Type | Description |
|------|------|-------------|
| `status` | enum | `idle` \| `checking` \| `downloading` \| `ready` \| `applied` \| `failed` |
| `targetVersion` | string? | Version being applied |
| `lastCheckedAtUtc` | string (ISO-8601) | Last update check timestamp |
| `failureReason` | string? | Optional failure message for user guidance |

**Validation rules**:
- `failureReason` required when `status=failed`.
- Transition `ready -> applied` occurs on relaunch or refresh.

## State Transitions

### InstallationState transitions

`unavailable -> available -> prompting -> installed`

Failure path:

`available -> prompting -> failed -> available`

### SessionState transitions

`authenticated(active) -> authenticated(inactive) -> expiredByInactivity -> unauthenticated`

Sign-out path:

`authenticated -> unauthenticated`

### UpdateState transitions

`idle -> checking -> downloading -> ready -> applied`

Failure path:

`checking/downloading -> failed -> checking`

## Persistence Notes

- `SessionState` persistence must survive installed-app relaunches.
- `InstallationState`, `LaunchContext`, and `UpdateState` are runtime and telemetry-oriented state; persistence can be ephemeral unless needed for diagnostics.
- Domain data (rides, users, projections) remains in existing SQLite storage and is unchanged by this feature.
