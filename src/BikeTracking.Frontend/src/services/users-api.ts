const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:5436";
const SESSION_KEY = "bike_tracking_auth_session";

export interface SignupRequest {
  name: string;
  pin: string;
}

export interface SignupSuccessResponse {
  userId: number;
  userName: string;
  createdAtUtc: string;
  eventStatus: "queued" | "published";
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

export interface UserSettingsUpsertRequest {
  averageCarMpg?: number | null;
  yearlyGoalMiles?: number | null;
  oilChangePrice?: number | null;
  mileageRateCents?: number | null;
  locationLabel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dashboardGallonsAvoidedEnabled?: boolean | null;
  dashboardGoalProgressEnabled?: boolean | null;
}

export interface UserSettingsView {
  averageCarMpg: number | null;
  yearlyGoalMiles: number | null;
  oilChangePrice: number | null;
  mileageRateCents: number | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  dashboardGallonsAvoidedEnabled: boolean;
  dashboardGoalProgressEnabled: boolean;
  updatedAtUtc: string | null;
}

export interface UserSettingsResponse {
  hasSettings: boolean;
  settings: UserSettingsView;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: string[];
}

export interface ThrottleResponse {
  code: "throttled";
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

function getAuthHeaders(contentTypeJson: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentTypeJson) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return headers;
    }

    const parsed = JSON.parse(raw) as { userId?: number };
    if (typeof parsed.userId === "number" && parsed.userId > 0) {
      headers["X-User-Id"] = parsed.userId.toString();
    }
  } catch {
    // Ignore malformed session payloads and continue unauthenticated.
  }

  return headers;
}

async function postJson<TSuccess, TError = ErrorResponse>(
  path: string,
  payload: unknown,
): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : undefined;

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

async function getJson<TSuccess, TError = ErrorResponse>(
  path: string,
): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: getAuthHeaders(false),
  });

  if (response.ok) {
    const data = (await response.json()) as TSuccess;
    return {
      ok: true,
      status: response.status,
      data,
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
  };
}

async function putJson<TSuccess, TError = ErrorResponse>(
  path: string,
  payload: unknown,
): Promise<ApiResult<TSuccess, TError>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const data = (await response.json()) as TSuccess;
    return {
      ok: true,
      status: response.status,
      data,
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
  };
}

export function signupUser(
  payload: SignupRequest,
): Promise<ApiResult<SignupSuccessResponse>> {
  return postJson<SignupSuccessResponse>("/api/users/signup", payload);
}

export function identifyUser(
  payload: IdentifyRequest,
): Promise<
  ApiResult<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>
> {
  return postJson<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>(
    "/api/users/identify",
    payload,
  );
}

export function loginUser(
  payload: IdentifyRequest,
): Promise<
  ApiResult<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>
> {
  return postJson<IdentifySuccessResponse, ErrorResponse | ThrottleResponse>(
    "/api/users/identify",
    payload,
  );
}

export function getUserSettings(): Promise<ApiResult<UserSettingsResponse>> {
  return getJson<UserSettingsResponse>("/api/users/me/settings");
}

export function saveUserSettings(
  payload: UserSettingsUpsertRequest,
): Promise<ApiResult<UserSettingsResponse>> {
  return putJson<UserSettingsResponse>("/api/users/me/settings", payload);
}
