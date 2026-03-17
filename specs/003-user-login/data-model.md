# Data Model: User Login with PIN

**Branch**: `003-user-login` | **Date**: 2026-03-17

## Overview

This feature introduces no new server-side entities. All data persistence for credential verification is handled by `User` and `UserCredential` from the `001-user-signup-pin` feature. The new data introduced is client-side only: an `AuthSession` object stored in `sessionStorage` for the duration of the browser session.

---

## Client-Side Entities

### AuthSession

Represents the active logged-in identity held in browser `sessionStorage`. Cleared when the session ends (browser tab closed).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `userId` | `number` | Non-null, positive integer | The server-assigned user ID from the identify API response |
| `userName` | `string` | Non-null, non-empty | The display name of the authenticated user returned from the API |

**Storage key**: `bike_tracking_auth_session`  
**Lifecycle**: Written on successful login; cleared on logout or browser session end; read on mount for in-session refresh recovery.  
**Security note**: No PIN, hash, or credential data is stored; this object contains only non-sensitive display identity.

---

## Frontend Component and State Model

### AuthContext

React Context that wraps the app router and provides auth state to all components.

| Field/Method | Type | Description |
|--------------|------|-------------|
| `user` | `AuthSession \| null` | Currently authenticated user, or `null` when not logged in |
| `login(session: AuthSession)` | `(session: AuthSession) => void` | Stores session to state and `sessionStorage`; called after successful API login |
| `logout()` | `() => void` | Clears state and `sessionStorage`; navigates to `/login` |

---

## Page Routes

| Route | Component | Protected | Description |
|-------|-----------|-----------|-------------|
| `/login` | `LoginPage` | No | Login form: name + PIN → calls `/api/users/identify`; on success sets auth session and navigates to `/miles` |
| `/signup` | `CreateUserPage` | No | Create user form: name + PIN → calls `/api/users/signup`; on success navigates to `/login` with prefilled name |
| `/miles` | `MilesShellPage` | Yes | Placeholder page; displays authenticated user's name; protected by `ProtectedRoute` |
| `/` | Redirect | No | Redirects to `/login` |

---

## State Transitions

```
[Not Authenticated]
        │
        ▼
   /login or /signup  ──────── Navigate ──────────▶  /signup or /login
        │
        │ Successful login (POST /api/users/identify)
        ▼
   AuthContext.login()
        │
        ▼
[Authenticated] ──────── Navigate ──────────────────▶ /miles
        │
        │ logout() or session ends
        ▼
[Not Authenticated] ─────────────────────────────────▶ /login
```

---

## Validation Rules

### Login Form

| Field | Rule | Error Message |
|-------|------|---------------|
| `name` | Non-empty after trim | "Name is required." |
| `pin` | Numeric, 4–8 digits | "PIN must be numeric and 4 to 8 digits long." |

Validation mirrors the existing signup form validation in `validateInput()`.

### Create User Form (unchanged behavior, moved to dedicated page)

Validation rules remain identical to the `SignupPage` implementation; the form is extracted into the new `CreateUserPage`.

---

## No New Server-Side Schema Changes

No database migrations are required. No new API endpoints are added. No F# domain type changes.
