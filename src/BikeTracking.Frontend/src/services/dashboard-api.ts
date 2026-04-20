export interface DashboardMileageMetric {
  miles: number;
  rideCount: number;
  period: string;
}

export interface DashboardMoneySaved {
  mileageRateSavings: number | null;
  fuelCostAvoided: number | null;
  combinedSavings: number | null;
  qualifiedRideCount: number;
}

export interface DashboardExpenseSummary {
  totalManualExpenses: number;
  oilChangeSavings: number | null;
  netExpenses: number | null;
  oilChangeIntervalCount: number;
}

export interface DashboardTotals {
  currentMonthMiles: DashboardMileageMetric;
  yearToDateMiles: DashboardMileageMetric;
  allTimeMiles: DashboardMileageMetric;
  moneySaved: DashboardMoneySaved;
  expenseSummary: DashboardExpenseSummary;
}

export interface DashboardAverages {
  averageTemperature: number | null;
  averageMilesPerRide: number | null;
  averageRideMinutes: number | null;
}

export interface DashboardCharts {
  mileageByMonth: Array<{ monthKey: string; label: string; miles: number }>;
  savingsByMonth: Array<{
    monthKey: string;
    label: string;
    mileageRateSavings: number | null;
    fuelCostAvoided: number | null;
    combinedSavings: number | null;
  }>;
}

export interface DashboardMetricSuggestion {
  metricKey: "gallonsAvoided" | "goalProgress";
  title: string;
  description: string;
  isEnabled: boolean;
  value?: number | null;
  unitLabel?: string | null;
}

export interface DashboardMissingData {
  ridesMissingSavingsSnapshot: number;
  ridesMissingGasPrice: number;
  ridesMissingTemperature: number;
  ridesMissingDuration: number;
}

export interface DashboardResponse {
  totals: DashboardTotals;
  averages: DashboardAverages;
  charts: DashboardCharts;
  suggestions: DashboardMetricSuggestion[];
  missingData: DashboardMissingData;
  generatedAtUtc: string;
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
    return headers;
  }

  return headers;
}

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard");
  }

  return response.json() as Promise<DashboardResponse>;
}
