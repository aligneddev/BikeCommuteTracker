# Quickstart: User Login with PIN

**Branch**: `003-user-login` | **Date**: 2026-03-17

## Prerequisites

- `001-user-signup-pin` feature is merged and the local stack runs cleanly via `dotnet run --project src/BikeTracking.AppHost`.
- Node.js 20+ and npm are available.
- The frontend builds successfully with `npm run build` in `src/BikeTracking.Frontend`.

---

## Step 1: Install React Router

Add `react-router-dom` to the frontend:

```bash
cd src/BikeTracking.Frontend
npm install react-router-dom@latest
```

TypeScript types are bundled in react-router-dom v7; no separate `@types/react-router-dom` package is needed.

---

## Step 2: Frontend Structure After This Feature

```text
src/BikeTracking.Frontend/src/
├── App.tsx                        ← Updated: wraps routes in BrowserRouter + AuthProvider
├── main.tsx                       ← Unchanged
├── context/
│   └── auth-context.tsx           ← NEW: AuthContext + AuthProvider + useAuth hook
├── components/
│   └── protected-route.tsx        ← NEW: ProtectedRoute wrapper for /miles
├── pages/
│   ├── login/
│   │   ├── login-page.tsx         ← NEW: Login form (name + PIN → /api/users/identify)
│   │   └── login-page.css         ← NEW: Login page styles
│   ├── signup/
│   │   ├── signup-page.tsx        ← UPDATED: Extracted Create User form only (Identify section removed)
│   │   └── signup-page.css        ← UNCHANGED (or minimal updates)
│   └── miles/
│       ├── miles-shell-page.tsx   ← NEW: Placeholder shell page post-login
│       └── miles-shell-page.css   ← NEW: Shell page minimal styles
└── services/
    └── users-api.ts               ← UPDATED: loginUser alias added
```

---

## Step 3: Key Implementation Notes

### AuthContext (`context/auth-context.tsx`)

```tsx
// Shape of the session object stored in sessionStorage
interface AuthSession {
  userId: number;
  userName: string;
}

// sessionStorage key
const SESSION_KEY = 'bike_tracking_auth_session';
```

- On mount: read `sessionStorage.getItem(SESSION_KEY)`, parse and set state if present.
- `login(session)`: set state + `sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))`.
- `logout()`: set state to null + `sessionStorage.removeItem(SESSION_KEY)`.

### ProtectedRoute (`components/protected-route.tsx`)

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

export function ProtectedRoute() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
```

### App.tsx Route Structure

```tsx
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<CreateUserPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/miles" element={<MilesShellPage />} />
      </Route>
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

### Login Flow (`pages/login/login-page.tsx`)

1. Validate name (non-empty) and PIN (4–8 digits) client-side.
2. Call `loginUser({ name, pin })` (alias for `identifyUser` in `users-api.ts`).
3. On 200: call `auth.login({ userId, userName })`, then `navigate('/miles')`.
4. On 401: show "Name or PIN is incorrect."
5. On 429: show "Too many attempts. Try again in N seconds."
6. Include a link to `/signup` for new users.

### Create User Page (`pages/signup/signup-page.tsx` refactor)

- Keep the signup form only; remove the Identify section.
- On successful signup, navigate to `/login` with the created name pre-populated (pass via router state: `navigate('/login', { state: { prefillName: name } })`).
- Include a link back to `/login` for returning users.

### Miles Shell Page (`pages/miles/miles-shell-page.tsx`)

- Read `user.userName` from `useAuth()`.
- Display: `"Welcome, {userName}. Your miles dashboard is coming soon."`
- Provide a logout button that calls `auth.logout()`.

### users-api.ts Update

Add `loginUser` as a named export alias:

```typescript
export function loginUser(payload: IdentifyRequest): Promise<ApiResult<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>> {
  return postJson<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>('/api/users/identify', payload);
}
```

The `identifyUser` export is retained to avoid breaking anything.

---

## Step 4: Validation Checklist

Run before committing:

```bash
# From src/BikeTracking.Frontend
npm run lint         # TypeScript ESLint + CSS stylelint
npm run build        # Ensure production build succeeds

# From repo root — full stack
dotnet run --project src/BikeTracking.AppHost  # Verify Aspire stack launches
```

Manual E2E verification:
1. Navigate to `/` → should redirect to `/login`.
2. Navigate to `/miles` without login → should redirect to `/login`.
3. Create a new user on `/signup` → should redirect to `/login`.
4. Login with the created user → should land on `/miles` showing the user's name.
5. Click logout → should return to `/login`.
6. Refresh the miles page while logged in → should stay on `/miles` (session restored from sessionStorage).
