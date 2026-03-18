import { createContext, useContext, useState, type ReactNode } from 'react'

export interface AuthSession {
  userId: number
  userName: string
}

interface AuthContextValue {
  user: AuthSession | null
  login: (session: AuthSession) => void
  logout: () => void
}

const SESSION_KEY = 'bike_tracking_auth_session'

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(() => readSession())

  function login(session: AuthSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
  }

  function logout(): void {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
