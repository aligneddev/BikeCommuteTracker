/** Savings metrics for a single calendar window (weekly, monthly, yearly, or all-time). */
export interface AdvancedSavingsWindow {
  /** Window identifier matching the backend period key. */
  period: 'weekly' | 'monthly' | 'yearly' | 'allTime'
  rideCount: number
  totalMiles: number
  /** Total gallons saved vs driving. Null when no rides have a valid MPG snapshot. */
  gallonsSaved: number | null
  /** Fuel cost avoided in USD. Null when gas price data is unavailable. */
  fuelCostAvoided: number | null
  /** True when any ride in this window used a fallback gas-price lookup. */
  fuelCostEstimated: boolean
  /** IRS mileage-rate savings in USD. Null when no rides have a mileage-rate snapshot. */
  mileageRateSavings: number | null
  /** Sum of fuelCostAvoided and mileageRateSavings. Null when both are null. */
  combinedSavings: number | null
  /** Sum of manual expense amounts with ExpenseDate within this window's date range. */
  totalExpenses: number
  /**
   * Oil-change savings attributed to this window (3000-mile interval crossings × OilChangePrice).
   * Null when OilChangePrice is not configured.
   */
  oilChangeSavings: number | null
  /**
   * Net financial position: combinedSavings + oilChangeSavings − totalExpenses.
   * Null only when all savings are null and expenses are zero. Can be negative.
   */
  netSavings: number | null
}

/** Four calendar time-window savings breakdown returned by the advanced dashboard endpoint. */
export interface AdvancedSavingsWindows {
  weekly: AdvancedSavingsWindow
  monthly: AdvancedSavingsWindow
  yearly: AdvancedSavingsWindow
  allTime: AdvancedSavingsWindow
}

/**
 * A deterministic rule-based suggestion card. Three suggestions are always included in
 * the response; only those with isEnabled = true should be displayed to the user.
 */
export interface AdvancedDashboardSuggestion {
  /** Stable key: "consistency" | "milestone" | "comeback". */
  suggestionKey: 'consistency' | 'milestone' | 'comeback'
  title: string
  description: string
  isEnabled: boolean
}

/** Reminder flags indicating which user settings are missing and blocking savings calculations. */
export interface AdvancedDashboardReminders {
  mpgReminderRequired: boolean
  mileageRateReminderRequired: boolean
}

/** Full response shape from GET /api/dashboard/advanced. */
export interface AdvancedDashboardResponse {
  savingsWindows: AdvancedSavingsWindows
  suggestions: AdvancedDashboardSuggestion[]
  reminders: AdvancedDashboardReminders
  generatedAtUtc: string
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:5436'

const SESSION_KEY = 'bike_tracking_auth_session'

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    return headers
  }

  return headers
}

/** Fetches the advanced statistics dashboard for the authenticated user. */
export async function getAdvancedDashboard(): Promise<AdvancedDashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/advanced`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to load advanced dashboard')
  }

  return response.json() as Promise<AdvancedDashboardResponse>
}
