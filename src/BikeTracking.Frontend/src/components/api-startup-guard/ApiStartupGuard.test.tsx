/**
 * Vitest unit tests for ApiStartupGuard
 *
 * TDD: These tests are written RED (before implementation).
 * They will fail with "Cannot find module" until ApiStartupGuard.tsx is created.
 *
 * Test IDs per health-poll contract:
 *   T-HSG-01: Spinner visible / children absent while fetch pending
 *   T-HSG-02: Children rendered after mock fetch resolves 200
 *   T-HSG-03: Error message + Retry button after 20 fetch rejections
 *   T-HSG-04: Retry click resets state to connecting
 *   T-HSG-05: AbortController aborts on unmount — no setState-after-unmount warning
 */

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiStartupGuard } from './ApiStartupGuard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Response with the given status */
function mockResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response
}

/** A fetch that resolves to the given status after an optional delay */
function fetchResolvingWith(status: number, delayMs = 0): typeof fetch {
  return vi.fn(
    () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(mockResponse(status)), delayMs),
      ),
  ) as unknown as typeof fetch
}

/** A fetch that rejects on every call */
function fetchAlwaysRejecting(): typeof fetch {
  return vi.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch
}

/** A fetch that never resolves (simulates indefinite pending) */
function fetchNeverResolves(): typeof fetch {
  return vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch
}

// ---------------------------------------------------------------------------
// T-HSG-01: Spinner visible / children absent while fetch pending
// ---------------------------------------------------------------------------
describe('T-HSG-01: connecting state', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows connecting spinner and hides children while fetch is pending', async () => {
    vi.stubGlobal('fetch', fetchNeverResolves())

    render(
      <ApiStartupGuard>
        <div data-testid="app-content">App loaded</div>
      </ApiStartupGuard>,
    )

    // Spinner should be visible
    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.getByText(/connecting/i)).toBeDefined()

    // Children must NOT be rendered
    expect(screen.queryByTestId('app-content')).toBeNull()

    vi.restoreAllMocks()
  })
})

// ---------------------------------------------------------------------------
// T-HSG-02: Children rendered after 200 OK
// ---------------------------------------------------------------------------
describe('T-HSG-02: ready state after 200 OK', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children and removes spinner after fetch returns 200', async () => {
    vi.stubGlobal('fetch', fetchResolvingWith(200))

    render(
      <ApiStartupGuard>
        <div data-testid="app-content">App loaded</div>
      </ApiStartupGuard>,
    )

    // Wait for the component to transition to ready
    await waitFor(() => screen.getByTestId('app-content'), { timeout: 3000 })

    // Children should now be rendered
    expect(screen.getByTestId('app-content')).toBeDefined()

    // Spinner should be gone
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-HSG-03: Error state after 20 consecutive failures
// ---------------------------------------------------------------------------
describe('T-HSG-03: error state after 20 failures', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows error message and Retry button after exhausting all 20 attempts', async () => {
    vi.stubGlobal('fetch', fetchAlwaysRejecting())

    render(
      <ApiStartupGuard>
        <div data-testid="app-content">App loaded</div>
      </ApiStartupGuard>,
    )

    // Advance timers enough to exhaust 20 attempts (each 500 ms apart).
    // Use advanceTimersByTimeAsync so microtasks (await fetch rejections) flush
    // between each synthetic timer tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000)
    })

    // Error state should be visible
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined()

    // App content must NOT be rendered
    expect(screen.queryByTestId('app-content')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-HSG-04: Retry resets state to connecting
// ---------------------------------------------------------------------------
describe('T-HSG-04: Retry resets to connecting state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows spinner again after clicking Retry in error state', async () => {
    vi.stubGlobal('fetch', fetchAlwaysRejecting())

    render(
      <ApiStartupGuard>
        <div data-testid="app-content">App loaded</div>
      </ApiStartupGuard>,
    )

    // Get to error state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000)
    })

    expect(screen.getByRole('alert')).toBeDefined()

    // Now install a never-resolving fetch so we stay in connecting after Retry
    vi.stubGlobal('fetch', fetchNeverResolves())

    // Click Retry
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    })

    // Should be back to connecting — spinner visible, no error
    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('app-content')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-HSG-05: AbortController aborts on unmount — no setState-after-unmount warning
// ---------------------------------------------------------------------------
describe('T-HSG-05: AbortController aborts on unmount', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not log a setState-after-unmount error when unmounted while fetch is pending', async () => {
    // Slow fetch that would resolve after the component is unmounted
    vi.stubGlobal('fetch', fetchResolvingWith(200, 500))

    const { unmount } = render(
      <ApiStartupGuard>
        <div data-testid="app-content">App loaded</div>
      </ApiStartupGuard>,
    )

    // Unmount before the fetch resolves
    unmount()

    // Wait for any deferred state updates that might fire after unmount
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800))
    })

    // No console.error calls related to setState after unmount
    const consoleErrorSpy = console.error as ReturnType<typeof vi.spyOn>
    const reactUnmountErrors = consoleErrorSpy.mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === 'string' &&
        (args[0].includes('unmounted') || args[0].includes('memory leak')),
    )
    expect(reactUnmountErrors).toHaveLength(0)
  })
})

