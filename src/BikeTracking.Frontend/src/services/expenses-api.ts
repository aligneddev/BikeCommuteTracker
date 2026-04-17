import type { ApiResult, ErrorResponse } from "./users-api";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:5436";
const SESSION_KEY = "bike_tracking_auth_session";

export interface RecordExpenseResponse {
  expenseId: number;
  riderId: number;
  savedAtUtc: string;
  receiptAttached: boolean;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

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

export async function recordExpense(
  formData: FormData,
): Promise<ApiResult<RecordExpenseResponse, ErrorResponse>> {
  const response = await fetch(`${API_BASE_URL}/api/expenses`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (response.ok) {
    const data = (await response.json()) as RecordExpenseResponse;
    return {
      ok: true,
      status: response.status,
      data,
    };
  }

  let parsedError: ErrorResponse | undefined;
  try {
    parsedError = (await response.json()) as ErrorResponse;
  } catch {
    parsedError = undefined;
  }

  return {
    ok: false,
    status: response.status,
    error: parsedError,
  };
}
