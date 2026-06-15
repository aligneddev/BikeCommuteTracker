# Contract: Frontend Health-Check Polling Protocol

**Scope**: `src/BikeTracking.Frontend/src/components/api-startup-guard/ApiStartupGuard.tsx`

---

## Overview

`ApiStartupGuard` is a React component that wraps the entire application router. It withholds rendering children until the API health endpoint confirms readiness, and exposes a Retry action when the timeout elapses.

---

## Component Interface

```typescript
interface ApiStartupGuardProps {
  children: React.ReactNode;
}

export function ApiStartupGuard({ children }: ApiStartupGuardProps): JSX.Element
```

No other props. The component reads `getApiBaseUrl()` internally at poll time — no URL prop is needed (see `src/services/api-config.ts`).

---

## State Machine

```
type ApiStartupStatus = 'connecting' | 'ready' | 'error';
```

| From | Event | To |
|---|---|---|
| `connecting` (initial / after Retry) | `GET /health` returns `200 OK` | `ready` |
| `connecting` | `GET /health` returns non-200 or network error, attempt < 20 | `connecting` (retry after 500 ms) |
| `connecting` | attempt = 20 without success | `error` |
| `error` | user clicks "Retry" button | `connecting` (attempt counter reset to 0) |

---

## Polling Parameters

| Parameter | Value | Constant Name |
|---|---|---|
| Poll interval | 500 ms | `HEALTH_POLL_INTERVAL_MS` |
| Max attempts | 20 | `HEALTH_POLL_MAX_ATTEMPTS` |
| Total timeout | 10 000 ms | derived |
| Health endpoint | `${getApiBaseUrl()}/health` | uses `getApiBaseUrl()` |
| Success condition | HTTP status `200` | |

---

## Fetch Behaviour

- Each poll uses `fetch(url, { signal })` with an `AbortController` signal
- A fresh `AbortController` is created per component mount / Retry cycle
- On unmount, the controller is aborted to cancel any in-flight request (prevents setState-after-unmount)
- Non-200 responses and network errors are treated equivalently (retry or timeout)
- No request headers required; the `/health` endpoint has no authentication gate

---

## Rendered Output by State

| Status | Rendered content |
|---|---|
| `connecting` | Spinner / "Connecting…" accessible indicator; `role="status"` |
| `ready` | `{children}` (the full app router) |
| `error` | Error message explaining the API failed to start + "Retry" button; `role="alert"` |

**Accessibility**:
- Connecting indicator: `aria-label="Connecting to BikeTracking API…"`, `role="status"`, `aria-live="polite"`
- Error state: `role="alert"`, `aria-live="assertive"`
- Retry button: standard `<button>` with descriptive text

---

## `App.tsx` Integration

```tsx
// Before:
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>...</AuthProvider>
    </BrowserRouter>
  );
}

// After:
function App() {
  return (
    <ApiStartupGuard>
      <BrowserRouter>
        <AuthProvider>...</AuthProvider>
      </BrowserRouter>
    </ApiStartupGuard>
  );
}
```

---

## Unit Test Contract

The following test cases MUST exist before implementation (TDD red-proof):

| Test ID | Description | Initial mock state | Expected DOM |
|---|---|---|---|
| `T-HSG-01` | Shows spinner while connecting | fetch never resolves | Spinner visible, app content absent |
| `T-HSG-02` | Renders children after 200 OK | fetch resolves 200 | Children rendered, spinner gone |
| `T-HSG-03` | Shows error after 20 failures | fetch rejects 20× | Error message + Retry button visible |
| `T-HSG-04` | Retry resets to connecting | fetch rejects 20×, user clicks Retry | Spinner visible again after Retry |
| `T-HSG-05` | Abort on unmount | fetch slow, component unmounts | No setState call after unmount (no console error) |

---

## Invariants

1. `children` is NEVER rendered while `status === 'connecting'` or `status === 'error'`
2. Poll stops immediately on first `200 OK` (no further fetches after transitioning to `ready`)
3. Poll stops immediately when attempt count reaches `HEALTH_POLL_MAX_ATTEMPTS` (transitions to `error`)
4. `getApiBaseUrl()` is called lazily at poll time, not at module import time (preserving the existing Tauri injection timing guarantee)
5. Component produces no observable side effects after unmount
