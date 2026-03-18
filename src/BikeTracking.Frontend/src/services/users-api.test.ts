import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { identifyUser, loginUser, signupUser } from './users-api'

const fetchMock = vi.fn<typeof fetch>()
const url = 'http://localhost:5436/api';

function jsonResponse(body: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

describe('users-api transport', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loginUser posts to identify endpoint with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ userId: 1, userName: 'Alice', authorized: true }, 200)
    )

    const payload = { name: 'Alice', pin: '1234' }
    const result = await loginUser(payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${url}/users/identify`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    )
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ userId: 1, userName: 'Alice', authorized: true })
  })

  it('identifyUser and loginUser both target identify endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ userId: 2, userName: 'Bob', authorized: true }, 200))
      .mockResolvedValueOnce(jsonResponse({ userId: 2, userName: 'Bob', authorized: true }, 200))

    await identifyUser({ name: 'Bob', pin: '5678' })
    await loginUser({ name: 'Bob', pin: '5678' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(`${url}/users/identify`)
    expect(fetchMock.mock.calls[1][0]).toBe(`${url}/users/identify`)
  })

  it('returns parsed error payload on non-success response', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: 'validation_failed',
          message: 'Validation failed.',
          details: ['Name is required.'],
        },
        400
      )
    )

    const result = await loginUser({ name: '', pin: '1234' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(result.error).toEqual({
      code: 'validation_failed',
      message: 'Validation failed.',
      details: ['Name is required.'],
    })
  })

  it('returns retry-after header and throttle payload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          code: 'throttled',
          message: 'Too many attempts. Try again later.',
          retryAfterSeconds: 5,
        },
        429,
        { 'Retry-After': '5' }
      )
    )

    const result = await loginUser({ name: 'Alice', pin: '0000' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(429)
    expect(result.retryAfterSeconds).toBe(5)
    expect(result.error).toEqual({
      code: 'throttled',
      message: 'Too many attempts. Try again later.',
      retryAfterSeconds: 5,
    })
  })

  it('returns undefined error when response body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Service unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    )

    const result = await signupUser({ name: 'Alice', pin: '1234' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(503)
    expect(result.error).toBeUndefined()
  })

  it('propagates fetch errors for caller-level handling', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(loginUser({ name: 'Alice', pin: '1234' })).rejects.toThrow('network down')
  })
})
