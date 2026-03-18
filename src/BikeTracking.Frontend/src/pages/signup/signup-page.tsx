import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  signupUser,
  type ErrorResponse,
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
  const navigate = useNavigate()

  const [signupName, setSignupName] = useState('')
  const [signupPin, setSignupPin] = useState('')

  const [signupErrors, setSignupErrors] = useState<string[]>([])
  const [signupMessage, setSignupMessage] = useState('')

  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false)

  async function submitSignup(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    setSignupMessage('')

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
        navigate('/login', { state: { prefillName: signupName } })
        return
      }

      setSignupErrors(toErrors(response.error as ErrorResponse | undefined))
    } catch {
      setSignupErrors(['Request failed. Check API connection and try again.'])
    } finally {
      setIsSubmittingSignup(false)
    }
  }

  return (
    <main className="identity-flow">
      <h1>Commute Bike Tracker</h1>

      <section className="card" aria-labelledby="signup-title">
        <h2 id="signup-title">Create account</h2>

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
            {isSubmittingSignup ? 'Creating...' : 'Create account'}
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

      <p className="nav-link">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  )
}