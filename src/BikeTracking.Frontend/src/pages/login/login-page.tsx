import { type FormEvent, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  loginUser,
  type ErrorResponse,
  type ThrottleResponse,
} from '../../services/users-api'
import { useAuth } from '../../context/auth-context'
import './login-page.css'

function validateInput(name: string, pin: string): string[] {
  const errors: string[] = []

  if (name.trim().length === 0) {
    errors.push('Name is required.')
  }

  if (!/^\d{4,8}$/.test(pin)) {
    errors.push('PIN must be numeric and 4 to 8 digits long.')
  }

  return errors
}

function toErrors(error: ErrorResponse | undefined): string[] {
  if (!error) return ['Request failed.']
  if (error.details && error.details.length > 0) return error.details
  return [error.message || 'Request failed.']
}

interface LocationState {
  prefillName?: string
}

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const [name, setName] = useState(state?.prefillName ?? '')
  const [pin, setPin] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [throttleMessage, setThrottleMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (state?.prefillName) {
      setName(state.prefillName)
    }
  }, [state?.prefillName])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setThrottleMessage('')

    const validationErrors = validateInput(name, pin)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return

    setIsSubmitting(true)
    try {
      const response = await loginUser({ name: name.trim(), pin })

      if (response.ok && response.data) {
        auth.login({ userId: response.data.userId, userName: response.data.userName })
        navigate('/miles')
        return
      }

      if (response.status === 429) {
        const payload = response.error as ThrottleResponse | undefined
        const seconds = payload?.retryAfterSeconds ?? response.retryAfterSeconds ?? 1
        setThrottleMessage(`Too many attempts. Try again in ${seconds} seconds.`)
        setErrors([])
        return
      }

      if (response.status === 401) {
        setErrors(['Name or PIN is incorrect.'])
        return
      }

      setErrors(toErrors(response.error as ErrorResponse | undefined))
    } catch {
      setErrors(['Request failed. Check your connection and try again.'])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <h1>Commute Bike Tracker</h1>

      <section className="card" aria-labelledby="login-title">
        <h2 id="login-title">Log in</h2>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-name">Name</label>
          <input
            id="login-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />

          <label htmlFor="login-pin">PIN</label>
          <input
            id="login-pin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="current-password"
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {errors.length > 0 && (
          <ul className="errors" aria-live="assertive">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        {throttleMessage && (
          <p className="warning" aria-live="polite">
            {throttleMessage}
          </p>
        )}
      </section>

      <p className="nav-link">
        New rider? <Link to="/signup">Create an account</Link>
      </p>
    </main>
  )
}
