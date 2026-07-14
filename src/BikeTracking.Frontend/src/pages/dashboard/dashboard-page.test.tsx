import { BrowserRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

vi.mock('../../components/dashboard/dashboard-chart-section', () => ({
  DashboardChartSection: (props: { year?: number; seriesLabel?: string }) => (
    <div data-testid="mock-chart-section" data-year={props.year} data-series-label={props.seriesLabel} />
  ),
}))

vi.mock('../../services/dashboard-api', async () => {
  const actual = await vi.importActual<typeof import('../../services/dashboard-api')>(
    '../../services/dashboard-api'
  )
  return {
    ...actual,
    getDashboard: vi.fn(),
  }
})

import * as dashboardApi from '../../services/dashboard-api'

const mockGetDashboard = vi.mocked(dashboardApi.getDashboard)

function buildDashboardResponse(
  overrides?: Partial<dashboardApi.DashboardResponse>
): dashboardApi.DashboardResponse {
  const base: dashboardApi.DashboardResponse = {
    totals: {
      currentMonthMiles: { miles: 10, rideCount: 1, period: 'thisMonth' },
      yearToDateMiles: { miles: 45, rideCount: 4, period: 'thisYear' },
      allTimeMiles: { miles: 120, rideCount: 12, period: 'allTime' },
      moneySaved: {
        mileageRateSavings: 15,
        fuelCostAvoided: 7,
        qualifiedRideCount: 3,
      },
      expenseSummary: {
        totalManualExpenses: 0,
        oilChangeSavings: null,
        netExpenses: null,
        oilChangeIntervalCount: 0,
      },
    },
    averages: {
      averageTemperature: null,
      averageMilesPerRide: null,
      averageRideMinutes: null,
    },
    charts: {
      mileageByMonth: [],
      savingsByMonth: [],
    },
    suggestions: [],
    missingData: {
      ridesMissingSavingsSnapshot: 0,
      ridesMissingGasPrice: 0,
      ridesMissingTemperature: 0,
      ridesMissingDuration: 0,
    },
    generatedAtUtc: '2026-04-16T12:00:00.000Z',
  }

  if (!overrides) {
    return base
  }

  return {
    ...base,
    ...overrides,
    totals: {
      ...base.totals,
      ...overrides.totals,
      moneySaved: {
        ...base.totals.moneySaved,
        ...overrides.totals?.moneySaved,
      },
    },
  }
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mockGetDashboard.mockResolvedValue(buildDashboardResponse())
  })

  it('renders the baseline dashboard cards and charts', async () => {
    const module = await import('./dashboard-page')
    const DashboardPage = module.DashboardPage

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    expect(await screen.findByText(/current month/i)).toBeInTheDocument()
    expect(screen.getByText(/year to date/i)).toBeInTheDocument()
    expect(screen.getByText(/all time/i)).toBeInTheDocument()
  }, 10000)

  it('renders expense summary card with total manual expenses label', async () => {
    const module = await import('./dashboard-page')
    const DashboardPage = module.DashboardPage

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    expect(screen.getByText(/total expenses/i, { selector: 'span' })).toBeInTheDocument()
  })

  it('renders oil change savings label when available', async () => {
    const module = await import('./dashboard-page')
    const DashboardPage = module.DashboardPage

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    expect(screen.getByText(/oil change savings/i, { selector: 'span' })).toBeInTheDocument()
  })

  it('invokes DashboardChartSection without year/seriesLabel props (regression for SC-003)', async () => {
    sessionStorage.setItem(
      'bike_tracking_auth_session',
      JSON.stringify({ userId: 1 })
    )

    try {
      const module = await import('./dashboard-page')
      const DashboardPage = module.DashboardPage

      render(
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      )

      const chartSection = await screen.findByTestId('mock-chart-section')
      expect(chartSection.dataset.year).toBeUndefined()
      expect(chartSection.dataset.seriesLabel).toBeUndefined()
    } finally {
      sessionStorage.removeItem('bike_tracking_auth_session')
    }
  })

  it('renders split savings labels and does not render a merged combined label', async () => {
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 1 }))

    try {
      const module = await import('./dashboard-page')
      const DashboardPage = module.DashboardPage

      render(
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      )

      expect(await screen.findByText(/mileage rate savings/i)).toBeInTheDocument()
      expect(screen.getByText(/gallons-based savings/i)).toBeInTheDocument()
      expect(screen.queryByText(/combined savings/i)).not.toBeInTheDocument()
    } finally {
      sessionStorage.removeItem('bike_tracking_auth_session')
    }
  })

  it('renders split savings with currency rounding', async () => {
    mockGetDashboard.mockResolvedValue(
      buildDashboardResponse({
        totals: {
          ...buildDashboardResponse().totals,
          moneySaved: {
            mileageRateSavings: 12.345,
            fuelCostAvoided: 6.789,
            qualifiedRideCount: 2,
          },
        },
      })
    )
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 1 }))

    try {
      const module = await import('./dashboard-page')
      const DashboardPage = module.DashboardPage

      render(
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      )

      expect(await screen.findByText(/mileage rate savings \$12\.35/i)).toBeInTheDocument()
      expect(screen.getByText(/gallons-based savings \$6\.79/i)).toBeInTheDocument()
    } finally {
      sessionStorage.removeItem('bike_tracking_auth_session')
    }
  })

  it('renders split savings zero values instead of hiding rows', async () => {
    mockGetDashboard.mockResolvedValue(
      buildDashboardResponse({
        totals: {
          ...buildDashboardResponse().totals,
          moneySaved: {
            mileageRateSavings: 0,
            fuelCostAvoided: 0,
            qualifiedRideCount: 1,
          },
        },
      })
    )
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 1 }))

    try {
      const module = await import('./dashboard-page')
      const DashboardPage = module.DashboardPage

      render(
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      )

      expect(await screen.findByText(/mileage rate savings \$0\.00/i)).toBeInTheDocument()
      expect(screen.getByText(/gallons-based savings \$0\.00/i)).toBeInTheDocument()
    } finally {
      sessionStorage.removeItem('bike_tracking_auth_session')
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    sessionStorage.removeItem('bike_tracking_auth_session')
  })
})