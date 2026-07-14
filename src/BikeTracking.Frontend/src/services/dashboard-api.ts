import { getApiBaseUrl } from "./api-config";
export interface DashboardMileageMetric {
  miles: number;
  rideCount: number;
  period: string;
}

export interface DashboardMoneySaved {
  mileageRateSavings: number | null;
  fuelCostAvoided: number | null;
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
  const response = await fetch(`${getApiBaseUrl()}/api/dashboard`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard");
  }

  return response.json() as Promise<DashboardResponse>;
}

/** A single month's mileage total, scoped to a specific calendar year (Jan..Dec of `year`). */
export interface YearStatsMileagePoint {
  monthKey: string;
  label: string;
  miles: number;
}

/** A single month's savings breakdown, scoped to a specific calendar year. */
export interface YearStatsSavingsPoint {
  monthKey: string;
  label: string;
  mileageRateSavings: number | null;
  fuelCostAvoided: number | null;
  combinedSavings: number | null;
}

/** Average difficulty for a single month within a specific calendar year. */
export interface YearStatsDifficultyByMonthPoint {
  monthKey: string;
  label: string;
  averageDifficulty: number;
}

/** Difficulty analytics scoped to a single calendar year. */
export interface YearStatsDifficultySection {
  hasData: boolean;
  overallAverageDifficulty: number | null;
  byMonth: YearStatsDifficultyByMonthPoint[];
  mostDifficultMonths: YearStatsDifficultyByMonthPoint[];
}

/** Count of rides at a given wind resistance level, scoped to a single calendar year. */
export interface YearStatsWindResistanceBin {
  label: string;
  count: number;
}

/** Wind resistance distribution scoped to a single calendar year. */
export interface YearStatsWindResistanceSection {
  hasData: boolean;
  bins: YearStatsWindResistanceBin[];
}

/** Year-scoped totals shown as a text summary above the year-stats charts. */
export interface YearStatsExpenseSummary {
  totalManualExpenses: number;
  oilChangeSavings: number | null;
  netExpenses: number | null;
  oilChangeIntervalCount: number;
}

/** Year-scoped totals shown as a text summary above the year-stats charts. */
export interface YearStatsTotals {
  totalMiles: number;
  totalCombinedSavings: number | null;
  expenseSummary: YearStatsExpenseSummary;
}

/** Full response shape from GET /api/dashboard/year-stats?year={yyyy}. */
export interface YearStatsDashboardResponse {
  year: number;
  hasDataForYear: boolean;
  totals: YearStatsTotals;
  mileageByMonth: YearStatsMileagePoint[];
  savingsByMonth: YearStatsSavingsPoint[];
  difficulty: YearStatsDifficultySection;
  windResistance: YearStatsWindResistanceSection;
}

/** Response shape from GET /api/dashboard/year-stats/years. */
export interface AvailableYearsResponse {
  years: number[];
}

/** Fetches the year-scoped stats dashboard (mileage/savings/difficulty/wind) for `year`. */
export async function getYearStatsDashboard(year: number): Promise<YearStatsDashboardResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/dashboard/year-stats?year=${year}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to load year stats dashboard");
  }

  return response.json() as Promise<YearStatsDashboardResponse>;
}

/** Fetches the distinct calendar years selectable in the year stats dashboard's year selector. */
export async function getAvailableYears(): Promise<AvailableYearsResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/dashboard/year-stats/years`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to load available years");
  }

  return response.json() as Promise<AvailableYearsResponse>;
}
