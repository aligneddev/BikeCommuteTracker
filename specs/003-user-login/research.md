# Research: User Login with PIN

**Branch**: `003-user-login` | **Date**: 2026-03-17

## Unknowns Resolved

### 1. Client-Side Routing Library

**Decision**: Add `react-router-dom` v7 (latest stable) as a runtime dependency.

**Rationale**: The feature requires three independent, navigable pages: `/login`, `/signup`, and `/miles`. The current React app renders a single `<SignupPage />` with no routing. React Router v7 is the standard client-side routing library for React; it provides `<BrowserRouter>`, `<Routes>`, `<Route>`, `<Navigate>`, and `<Outlet>` for all required patterns. It is the router recommended by the React team and integrates cleanly with Vite.

**Alternatives considered**:
- `@tanstack/router` — more opinionated, type-safe, but heavier for three routes; not worth the added complexity at this stage.
- Manual hash-based routing — fragile, not maintainable, violates convention.
- No routing (single page with conditional rendering) — already done in the signup-pin feature; splits are explicitly required by the spec.

**Package version**: Verify latest with `mcp_nuget` patterns → use `npm install react-router-dom@latest` and confirm TypeScript types are bundled (they are in v7).

---

### 2. Client-Side Authentication State Strategy

**Decision**: React Context (`AuthContext`) backed by `sessionStorage` for the single-session login state.

**Rationale**:
- Spec assumption: no persistent login across browser sessions; `sessionStorage` fulfills this (clears on tab close).
- A `React.createContext` provider wraps the app router and exposes `{ user, login, logout }`. The `login` function stores `{ userId, userName }` to `sessionStorage`; the `logout` function removes it. On mount, the provider reads from `sessionStorage` to restore state after an in-session page reload.
- No cookies, no JWTs, no server-side session table required for the local-only scope.
- Simple shape: `{ userId: number; userName: string }`. Store under key `bike_tracking_auth_session`.

**Alternatives considered**:
- `localStorage` — persists across browser closes, violating the "no remember me" spec assumption.
- A third-party auth state library (e.g., Zustand, Redux Toolkit) — unnecessary complexity for a single object.
- Server-side sessions (HTTP cookies, ASP.NET Core session middleware) — out of scope for local-only flow; adds infrastructure complexity.

---

### 3. Protected Route Pattern

**Decision**: A single `<ProtectedRoute />` wrapper component using React Router's `<Outlet />` and `<Navigate to="/login" />` redirect.

**Rationale**: React Router v7 canonical pattern for auth protection is: a layout route component that checks auth context; if not authenticated, render `<Navigate to="/login" replace />`, otherwise render `<Outlet />`. All protected pages (`/miles` and any future pages) are nested under this wrapper in the route tree. This is the simplest, idiomatic approach with zero additional libraries.

**Alternatives considered**:
- Higher-order component wrapping each page individually — leads to duplication; single wrapper is DRY and easier to extend.
- Middleware-style approach — not applicable to client-side React routing.

---

### 4. API Endpoint Rename Strategy

**Decision**: Keep the backend `/api/users/identify` endpoint unchanged; rename only in the frontend API service layer.

**Rationale**:
- The spec says "Change Identify to login" in the UI context. The existing backend `identify` endpoint is functionally equivalent to login.
- Adding an API alias (`/api/users/login`) would be the correct long-term approach, but it introduces unnecessary backend churn for a frontend-only rename. The spec is frontend-scoped for this feature.
- The frontend `users-api.ts` will expose a `loginUser` function as an alias or rename of `identifyUser` to align with the Login page UX naming. Internal HTTP call still targets `/api/users/identify`.
- No API contract change; no migration risk.

**Alternatives considered**:
- Add `/api/users/login` endpoint on the backend as a proper rename — correct long-term; deferred to a future cleanup feature once the frontend is validated.
- Rename the identify endpoint in-place — breaking change to existing API contract; requires update to `signup-identify-api.yaml` and any consumers.

---

### 5. Miles Shell Page Scope

**Decision**: A minimal placeholder React page at `/miles` displaying the authenticated user's name and a "Miles coming soon" placeholder.

**Rationale**: Spec FR-009 only requires a structural placeholder. No miles data model, API endpoint, or service logic is created in this feature. The page should display the authenticated user's identity (from `AuthContext`) to confirm login success. A logout or navigation affordance is included for basic usability.

**Alternatives considered**:
- Empty page with no content — too minimal; user cannot confirm login success.
- Partial miles implementation — out of scope; violates minimal-first principle.
