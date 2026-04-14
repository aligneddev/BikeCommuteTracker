import { type ApiResult, type ErrorResponse } from "./users-api";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:5436";

const SESSION_KEY = "bike_tracking_auth_session";

export interface ImportPreviewRequest {
  fileName: string;
  contentBase64: string;
}

export interface ImportValidationError {
  rowNumber: number;
  code: string;
  message: string;
  field?: string | null;
}

export interface ImportDuplicateMatch {
  existingRideId: number;
  existingRideDate: string;
  existingMiles: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  date?: string | null;
  miles?: number | null;
  rideMinutes?: number | null;
  temperature?: number | null;
  tags?: string | null;
  notes?: string | null;
  isValid: boolean;
  errors: ImportValidationError[];
  duplicateMatches: ImportDuplicateMatch[];
}

export interface ImportPreviewResponse {
  importJobId: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  requiresDuplicateResolution: boolean;
  rows: ImportPreviewRow[];
}

export interface ImportDuplicateResolution {
  rowNumber: number;
  action: "keep-existing" | "replace-with-import";
}

export interface ImportStartRequest {
  importJobId: number;
  overrideAllDuplicates: boolean;
  resolutions?: ImportDuplicateResolution[] | null;
}

export interface ImportStartResponse {
  importJobId: number;
  status: string;
  startedAtUtc: string;
}

export interface ImportStatusResponse {
  importJobId: number;
  status: string;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  percentComplete?: number | null;
  etaMinutesRounded?: number | null;
  createdAtUtc: string;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  lastError?: string | null;
}

export interface ImportCancelResponse {
  importJobId: number;
  status: string;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  cancelledAtUtc: string;
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
    // Ignore malformed auth session values.
  }

  return headers;
}

async function postJson<TSuccess>(
  path: string,
  payload: unknown,
): Promise<ApiResult<TSuccess>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as TSuccess,
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

async function getJson<TSuccess>(path: string): Promise<ApiResult<TSuccess>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: getAuthHeaders(false),
  });

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as TSuccess,
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

export function previewImportCsv(
  payload: ImportPreviewRequest,
): Promise<ApiResult<ImportPreviewResponse>> {
  return postJson<ImportPreviewResponse>("/api/imports/preview", payload);
}

export function startImportCsv(
  payload: ImportStartRequest,
): Promise<ApiResult<ImportStartResponse>> {
  return postJson<ImportStartResponse>("/api/imports/start", payload);
}

export function getImportStatus(
  importJobId: number,
): Promise<ApiResult<ImportStatusResponse>> {
  return getJson<ImportStatusResponse>(`/api/imports/${importJobId}/status`);
}

export function cancelImport(
  importJobId: number,
): Promise<ApiResult<ImportCancelResponse>> {
  return postJson<ImportCancelResponse>(
    `/api/imports/${importJobId}/cancel`,
    {},
  );
}
