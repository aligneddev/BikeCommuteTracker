export interface AdvancedSavingsWindow {
  period: 'weekly' | 'monthly' | 'yearly' | 'allTime'
  rideCount: number
  totalMiles: number
  gallonsSaved: number | null
  fuelCostAvoided: number | null
  fuelCostEstimated: boolean
  mileageRateSavings: number | null
  combinedSavings: number | null
}

export interface AdvancedSavingsWindows {
  weekly: AdvancedSavingsWindow
  monthly: AdvancedSavingsWindow
  yearly: AdvancedSavingsWindow
  allTime: AdvancedSavingsWindow
}

export interface AdvancedDashboardSuggestion {
  suggestionKey: 'consistency' | 'milestone' | 'comeback'
  title: string
  description: string
  isEnabled: boolean
}

export interface AdvancedDashboardReminders {
  mpgReminderRequired: boolean
  mileageRateReminderRequired: boolean
}

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
