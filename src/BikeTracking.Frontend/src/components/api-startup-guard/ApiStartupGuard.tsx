import { useCallback, useEffect, useState } from 'react'
import { getApiBaseUrl } from '../../services/api-config'

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------

type ApiStartupStatus = 'connecting' | 'ready' | 'error'

/** Interval between successive health-check polls (ms) */
const HEALTH_POLL_INTERVAL_MS = 500

/** Maximum number of health-check attempts before entering the error state */
const HEALTH_POLL_MAX_ATTEMPTS = 20

// ---------------------------------------------------------------------------
// Component interface
// ---------------------------------------------------------------------------

interface ApiStartupGuardProps {
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// ApiStartupGuard
// ---------------------------------------------------------------------------

/**
 * Wraps the entire application router. Withholds rendering children until the
 * API health endpoint confirms readiness, showing a "Connecting…" spinner in
 * the interim. After HEALTH_POLL_MAX_ATTEMPTS failures, shows an error state
 * with a Retry action.
 *
 * Per health-poll contract state machine:
 *   connecting (initial) → ready (on 200 OK)
 *   connecting → error   (on attempt 20 without success)
 *   error → connecting   (on user click Retry)
 */
export function ApiStartupGuard({ children }: ApiStartupGuardProps): JSX.Element {
  const [status, setStatus] = useState<ApiStartupStatus>('connecting')

  // retryKey increments on each Retry click, restarting the polling effect
  const [retryKey, setRetryKey] = useState(0)

  const handleRetry = useCallback(() => {
    setStatus('connecting')
    setRetryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    // Fresh AbortController per mount / retry cycle
    const controller = new AbortController()
    const { signal } = controller

    let attempt = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function poll(): Promise<void> {
      if (signal.aborted) return

      attempt += 1

      try {
        // getApiBaseUrl() is called lazily at poll time (preserves Tauri injection timing)
        const url = `${getApiBaseUrl()}/health`
        const response = await fetch(url, { signal })

        if (signal.aborted) return

        if (response.ok) {
          setStatus('ready')
          return
        }
        // Non-200 falls through to the retry logic below
      } catch {
        if (signal.aborted) return
        // Network error — fall through to retry logic
      }

      if (signal.aborted) return

      if (attempt >= HEALTH_POLL_MAX_ATTEMPTS) {
        setStatus('error')
        return
      }

      // Schedule the next attempt
      timeoutId = setTimeout(poll, HEALTH_POLL_INTERVAL_MS)
    }

    // Kick off the first poll
    void poll()

    // Cleanup: abort any in-flight request and cancel any pending timeout
    return () => {
      controller.abort()
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [retryKey])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (status === 'ready') {
    return <>{children}</>
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <h2 style={{ marginBottom: '0.5rem' }}>Unable to connect to BikeTracking API</h2>
        <p style={{ marginBottom: '1.5rem', color: '#555' }}>
          The app was unable to start the local API after{' '}
          {HEALTH_POLL_MAX_ATTEMPTS * (HEALTH_POLL_INTERVAL_MS / 1000)} seconds. This may be
          caused by a missing or blocked API binary. Please close any conflicting processes on
          port 5079 and try again.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          style={{
            padding: '0.6rem 1.4rem',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // status === 'connecting'
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Connecting to BikeTracking API…"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          border: '4px solid #e0e0e0',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <p style={{ color: '#555', margin: 0 }}>Connecting…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
