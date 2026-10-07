import { BrowserRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
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
      totalRideMinutes: 0,
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

  async function renderRidingTimeCard(): Promise<HTMLElement> {
    const module = await import('./dashboard-page')
    const DashboardPage = module.DashboardPage

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    const heading = await screen.findByRole('heading', { name: 'Riding Time' })
    return heading.closest('article') as HTMLElement
  }

  it('renders the all-time riding time card in hours and minutes', async () => {
    mockGetDashboard.mockResolvedValue(
      buildDashboardResponse({
        totals: { ...buildDashboardResponse().totals, totalRideMinutes: 2535 },
      })
    )
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 1 }))

    const card = await renderRidingTimeCard()

    expect(await within(card).findByText('42h 15m')).toBeInTheDocument()
    expect(within(card).getByText('12 rides')).toBeInTheDocument()
  })

  it('flags rides missing duration on the riding time card', async () => {
    mockGetDashboard.mockResolvedValue(
      buildDashboardResponse({
        missingData: {
          ...buildDashboardResponse().missingData,
          ridesMissingDuration: 2,
        },
      })
    )
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 1 }))

    const card = await renderRidingTimeCard()

    expect(await within(card).findByText('2 rides missing duration')).toBeInTheDocument()
  })

  it('uses singular wording when one ride is missing duration', async () => {
    mockGetDashboard.mockResolvedValue(
      buildDashboardResponse({
        missingData: {
          ...buildDashboardResponse().missingData,
          ridesMissingDuration: 1,
        },
      })
    )
    sessionStorage.setItem('bike_tracking_auth_session', JSON.stringify({ userId: 1 }))

    const card = await renderRidingTimeCard()

    expect(await within(card).findByText('1 ride missing duration')).toBeInTheDocument()
  })

  it('renders 0h 0m riding time for the empty dashboard state', async () => {
    const card = await renderRidingTimeCard()

    expect(within(card).getByText('0h 0m')).toBeInTheDocument()
  })

  afterEach(() => {
    vi.clearAllMocks()
    sessionStorage.removeItem('bike_tracking_auth_session')
  })
})