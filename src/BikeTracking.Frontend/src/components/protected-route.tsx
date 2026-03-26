import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { AppHeader } from './app-header/app-header'

export function ProtectedRoute() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
