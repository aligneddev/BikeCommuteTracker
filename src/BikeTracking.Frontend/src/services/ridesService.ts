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

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export async function recordRide(
  request: RecordRideRequest,
): Promise<RecordRideSuccessResponse> {
  const response = await fetch(`${API_BASE}/rides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to record ride");
  }

  return response.json();
}

export async function getRideDefaults(): Promise<RideDefaultsResponse> {
  const response = await fetch(`${API_BASE}/rides/defaults`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch ride defaults");
  }

  return response.json();
}
