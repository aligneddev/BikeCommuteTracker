import type { ApiResult, ErrorResponse } from "./users-api";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:5436";

const SESSION_KEY = "bike_tracking_auth_session";

export interface ExpenseImportPreviewResponse {
  jobId: number;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  errors: ExpenseImportRowError[];
  duplicates: ExpenseImportDuplicateConflict[];
  canConfirmImport: boolean;
}

export interface ExpenseImportRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ExistingExpenseMatch {
  expenseId: number;
  expenseDate: string;
  amount: number;
  note: string | null;
}

export interface ExpenseImportDuplicateConflict {
  rowNumber: number;
  expenseDate: string;
  amount: number;
  note: string | null;
  existingMatches: ExistingExpenseMatch[];
}

export interface ExpenseImportPreviewRequest {
  file: File;
}

export interface ConfirmExpenseImportRequest {
  overrideAllDuplicates: boolean;
  duplicateChoices: Array<{
    rowNumber: number;
    resolution: "keep-existing" | "replace-with-import";
  }>;
}

export interface ExpenseImportSummaryResponse {
  jobId: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
}

export interface ExpenseImportStatusResponse {
  jobId: number;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  summary: ExpenseImportSummaryResponse | null;
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
    return headers;
  }

  return headers;
}

async function parseError(
  response: Response,
): Promise<ErrorResponse | undefined> {
  try {
    return (await response.json()) as ErrorResponse;
  } catch {
    return undefined;
  }
}

export async function previewExpenseImport(
  request: ExpenseImportPreviewRequest,
): Promise<ApiResult<ExpenseImportPreviewResponse, ErrorResponse>> {
  const formData = new FormData();
  formData.append("file", request.file);

  const response = await fetch(`${API_BASE_URL}/api/expense-imports/preview`, {
    method: "POST",
    headers: getAuthHeaders(false),
    body: formData,
  });

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as ExpenseImportPreviewResponse,
    };
  }

  return {
    ok: false,
    status: response.status,
    error: await parseError(response),
  };
}

export async function confirmExpenseImport(
  jobId: number,
  request: ConfirmExpenseImportRequest,
): Promise<ApiResult<ExpenseImportSummaryResponse, ErrorResponse>> {
  const response = await fetch(
    `${API_BASE_URL}/api/expense-imports/${jobId}/confirm`,
    {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as ExpenseImportSummaryResponse,
    };
  }

  return {
    ok: false,
    status: response.status,
    error: await parseError(response),
  };
}

export async function getExpenseImportStatus(
  jobId: number,
): Promise<ApiResult<ExpenseImportStatusResponse, ErrorResponse>> {
  const response = await fetch(
    `${API_BASE_URL}/api/expense-imports/${jobId}/status`,
    {
      headers: getAuthHeaders(false),
    },
  );

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as ExpenseImportStatusResponse,
    };
  }

  return {
    ok: false,
    status: response.status,
    error: await parseError(response),
  };
}

export async function deleteExpenseImport(
  jobId: number,
): Promise<ApiResult<void, ErrorResponse>> {
  const response = await fetch(`${API_BASE_URL}/api/expense-imports/${jobId}`, {
    method: "DELETE",
    headers: getAuthHeaders(false),
  });

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
    };
  }

  return {
    ok: false,
    status: response.status,
    error: await parseError(response),
  };
}
