import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
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
})
