import { BrowserRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('../../components/dashboard/dashboard-chart-section', () => ({
  DashboardChartSection: (props: { year?: number; seriesLabel?: string }) => (
    <div data-testid="mock-chart-section" data-year={props.year} data-series-label={props.seriesLabel} />
  ),
}))

describe('DashboardPage', () => {
  it('renders the baseline dashboard cards and charts', async () => {
    const module = await import('./dashboard-page')
    const DashboardPage = module.DashboardPage

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    expect(screen.getByText(/current month/i)).toBeInTheDocument()
    expect(screen.getByText(/year to date/i)).toBeInTheDocument()
    expect(screen.getByText(/all time/i)).toBeInTheDocument()
  })

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

  afterEach(() => {
    sessionStorage.removeItem('bike_tracking_auth_session')
  })
})