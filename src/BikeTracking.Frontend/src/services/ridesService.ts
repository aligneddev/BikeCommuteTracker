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
