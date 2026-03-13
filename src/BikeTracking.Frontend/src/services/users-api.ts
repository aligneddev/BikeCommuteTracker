const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5436';

export interface SignupRequest {
  name: string;
  pin: string;
}

export interface SignupSuccessResponse {
  userId: number;
  userName: string;
  createdAtUtc: string;
  eventStatus: 'queued' | 'published';
}

export interface IdentifyRequest {
  name: string;
  pin: string;
}

export interface IdentifySuccessResponse {
  userId: number;
  userName: string;
  authorized: true;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: string[];
}

export interface ThrottleResponse {
  code: 'throttled';
  message: string;
  retryAfterSeconds: number;
}

export interface ApiResult<TSuccess, TError = ErrorResponse> {
  ok: boolean;
  status: number;
  data?: TSuccess;
  error?: TError;
  retryAfterSeconds?: number;
}

async function postJson<TSuccess, TError = ErrorResponse>(path: string, payload: unknown): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined;

  if (response.ok) {
    const data = (await response.json()) as TSuccess;
    return {
      ok: true,
      status: response.status,
      data,
      retryAfterSeconds,
    };
  }

  let parsedError: TError | undefined;
  try {
    parsedError = (await response.json()) as TError;
  } catch {
    parsedError = undefined;
  }

  return {
    ok: false,
    status: response.status,
    error: parsedError,
    retryAfterSeconds,
  };
}

export function signupUser(payload: SignupRequest): Promise<ApiResult<SignupSuccessResponse>> {
  return postJson<SignupSuccessResponse>('/api/users/signup', payload);
}

export function identifyUser(payload: IdentifyRequest): Promise<ApiResult<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>> {
  return postJson<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>('/api/users/identify', payload);
}
