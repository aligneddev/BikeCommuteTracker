import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { AppHeader } from './app-header/app-header'
import { isInactivityExpired } from '../services/pwa/session-policy'

export function ProtectedRoute() {
  const { user, logout } = useAuth()
  const sessionExpired =
    user === null ||
    !user.lastActivityAtUtc ||
    isInactivityExpired(user.lastActivityAtUtc)

  if (!user || sessionExpired) {
    if (user && sessionExpired) {
      logout()
    }

    return <Navigate to="/login" replace />
  }

  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
