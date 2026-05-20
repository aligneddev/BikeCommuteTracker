import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  computeExpiryFromActivity,
  isInactivityExpired,
  makeActivityTimestamp,
} from '../services/pwa/session-policy'

export interface AuthSession {
  userId: number
  userName: string
  lastActivityAtUtc?: string
  expiresAtUtc?: string
}

interface AuthContextValue {
  user: AuthSession | null
  login: (session: AuthSession) => void
  logout: () => void
}

const SESSION_KEY = 'bike_tracking_auth_session'

const AuthContext = createContext<AuthContextValue | null>(null)

function withActivityMetadata(session: AuthSession, now: Date = new Date()): AuthSession {
  const lastActivityAtUtc = makeActivityTimestamp(now)
  return {
    ...session,
    lastActivityAtUtc,
    expiresAtUtc: computeExpiryFromActivity(lastActivityAtUtc),
  }
}

function isValidSession(session: Partial<AuthSession>): session is AuthSession {
  return typeof session.userId === 'number' && session.userId > 0 && typeof session.userName === 'string'
}

function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (!isValidSession(parsed)) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }

    if (parsed.lastActivityAtUtc && isInactivityExpired(parsed.lastActivityAtUtc)) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }

    if (!parsed.lastActivityAtUtc || !parsed.expiresAtUtc) {
      const migrated = withActivityMetadata(parsed)
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(migrated))
      return migrated
    }

    return parsed
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(() => readSession())

  function login(session: AuthSession): void {
    const storedSession = withActivityMetadata(session)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession))
    setUser(storedSession)
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
