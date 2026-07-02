import { getApiBaseUrl } from './api-config'
import { type ApiResult, type ErrorResponse } from './users-api'
import {
  type ImportCancelResponse,
  type ImportStartRequest,
  type ImportStartResponse,
  type ImportStatusResponse,
} from './import-api'

const SESSION_KEY = 'bike_tracking_auth_session'

export interface MonthlyImportPreviewRequest {
  fileName: string
  contentBase64: string
  startYear: number
}

export interface MonthlyImportGeneratedRide {
  rideIndex: number
  date: string
  miles: number
  isDuplicate: boolean
  duplicateMatches: Array<{
    existingRideId: number
    existingRideDate: string
    existingMiles: number
  }>
}

export interface MonthlyImportMonthRow {
  rowNumber: number
  rawMonth?: string | null
  year?: number | null
  totalMiles?: number | null
  days?: number | null
  isValid: boolean
  errors: Array<{
    rowNumber: number
    code: string
    message: string
    field?: string | null
  }>
  generatedRides: MonthlyImportGeneratedRide[]
}

export interface MonthlyImportPreviewResponse {
  importJobId: number
  headerDetectionWarning: boolean
  totalMonthRows: number
  validMonthRows: number
  invalidMonthRows: number
  totalGeneratedRides: number
  duplicateRides: number
  requiresDuplicateResolution: boolean
  monthRows: MonthlyImportMonthRow[]
}

function getAuthHeaders(contentTypeJson: boolean): Record<string, string> {
  const headers: Record<string, string> = {}
  if (contentTypeJson) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) {
      return headers
    }

    const parsed = JSON.parse(raw) as { userId?: number }
    if (typeof parsed.userId === 'number' && parsed.userId > 0) {
      headers['X-User-Id'] = parsed.userId.toString()
    }
  } catch {
    // ignore malformed session
  }

  return headers
}

async function postJson<TSuccess>(path: string, payload: unknown): Promise<ApiResult<TSuccess>> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(payload),
  })

  if (response.ok) {
    return { ok: true, status: response.status, data: (await response.json()) as TSuccess }
  }

  let parsedError: ErrorResponse | undefined
  try {
    parsedError = (await response.json()) as ErrorResponse
  } catch {
    parsedError = undefined
  }

  return { ok: false, status: response.status, error: parsedError }
}

async function getJson<TSuccess>(path: string): Promise<ApiResult<TSuccess>> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: getAuthHeaders(false),
  })

  if (response.ok) {
    return { ok: true, status: response.status, data: (await response.json()) as TSuccess }
  }

  let parsedError: ErrorResponse | undefined
  try {
    parsedError = (await response.json()) as ErrorResponse
  } catch {
    parsedError = undefined
  }

  return { ok: false, status: response.status, error: parsedError }
}

export function previewMonthlyImport(
  payload: MonthlyImportPreviewRequest,
): Promise<ApiResult<MonthlyImportPreviewResponse>> {
  return postJson<MonthlyImportPreviewResponse>('/api/monthly-imports/preview', payload)
}

export function startMonthlyImport(
  payload: ImportStartRequest,
): Promise<ApiResult<ImportStartResponse>> {
  return postJson<ImportStartResponse>('/api/monthly-imports/start', payload)
}

export function getMonthlyImportStatus(
  importJobId: number,
): Promise<ApiResult<ImportStatusResponse>> {
  return getJson<ImportStatusResponse>(`/api/monthly-imports/${importJobId}/status`)
}

export function cancelMonthlyImport(
  importJobId: number,
): Promise<ApiResult<ImportCancelResponse>> {
  return postJson<ImportCancelResponse>(`/api/monthly-imports/${importJobId}/cancel`, {})
}
