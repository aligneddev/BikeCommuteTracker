export interface RecordRideRequest {
  rideDateTimeLocal: string;
  miles: number;
  rideMinutes?: number;
  temperature?: number;
}

export interface RecordRideSuccessResponse {
  rideId: number;
  riderId: number;
  savedAtUtc: string;
  eventStatus: string;
}

export interface RideDefaultsResponse {
  hasPreviousRide: boolean;
  defaultMiles?: number;
  defaultRideMinutes?: number;
  defaultTemperature?: number;
  defaultRideDateTimeLocal: string;
}

export interface EditRideRequest {
  rideDateTimeLocal: string;
  miles: number;
  rideMinutes?: number;
  temperature?: number;
  expectedVersion: number;
}

export interface EditRideResponse {
  rideId: number;
  newVersion: number;
  message: string;
}

export interface EditRideConflictResponse {
  code: "RIDE_VERSION_CONFLICT";
  message: string;
  currentVersion: number;
}

export interface EditRideErrorResult {
  code: string;
  message: string;
  currentVersion?: number;
}

export type EditRideResult =
  | { ok: true; value: EditRideResponse }
  | { ok: false; error: EditRideErrorResult };

/**
 * Aggregated miles and ride count for a defined period (thisMonth, thisYear, allTime, or filtered).
 */
export interface MileageSummary {
  miles: number;
  rideCount: number;
  period: "thisMonth" | "thisYear" | "allTime" | "filtered";
}

/**
 * A single ride row for display in the history grid.
 */
export interface RideHistoryRow {
  rideId: number;
  rideDateTimeLocal: string;
  miles: number;
  rideMinutes?: number;
  temperature?: number;
}

/**
 * Nested container for summary totals by period.
 */
export interface RideHistorySummaries {
  thisMonth: MileageSummary;
  thisYear: MileageSummary;
  allTime: MileageSummary;
}

/**
 * Full response for GET /api/rides/history endpoint: summaries + filtered total + paged rows.
 */
export interface RideHistoryResponse {
  summaries: RideHistorySummaries;
  filteredTotal: MileageSummary;
  rides: RideHistoryRow[];
  page: number;
  pageSize: number;
  totalRows: number;
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:5436";
const SESSION_KEY = "bike_tracking_auth_session";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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

async function parseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message && payload.message.length > 0) {
      return payload.message;
    }
  } catch {
    // Response was not JSON.
  }

  return fallback;
}

export async function recordRide(
  request: RecordRideRequest,
): Promise<RecordRideSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/rides`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to record ride"));
  }

  return response.json();
}

export async function getRideDefaults(): Promise<RideDefaultsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/rides/defaults`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorMessage(response, "Failed to fetch ride defaults"),
    );
  }

  return response.json();
}

export async function editRide(
  rideId: number,
  request: EditRideRequest,
): Promise<EditRideResult> {
  const response = await fetch(`${API_BASE_URL}/api/rides/${rideId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (response.ok) {
    return { ok: true, value: (await response.json()) as EditRideResponse };
  }

  try {
    if (response.status === 409) {
      const payload = (await response.json()) as EditRideConflictResponse;
      return {
        ok: false,
        error: {
          code: payload.code,
          message: payload.message,
          currentVersion: payload.currentVersion,
        },
      };
    }

    const payload = (await response.json()) as {
      code?: string;
      message?: string;
      currentVersion?: number;
    };

    return {
      ok: false,
      error: {
        code: payload.code ?? `HTTP_${response.status}`,
        message: payload.message ?? "Failed to edit ride",
        currentVersion: payload.currentVersion,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: `HTTP_${response.status}`,
        message: "Failed to edit ride",
      },
    };
  }
}

/**
 * Query parameters for ride history filtering and pagination.
 */
export interface GetRideHistoryParams {
  from?: string; // ISO date string (YYYY-MM-DD)
  to?: string; // ISO date string (YYYY-MM-DD)
  page?: number;
  pageSize?: number;
}

/**
 * Serialize query parameters for ride history fetch.
 */
function serializeRideHistoryParams(params: GetRideHistoryParams): string {
  const searchParams = new URLSearchParams();

  if (params.from) {
    searchParams.set("from", params.from);
  }
  if (params.to) {
    searchParams.set("to", params.to);
  }
  if (params.page !== undefined && params.page > 0) {
    searchParams.set("page", params.page.toString());
  }
  if (params.pageSize !== undefined && params.pageSize > 0) {
    searchParams.set("pageSize", params.pageSize.toString());
  }

  return searchParams.toString();
}

/**
 * Fetch ride history with optional date range filtering and pagination.
 * @param params Query parameters for filtering and pagination
 * @returns Ride history response with summaries, filtered rides, and pagination info
 */
export async function getRideHistory(
  params: GetRideHistoryParams = {},
): Promise<RideHistoryResponse> {
  const queryString = serializeRideHistoryParams(params);
  const url = queryString
    ? `${API_BASE_URL}/api/rides/history?${queryString}`
    : `${API_BASE_URL}/api/rides/history`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseErrorMessage(
      response,
      "Failed to fetch ride history",
    );
    // Provide specific error message for invalid date range
    if (response.status === 400 && errorMsg.includes("date range")) {
      throw new Error(errorMsg);
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<RideHistoryResponse>;
}
