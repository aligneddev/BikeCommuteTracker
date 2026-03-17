# Tasks: User Login with PIN

**Input**: Design documents from `specs/003-user-login/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/login-api.yaml, quickstart.md

**Tests**: No explicit TDD or test-first request was made in the feature specification, so test tasks are not included in this task list.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the routing dependency required by all user stories.

- [X] T001 Install react-router-dom v7 dependency for the frontend in src/BikeTracking.Frontend (run: `npm install react-router-dom@latest` from src/BikeTracking.Frontend)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Client-side auth state management and route protection that every user story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T002 Create AuthContext, AuthProvider, and useAuth hook — reads and writes `bike_tracking_auth_session` from sessionStorage on mount/login/logout — in src/BikeTracking.Frontend/src/context/auth-context.tsx
- [X] T003 Create ProtectedRoute wrapper component — renders `<Outlet />` when authenticated or `<Navigate to="/login" replace />` when not — in src/BikeTracking.Frontend/src/components/protected-route.tsx

**Checkpoint**: Foundation is complete; user stories can now be implemented.

---

## Phase 3: User Story 1 - Login with Name and PIN (Priority: P1) 🎯 MVP

**Goal**: Allow a registered rider to submit name and PIN on the Login page, authenticate via `/api/users/identify`, and be redirected to the miles shell page on success.

**Independent Test**: Navigate to `/login` with an existing registered user's name and correct PIN; verify redirect to `/miles`. Submit an incorrect PIN and verify the error "Name or PIN is incorrect." remains on `/login` with no redirect. Navigate directly to `/miles` without logging in and verify redirect to `/login`.

### Implementation for User Story 1

- [X] T004 [P] [US1] Add `loginUser` named export alias (delegates to `identifyUser` targeting `POST /api/users/identify`) in src/BikeTracking.Frontend/src/services/users-api.ts
- [X] T005 [P] [US1] Create login page CSS with card layout and form styles (matching existing signup-page.css design tokens) in src/BikeTracking.Frontend/src/pages/login/login-page.css
- [X] T006 [US1] Create login page component with name + PIN form, client-side validation (non-empty name; numeric 4–8 digit PIN), error display for 401/429/network failures, auth.login() on success, and `navigate('/miles')` in src/BikeTracking.Frontend/src/pages/login/login-page.tsx
- [X] T007 [P] [US1] Create minimal miles shell page stub (renders a placeholder div; full implementation in Phase 5) in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.tsx
- [X] T008 [US1] Update App.tsx with BrowserRouter, AuthProvider, and full route tree: `/` → redirect to `/login`; `/login` → LoginPage; `/signup` → SignupPage (renaming existing default); ProtectedRoute layout wrapping `/miles` → MilesShellPage in src/BikeTracking.Frontend/src/App.tsx

**Checkpoint**: User Story 1 is complete — login flow is fully functional and testable end-to-end.

---

## Phase 4: User Story 2 - Navigate to Signup from Login (Priority: P2)

**Goal**: Split the existing combined Create User + Identify page into dedicated, independently navigable Login and Create User pages with bidirectional navigation links between them.

**Independent Test**: Visit `/login` and confirm a "Create account" link navigates to `/signup`. Visit `/signup` and confirm an "Already have an account?" link navigates to `/login`. Verify the Identify section is absent from `/signup`. Confirm a successful signup navigates to `/login` with the new user's name pre-filled in the name field.

### Implementation for User Story 2

- [X] T009 [P] [US2] Refactor signup-page.tsx: remove Identify section (submitIdentify handler, identify form JSX, identifyName/identifyPin/identifyErrors/identifyMessage state, setIdentifyName post-signup side-effect); add `useNavigate` to navigate to `/login` with `state: { prefillName: name }` on successful signup; add "Already have an account? Log in" link to `/login` in src/BikeTracking.Frontend/src/pages/signup/signup-page.tsx
- [X] T010 [P] [US2] Add "Create account" link to `/signup` in the LoginPage; read `useLocation().state?.prefillName` to pre-fill the name field when arriving from a successful signup in src/BikeTracking.Frontend/src/pages/login/login-page.tsx

**Checkpoint**: User Story 2 is complete — Login and Create User pages are independently navigable with clear bidirectional routing.

---

## Phase 5: User Story 3 - Post-Login Miles Shell Page (Priority: P3)

**Goal**: Replace the Phase 3 miles shell stub with a fully implemented placeholder page that displays the authenticated user's name, a welcome message, a logout button, and a placeholder for future miles content.

**Independent Test**: Log in as a registered user and verify the miles shell page displays: "Welcome, {userName}. Your miles dashboard is coming soon." Verify the logout button calls `auth.logout()` and navigates to `/login`. Verify navigating directly to `/miles` without authentication redirects to `/login`.

### Implementation for User Story 3

- [X] T011 [P] [US3] Create miles shell page styles (welcome section, logout button, miles placeholder content area) in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.css
- [X] T012 [US3] Implement full MilesShellPage component: read `user.userName` from `useAuth()`, render welcome message ("Welcome, {userName}. Your miles dashboard is coming soon."), render logout button calling `auth.logout()`, import and apply miles-shell-page.css in src/BikeTracking.Frontend/src/pages/miles/miles-shell-page.tsx

**Checkpoint**: User Story 3 is complete — miles shell page fully implements the post-login placeholder experience.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Static analysis and build verification across all implementation phases.

- [X] T013 Run `npm run lint` and `npm run build` in src/BikeTracking.Frontend to confirm TypeScript compiler and ESLint pass with zero errors
- [X] T014 Verify E2E smoke test: `/` redirects to `/login`; unauthenticated `/miles` redirects to `/login`; successful login redirects to `/miles` with correct user name displayed; logout returns to `/login` (also manually added playwright tests)

---

## Dependencies

User story completion order:

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1 MVP) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (Polish)
```

| Task | Depends On |
|------|------------|
| T002 | T001 |
| T003 | T001, T002 |
| T004 | T001 |
| T005 | — |
| T006 | T002, T004, T005 |
| T007 | T001 |
| T008 | T002, T003, T006, T007 |
| T009 | T001, T008 |
| T010 | T006, T008 |
| T011 | — |
| T012 | T002, T011 |
| T013 | T004–T012 |
| T014 | T013 |

---

## Parallel Execution Examples

- **Phase 3 (US1)**: T004 (users-api.ts), T005 (login-page.css), and T007 (miles shell stub) are fully independent and can run in parallel. T006 begins after T004 and T005 are complete. T008 (App.tsx) begins after T006 and T007.
- **Phase 4 (US2)**: T009 (signup-page.tsx) and T010 (login-page.tsx) touch different files with no shared state and can run in parallel.
- **Phase 5 (US3)**: T011 (miles-shell-page.css) is independent and can begin at any time. T012 begins after T011.

---

## Implementation Strategy

- **MVP (Phases 1–3)**: Delivers a fully functional login flow end-to-end. After T008, the app is testable: register a user at `/signup`, log in at `/login`, land on `/miles`. Phases 4 and 5 are independent extensions that do not block the MVP.
- **Incremental delivery**: US2 (Phase 4) and US3 (Phase 5) each build on the MVP independently and can be implemented sequentially or in a second batch.
- **Total tasks**: 14 (T001–T014)
- **Tasks by user story**: US1 = 5 tasks (T004–T008) | US2 = 2 tasks (T009–T010) | US3 = 2 tasks (T011–T012) | Setup = 1 | Foundational = 2 | Polish = 2
- **Parallel opportunities**: 3 in Phase 3, 2 in Phase 4, 1 in Phase 5
