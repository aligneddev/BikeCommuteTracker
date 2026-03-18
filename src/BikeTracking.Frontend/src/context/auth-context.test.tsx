import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth-context'

function AuthProbe() {
  const { user, login, logout } = useAuth()

  return (
    <>
      <div data-testid="auth-user">{user ? `${user.userId}:${user.userName}` : 'none'}</div>
      <button
        type="button"
        onClick={() => {
          login({ userId: 42, userName: 'Alice' })
        }}
      >
        Login
      </button>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </>
  )
}

describe('auth-context', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('initializes user from sessionStorage', () => {
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 7, userName: 'Bob' }))

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-user')).toHaveTextContent('7:Bob')
  })

  it('falls back to null user when sessionStorage JSON is invalid', () => {
    sessionStorage.setItem('bike_tracking_auth_session', '{invalid-json}')

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-user')).toHaveTextContent('none')
  })

  it('login updates state and writes sessionStorage', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByTestId('auth-user')).toHaveTextContent('42:Alice')
    expect(sessionStorage.getItem('bike_tracking_auth_session')).toBe(
      JSON.stringify({ userId: 42, userName: 'Alice' })
    )
  })

  it('logout clears state and sessionStorage', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(screen.getByTestId('auth-user')).toHaveTextContent('none')
    expect(sessionStorage.getItem('bike_tracking_auth_session')).toBeNull()
  })

  it('throws when useAuth is called outside AuthProvider', () => {
    const originalConsoleError = console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<AuthProbe />)).toThrow('useAuth must be used inside AuthProvider')

    consoleErrorSpy.mockRestore()
    console.error = originalConsoleError
  })
})
