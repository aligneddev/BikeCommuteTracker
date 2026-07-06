import { BrowserRouter } from 'react-router-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../services/dashboard-api', async () => {
  const actual = await vi.importActual<typeof import('../../services/dashboard-api')>(
    '../../services/dashboard-api'
  )
  return {
    ...actual,
    getYearStatsDashboard: vi.fn(),
    getAvailableYears: vi.fn(),
  }
})

vi.mock('../../components/dashboard/dashboard-chart-section', () => ({
  DashboardChartSection: (props: { seriesLabel?: string }) => (
    <div data-testid="chart-section">{props.seriesLabel ?? 'Rolling 12 months'}</div>
  ),
}))

vi.mock('../advanced-dashboard/DifficultyAnalyticsSection', () => ({
  DifficultyAnalyticsSection: () => <div data-testid="difficulty-section" />,
}))

import * as dashboardApi from '../../services/dashboard-api'
import type { YearStatsDashboardResponse, AvailableYearsResponse } from '../../services/dashboard-api'

const mockGetYearStatsDashboard = vi.mocked(dashboardApi.getYearStatsDashboard)
const mockGetAvailableYears = vi.mocked(dashboardApi.getAvailableYears)

function buildYearStatsResponse(
  overrides: Partial<YearStatsDashboardResponse> = {}
): YearStatsDashboardResponse {
  const months = Array.from({ length: 12 }, (_, index) => ({
    monthKey: `2025-${String(index + 1).padStart(2, '0')}`,
    label: new Date(2025, index, 1).toLocaleString('en-US', { month: 'short' }),
  }))

  return {
    year: 2025,
    hasDataForYear: true,
    totals: {
      totalMiles: 0,
      totalCombinedSavings: null,
      expenseSummary: {
        totalManualExpenses: 0,
        oilChangeSavings: null,
        netExpenses: null,
        oilChangeIntervalCount: 0,
      },
    },
    mileageByMonth: months.map((m) => ({ ...m, miles: 0 })),
    savingsByMonth: months.map((m) => ({
      ...m,
      mileageRateSavings: null,
      fuelCostAvoided: null,
      combinedSavings: null,
    })),
    difficulty: {
      hasData: false,
      overallAverageDifficulty: null,
      byMonth: [],
      mostDifficultMonths: [],
    },
    windResistance: { hasData: false, bins: [] },
    ...overrides,
  }
}

function buildAvailableYears(years: number[]): AvailableYearsResponse {
  return { years }
}

describe('YearStatsDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches available years then year-stats for the default year on mount', async () => {
    mockGetAvailableYears.mockResolvedValue(buildAvailableYears([2025, 2024]))
    mockGetYearStatsDashboard.mockResolvedValue(buildYearStatsResponse())

    const { YearStatsDashboardPage } = await import('./year-stats-dashboard-page')
    render(
      <BrowserRouter>
        <YearStatsDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockGetAvailableYears).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockGetYearStatsDashboard).toHaveBeenCalled()
    })
  })

  it('renders YearSelector, year-scoped DashboardChartSection, and DifficultyAnalyticsSection', async () => {
    mockGetAvailableYears.mockResolvedValue(buildAvailableYears([2025, 2024]))
    mockGetYearStatsDashboard.mockResolvedValue(buildYearStatsResponse())

    const { YearStatsDashboardPage } = await import('./year-stats-dashboard-page')
    render(
      <BrowserRouter>
        <YearStatsDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('chart-section')).toHaveTextContent('2025')
    })
    expect(screen.getByTestId('difficulty-section')).toBeInTheDocument()
  })

  it('renders a text summary section with totals and per-month miles above the charts', async () => {
    mockGetAvailableYears.mockResolvedValue(buildAvailableYears([2025, 2024]))
    mockGetYearStatsDashboard.mockResolvedValue(
      buildYearStatsResponse({
        totals: {
          totalMiles: 543.2,
          totalCombinedSavings: 210.5,
          expenseSummary: {
            totalManualExpenses: 75,
            oilChangeSavings: 30,
            netExpenses: 45,
            oilChangeIntervalCount: 1,
          },
        },
        mileageByMonth: [
          { monthKey: '2025-01', label: 'Jan', miles: 100 },
          { monthKey: '2025-02', label: 'Feb', miles: 50 },
        ],
      })
    )

    const { YearStatsDashboardPage } = await import('./year-stats-dashboard-page')
    render(
      <BrowserRouter>
        <YearStatsDashboardPage />
      </BrowserRouter>
    )

    const summary = await screen.findByTestId('year-stats-summary')
    expect(summary).toHaveTextContent('543.2')
    expect(summary).toHaveTextContent('210.5')
    expect(summary).toHaveTextContent('75')
    expect(summary).toHaveTextContent('Jan')
    expect(summary).toHaveTextContent('100')
    expect(summary).toHaveTextContent('Feb')
    expect(summary).toHaveTextContent('50')
  })

  it('re-fetches and re-renders charts in place when the year selector changes', async () => {
    mockGetAvailableYears.mockResolvedValue(buildAvailableYears([2025, 2024]))
    mockGetYearStatsDashboard.mockResolvedValue(buildYearStatsResponse())

    const { YearStatsDashboardPage } = await import('./year-stats-dashboard-page')
    render(
      <BrowserRouter>
        <YearStatsDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    mockGetYearStatsDashboard.mockResolvedValue(buildYearStatsResponse({ year: 2024 }))
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '2024' } })

    await waitFor(() => {
      expect(mockGetYearStatsDashboard).toHaveBeenCalledWith(2024)
    })
  })

  it('renders an explicit empty state when hasDataForYear is false', async () => {
    mockGetAvailableYears.mockResolvedValue(buildAvailableYears([2019]))
    mockGetYearStatsDashboard.mockResolvedValue(
      buildYearStatsResponse({ year: 2019, hasDataForYear: false })
    )

    const { YearStatsDashboardPage } = await import('./year-stats-dashboard-page')
    render(
      <BrowserRouter>
        <YearStatsDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/no ride data for 2019/i)).toBeInTheDocument()
    })

    expect(screen.queryByTestId('chart-section')).not.toBeInTheDocument()
  })
})
