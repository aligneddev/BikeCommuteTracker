# Contract: PWA Installation and Runtime Behavior

**Feature**: 022-pwa-local-install  
**Type**: Frontend/platform behavior contract  
**Status**: Draft

## 1. Supported Environment Contract (v1)

Install support is guaranteed only when all conditions are true:

- Operating system: Windows desktop
- Browser family: current Chrome or current Edge
- Browser install prerequisites: satisfied for the running app

If any condition is false, app must:

- Keep core browser usage available
- Show explicit guidance that installed-app support is unavailable in v1

## 2. Install Interaction Contract

When install is supported and prompt is available:

- App exposes a visible install action
- Install action triggers browser-native install flow
- On success, app can be launched from OS app launcher and opens in app-style window

Failure handling:

- On prompt dismissal or install failure, app shows non-blocking guidance and allows retry

## 3. Online-Only Operations Contract

For v1 installed mode:

- Ride operations require network connectivity
- If offline, app shows connectivity-required guidance and retry path
- App remains stable and navigable while operations are blocked

## 4. Update Lifecycle Contract

Installed app update behavior:

- Checks for updates on relaunch or refresh
- Applies latest available version automatically when available
- Exposes user-facing status for update in-progress and update failure states

State model:

- `idle -> checking -> downloading -> ready -> applied`
- Failure path: `checking/downloading -> failed`

## 5. Session Persistence Contract

Authentication behavior in installed mode:

- Session persists across launches up to 7 days inactivity
- Explicit sign-out immediately invalidates session
- On inactivity > 7 days, app requires sign-in before authenticated ride operations

## 6. Backend API Contract Impact

No mandatory API schema changes are introduced by this feature contract.

If implementation discovers backend compatibility needs for session timeout semantics, any API changes must be additive and documented in a follow-up contract update.
