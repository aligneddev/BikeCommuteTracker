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
    vi.useRealTimers()
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
    const stored = JSON.parse(sessionStorage.getItem('bike_tracking_auth_session') ?? '{}') as {
      userId?: number
      userName?: string
      lastActivityAtUtc?: string
      expiresAtUtc?: string
    }

    expect(stored.userId).toBe(42)
    expect(stored.userName).toBe('Alice')
    expect(stored.lastActivityAtUtc).toBeTypeOf('string')
    expect(stored.expiresAtUtc).toBeTypeOf('string')
  })

  it('clears an expired stored session before rendering protected state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T10:00:00.000Z'))

    sessionStorage.setItem(
      'bike_tracking_auth_session',
      JSON.stringify({
        userId: 99,
        userName: 'ExpiredUser',
        lastActivityAtUtc: '2026-05-10T09:59:59.000Z',
        expiresAtUtc: '2026-05-17T09:59:59.000Z',
      })
    )

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    expect(screen.getByTestId('auth-user')).toHaveTextContent('none')
    expect(sessionStorage.getItem('bike_tracking_auth_session')).toBeNull()
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
