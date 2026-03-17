import { type FormEvent, useState } from 'react'
import {
  identifyUser,
  signupUser,
  type ErrorResponse,
  type ThrottleResponse,
} from '../../services/users-api'
import './signup-page.css'

function validateInput(name: string, pin: string): string[] {
  const errors: string[] = []
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    errors.push('Name is required.')
  }

  if (!/^\d{4,8}$/.test(pin)) {
    errors.push('PIN must be numeric and 4 to 8 digits long.')
  }

  return errors
}

function toErrors(error: ErrorResponse | undefined): string[] {
  if (!error) {
    return ['Request failed.']
  }

  if (error.details && error.details.length > 0) {
    return error.details
  }

  return [error.message || 'Request failed.']
}

export function SignupPage() {
  const [signupName, setSignupName] = useState('')
  const [signupPin, setSignupPin] = useState('')
  const [identifyName, setIdentifyName] = useState('')
  const [identifyPin, setIdentifyPin] = useState('')

  const [signupErrors, setSignupErrors] = useState<string[]>([])
  const [identifyErrors, setIdentifyErrors] = useState<string[]>([])

  const [signupMessage, setSignupMessage] = useState('')
  const [identifyMessage, setIdentifyMessage] = useState('')
  const [throttleMessage, setThrottleMessage] = useState('')

  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false)
  const [isSubmittingIdentify, setIsSubmittingIdentify] = useState(false)

  async function submitSignup(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    setSignupMessage('')
    setThrottleMessage('')

    const validationErrors = validateInput(signupName, signupPin)
    setSignupErrors(validationErrors)

    if (validationErrors.length > 0) {
      return
    }

    setIsSubmittingSignup(true)

    try {
      const response = await signupUser({
        name: signupName,
        pin: signupPin,
      })

      if (response.ok && response.data) {
        setSignupMessage(
          `Created user ${response.data.userName} (id ${response.data.userId}). Event status: ${response.data.eventStatus}.`,
        )
        setIdentifyName(signupName)
        setSignupPin('')
        setSignupErrors([])
        return
      }

      setSignupErrors(toErrors(response.error as ErrorResponse | undefined))
    } catch {
      setSignupErrors(['Request failed. Check API connection and try again.'])
    } finally {
      setIsSubmittingSignup(false)
    }
  }

  async function submitIdentify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    setIdentifyMessage('')
    setThrottleMessage('')

    const validationErrors = validateInput(identifyName, identifyPin)
    setIdentifyErrors(validationErrors)

    if (validationErrors.length > 0) {
      return
    }

    setIsSubmittingIdentify(true)

    try {
      const response = await identifyUser({
        name: identifyName,
        pin: identifyPin,
      })

      if (response.ok && response.data) {
        setIdentifyMessage(`Authorized as ${response.data.userName} (id ${response.data.userId}).`)
        setIdentifyErrors([])
        setIdentifyPin('')
        return
      }

      if (response.status === 429) {
        const payload = response.error as ThrottleResponse | undefined
        const retryAfterSeconds =
          payload?.retryAfterSeconds ?? response.retryAfterSeconds ?? 1

        setThrottleMessage(`Too many attempts. Try again in ${retryAfterSeconds} seconds.`)
        setIdentifyErrors([])
        return
      }

      if (response.status === 401) {
        setIdentifyErrors(['Name or PIN is incorrect.'])
        return
      }

      setIdentifyErrors(toErrors(response.error as ErrorResponse | undefined))
    } catch {
      setIdentifyErrors(['Request failed. Check API connection and try again.'])
    } finally {
      setIsSubmittingIdentify(false)
    }
  }

  return (
    <main className="identity-flow">
      <h1>Create and Identify User</h1>
      <p className="intro">
        Local flow only: create a user with name and PIN, then identify with the same credentials.
      </p>

      <section className="card" aria-labelledby="signup-title">
        <h2 id="signup-title">Sign up</h2>

        <form onSubmit={submitSignup} noValidate>
          <label htmlFor="signup-name">Name</label>
          <input
            id="signup-name"
            type="text"
            value={signupName}
            onChange={(event) => setSignupName(event.target.value)}
            autoComplete="name"
          />

          <label htmlFor="signup-pin">PIN</label>
          <input
            id="signup-pin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={signupPin}
            onChange={(event) => setSignupPin(event.target.value)}
            autoComplete="new-password"
          />

          <button type="submit" disabled={isSubmittingSignup}>
            {isSubmittingSignup ? 'Creating...' : 'Create user'}
          </button>
        </form>

        {signupErrors.length > 0 && (
          <ul className="errors" aria-live="assertive">
            {signupErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        {signupMessage && (
          <p className="success" aria-live="polite">
            {signupMessage}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="identify-title">
        <h2 id="identify-title">Identify</h2>

        <form onSubmit={submitIdentify} noValidate>
          <label htmlFor="identify-name">Name</label>
          <input
            id="identify-name"
            type="text"
            value={identifyName}
            onChange={(event) => setIdentifyName(event.target.value)}
            autoComplete="username"
          />

          <label htmlFor="identify-pin">PIN</label>
          <input
            id="identify-pin"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={identifyPin}
            onChange={(event) => setIdentifyPin(event.target.value)}
            autoComplete="current-password"
          />

          <button type="submit" disabled={isSubmittingIdentify}>
            {isSubmittingIdentify ? 'Checking...' : 'Identify user'}
          </button>
        </form>

        {identifyErrors.length > 0 && (
          <ul className="errors" aria-live="assertive">
            {identifyErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        {throttleMessage && (
          <p className="warning" aria-live="polite">
            {throttleMessage}
          </p>
        )}

        {identifyMessage && (
          <p className="success" aria-live="polite">
            {identifyMessage}
          </p>
        )}
      </section>
    </main>
  )
}
