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

export interface ExpenseHistoryRow {
  expenseId: number;
  expenseDate: string;
  amount: number;
  notes?: string;
  hasReceipt: boolean;
  version: number;
  createdAtUtc: string;
}

export interface ExpenseHistoryResponse {
  expenses: ExpenseHistoryRow[];
  totalAmount: number;
  expenseCount: number;
  generatedAtUtc: string;
}

export interface EditExpenseRequest {
  expenseDate: string;
  amount: number;
  notes?: string;
  expectedVersion: number;
}

export interface EditExpenseResponse {
  expenseId: number;
  savedAtUtc: string;
  newVersion: number;
}

export interface DeleteExpenseResponse {
  expenseId: number;
  deletedAtUtc: string;
}

export async function getExpenseHistory(
  startDate?: string,
  endDate?: string,
): Promise<ApiResult<ExpenseHistoryResponse, ErrorResponse>> {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const qs = params.size > 0 ? `?${params.toString()}` : "";

  const response = await fetch(`${API_BASE_URL}/api/expenses${qs}`, {
    headers: getAuthHeaders(),
  });

  if (response.ok) {
    const data = (await response.json()) as ExpenseHistoryResponse;
    return { ok: true, status: response.status, data };
  }

  let parsedError: ErrorResponse | undefined;
  try {
    parsedError = (await response.json()) as ErrorResponse;
  } catch {
    parsedError = undefined;
  }
  return { ok: false, status: response.status, error: parsedError };
}

export async function editExpense(
  expenseId: number,
  request: EditExpenseRequest,
): Promise<ApiResult<EditExpenseResponse, ErrorResponse>> {
  const response = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}`, {
    method: "PUT",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (response.ok) {
    const data = (await response.json()) as EditExpenseResponse;
    return { ok: true, status: response.status, data };
  }

  let parsedError: ErrorResponse | undefined;
  try {
    parsedError = (await response.json()) as ErrorResponse;
  } catch {
    parsedError = undefined;
  }
  return { ok: false, status: response.status, error: parsedError };
}

export async function deleteExpense(
  expenseId: number,
): Promise<ApiResult<DeleteExpenseResponse, ErrorResponse>> {
  const response = await fetch(`${API_BASE_URL}/api/expenses/${expenseId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  let parsedError: ErrorResponse | undefined;
  try {
    parsedError = (await response.json()) as ErrorResponse;
  } catch {
    parsedError = undefined;
  }
  return { ok: false, status: response.status, error: parsedError };
}

export async function uploadReceipt(
  expenseId: number,
  file: File,
): Promise<ApiResult<undefined, ErrorResponse>> {
  const formData = new FormData();
  formData.append("receipt", file);

  const response = await fetch(
    `${API_BASE_URL}/api/expenses/${expenseId}/receipt`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: formData,
    },
  );

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  let parsedError: ErrorResponse | undefined;
  try {
    parsedError = (await response.json()) as ErrorResponse;
  } catch {
    parsedError = undefined;
  }
  return { ok: false, status: response.status, error: parsedError };
}

export async function deleteReceipt(
  expenseId: number,
): Promise<ApiResult<undefined, ErrorResponse>> {
  const response = await fetch(
    `${API_BASE_URL}/api/expenses/${expenseId}/receipt`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    },
  );

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  let parsedError: ErrorResponse | undefined;
  try {
    parsedError = (await response.json()) as ErrorResponse;
  } catch {
    parsedError = undefined;
  }
  return { ok: false, status: response.status, error: parsedError };
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
