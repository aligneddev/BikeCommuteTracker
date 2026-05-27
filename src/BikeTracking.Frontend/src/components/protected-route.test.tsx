import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/auth-context'
import { ProtectedRoute } from './protected-route'

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/miles']}>
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/miles" element={<div>Protected Miles Page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
  })

  it('redirects unauthenticated users to /login', () => {
    renderProtectedRoute()

    expect(screen.getByText('Login Page')).toBeVisible()
  })

  it('renders protected content for authenticated users', () => {
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 5, userName: 'Alice' }))

    renderProtectedRoute()

    expect(screen.getByText('Protected Miles Page')).toBeVisible()
  })

  it('redirects expired sessions to /login and clears persisted session', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T10:00:00.000Z'))

    sessionStorage.setItem(
      'bike_tracking_auth_session',
      JSON.stringify({
        userId: 5,
        userName: 'Alice',
        lastActivityAtUtc: '2026-05-10T09:59:59.000Z',
        expiresAtUtc: '2026-05-17T09:59:59.000Z',
      })
    )

    renderProtectedRoute()

    expect(screen.getByText('Login Page')).toBeVisible()
    expect(sessionStorage.getItem('bike_tracking_auth_session')).toBeNull()
  })
})
