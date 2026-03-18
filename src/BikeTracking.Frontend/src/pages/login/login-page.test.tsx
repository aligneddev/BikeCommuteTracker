import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../context/auth-context'
import {
  loginUser,
  type ApiResult,
  type ErrorResponse,
  type IdentifySuccessResponse,
  type ThrottleResponse,
} from '../../services/users-api'
import { toErrors, validateInput } from './login-page.helpers'
import { LoginPage } from './login-page'

vi.mock('../../services/users-api', async () => {
  const actual = await vi.importActual<typeof import('../../services/users-api')>(
    '../../services/users-api'
  )

  return {
    ...actual,
    loginUser: vi.fn(),
  }
})

type LoginResult = ApiResult<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>
const mockedLoginUser = vi.mocked(loginUser)

function renderLogin(prefillName?: string) {
  const initialEntries = prefillName
    ? [{ pathname: '/login', state: { prefillName } }]
    : ['/login']

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/miles" element={<div>Miles Page</div>} />
          <Route path="/signup" element={<div>Signup Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('login-page helpers', () => {
  it('validateInput requires non-empty name', () => {
    expect(validateInput('   ', '1234')).toEqual(['Name is required.'])
  })

  it('validateInput rejects non numeric or out-of-range PIN', () => {
    expect(validateInput('Alice', '12')).toEqual([
      'PIN must be numeric and 4 to 8 digits long.',
    ])
    expect(validateInput('Alice', '12ab')).toEqual([
      'PIN must be numeric and 4 to 8 digits long.',
    ])
    expect(validateInput('Alice', '123456789')).toEqual([
      'PIN must be numeric and 4 to 8 digits long.',
    ])
  })

  it('validateInput returns no errors for valid name and PIN', () => {
    expect(validateInput(' Alice ', '12345678')).toEqual([])
  })

  it('toErrors returns fallback when error is missing', () => {
    expect(toErrors(undefined)).toEqual(['Request failed.'])
  })

  it('toErrors returns details when present', () => {
    expect(
      toErrors({
        code: 'validation_failed',
        message: 'Validation failed.',
        details: ['Name is required.'],
      })
    ).toEqual(['Name is required.'])
  })

  it('toErrors falls back to message when no details exist', () => {
    expect(
      toErrors({
        code: 'bad_request',
        message: 'Bad request.',
      })
    ).toEqual(['Bad request.'])
  })
})

describe('LoginPage component', () => {
  beforeEach(() => {
    mockedLoginUser.mockReset()
    sessionStorage.clear()
  })

  it('prefills name from navigation state', () => {
    renderLogin('Prefilled Rider')
    expect(screen.getByLabelText('Name')).toHaveValue('Prefilled Rider')
  })

  it('submits valid credentials, stores session, and navigates to miles', async () => {
    const user = userEvent.setup()
    const successResult: LoginResult = {
      ok: true,
      status: 200,
      data: { userId: 7, userName: 'Alice', authorized: true },
    }

    mockedLoginUser.mockResolvedValueOnce(successResult)
    renderLogin()

    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(mockedLoginUser).toHaveBeenCalledWith({ name: 'Alice', pin: '1234' })
    await screen.findByText('Miles Page')

    const rawSession = sessionStorage.getItem('bike_tracking_auth_session')
    expect(rawSession).toContain('Alice')
    expect(rawSession).toContain('7')
  })

  it('shows unauthorized message for 401 responses', async () => {
    const user = userEvent.setup()
    const unauthorizedResult: LoginResult = {
      ok: false,
      status: 401,
    }

    mockedLoginUser.mockResolvedValueOnce(unauthorizedResult)
    renderLogin()

    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('PIN'), '0000')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Name or PIN is incorrect.')).toBeVisible()
  })

  it('shows throttle message for 429 responses', async () => {
    const user = userEvent.setup()
    const throttledResult: LoginResult = {
      ok: false,
      status: 429,
      error: {
        code: 'throttled',
        message: 'Too many attempts. Try again later.',
        retryAfterSeconds: 5,
      },
    }

    mockedLoginUser.mockResolvedValueOnce(throttledResult)
    renderLogin()

    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('PIN'), '0000')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Too many attempts. Try again in 5 seconds.')
    ).toBeVisible()
  })

  it('renders API error details for non-401/non-429 failures', async () => {
    const user = userEvent.setup()
    const failedResult: LoginResult = {
      ok: false,
      status: 400,
      error: {
        code: 'validation_failed',
        message: 'Validation failed.',
        details: ['PIN is required.'],
      },
    }

    mockedLoginUser.mockResolvedValueOnce(failedResult)
    renderLogin()

    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('PIN is required.')).toBeVisible()
  })

  it('shows network error when request throws', async () => {
    const user = userEvent.setup()
    mockedLoginUser.mockRejectedValueOnce(new Error('network down'))
    renderLogin()

    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Request failed. Check your connection and try again.')
    ).toBeVisible()
  })

  it('disables submit and shows loading text while request is in flight', async () => {
    const user = userEvent.setup()

    let resolveRequest: ((value: LoginResult) => void) | undefined
    const pendingPromise = new Promise<LoginResult>((resolve) => {
      resolveRequest = resolve
    })

    mockedLoginUser.mockReturnValueOnce(pendingPromise)
    renderLogin()

    await user.type(screen.getByLabelText('Name'), 'Alice')
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const submitButton = screen.getByRole('button', { name: 'Logging in…' })
    expect(submitButton).toBeDisabled()

    resolveRequest?.({ ok: false, status: 401 })
    await screen.findByText('Name or PIN is incorrect.')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })
})
