import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardStatusPanel } from '../../components/dashboard/dashboard-status-panel'
import { DashboardSummaryCard } from '../../components/dashboard/dashboard-summary-card'
import { ExpenseSummaryCard } from './ExpenseSummaryCard'
import { getDashboard, type DashboardResponse } from '../../services/dashboard-api'
import './dashboard-page.css'

const SESSION_KEY = 'bike_tracking_auth_session'
const DashboardChartSection = lazy(async () => {
  const module = await import('../../components/dashboard/dashboard-chart-section')
  return { default: module.DashboardChartSection }
})

function buildEmptyDashboard(): DashboardResponse {
  const now = new Date()
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' })

  const mileageByMonth = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    return {
      monthKey,
      label: monthFormatter.format(date),
      miles: 0,
    }
  })

  return {
    totals: {
      currentMonthMiles: { miles: 0, rideCount: 0, period: 'thisMonth' },
      yearToDateMiles: { miles: 0, rideCount: 0, period: 'thisYear' },
      allTimeMiles: { miles: 0, rideCount: 0, period: 'allTime' },
      moneySaved: {
        mileageRateSavings: null,
        fuelCostAvoided: null,
        combinedSavings: null,
        qualifiedRideCount: 0,
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
      mileageByMonth,
      savingsByMonth: mileageByMonth.map((point) => ({
        monthKey: point.monthKey,
        label: point.label,
        mileageRateSavings: null,
        fuelCostAvoided: null,
        combinedSavings: null,
      })),
    },
    suggestions: [],
    missingData: {
      ridesMissingSavingsSnapshot: 0,
      ridesMissingGasPrice: 0,
      ridesMissingTemperature: 0,
      ridesMissingDuration: 0,
    },
    generatedAtUtc: now.toISOString(),
  }
}

function formatMiles(value: number): string {
  return `${value.toFixed(1)} mi`
}

function formatRideCount(rideCount: number): string {
  return rideCount === 1 ? '1 ride' : `${rideCount} rides`
}

function formatAverage(value: number | null, suffix: string): string {
  return value === null ? '—' : `${value.toFixed(1)}${suffix}`
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatOptionalMetricValue(value: number | null | undefined, unitLabel?: string | null): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (unitLabel === '%') {
    return `${value.toFixed(1)}%`
  }

  if (unitLabel === 'gal') {
    return `${value.toFixed(2)} gal`
  }

  return `${value}`
}

export function DashboardPage() {
  const hasSession = Boolean(sessionStorage.getItem(SESSION_KEY))
  const [dashboard, setDashboard] = useState<DashboardResponse>(() => buildEmptyDashboard())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboard(): Promise<void> {
      if (!hasSession) {
        setLoading(false)
        return
      }

      try {
        const response = await getDashboard()
        if (isMounted) {
          setDashboard(response)
          setError('')
        }
      } catch {
        if (isMounted) {
          setError('Dashboard data is not available yet.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [hasSession])

  const hasRides = dashboard.totals.allTimeMiles.rideCount > 0
  const enabledSuggestions = dashboard.suggestions.filter((suggestion) => suggestion.isEnabled)

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-kicker">Main dashboard</p>
          <h1>Your riding story, one screen.</h1>
          <p className="dashboard-intro">
            Track mileage, savings, and ride quality without leaving the main page.
          </p>
        </div>

        <div className="dashboard-hero-actions">
          <Link to="/rides/record" className="dashboard-primary-action">
            Record a ride
          </Link>
          <Link to="/settings" className="dashboard-secondary-action">
            Review settings
          </Link>
        </div>
      </section>

      {error ? (
        <p className="dashboard-banner" role="alert">
          {error}
        </p>
      ) : null}

      <section className="dashboard-summary-grid" aria-label="Dashboard summary cards">
        <DashboardSummaryCard
          title="Current Month"
          eyebrow="Mileage"
          value={formatMiles(dashboard.totals.currentMonthMiles.miles)}
          detail={formatRideCount(dashboard.totals.currentMonthMiles.rideCount)}
          accentClassName="dashboard-summary-card-accent-current"
        />
        <DashboardSummaryCard
          title="Year to Date"
          eyebrow="Mileage"
          value={formatMiles(dashboard.totals.yearToDateMiles.miles)}
          detail={formatRideCount(dashboard.totals.yearToDateMiles.rideCount)}
          accentClassName="dashboard-summary-card-accent-year"
        />
        <DashboardSummaryCard
          title="All Time"
          eyebrow="Mileage"
          value={formatMiles(dashboard.totals.allTimeMiles.miles)}
          detail={formatRideCount(dashboard.totals.allTimeMiles.rideCount)}
          accentClassName="dashboard-summary-card-accent-all-time"
        />
        <DashboardSummaryCard
          title="Money Saved"
          eyebrow="Combined"
          value={formatCurrency(dashboard.totals.moneySaved.combinedSavings)}
          detail={`${dashboard.totals.moneySaved.qualifiedRideCount} qualified rides`}
          accentClassName="dashboard-summary-card-accent-savings"
        >
          <div className="dashboard-summary-split">
            <span>Rate (cents per mile) {formatCurrency(dashboard.totals.moneySaved.mileageRateSavings)}</span>
            <span>Fuel {formatCurrency(dashboard.totals.moneySaved.fuelCostAvoided)}</span>
          </div>
        </DashboardSummaryCard>
        <ExpenseSummaryCard expenseSummary={dashboard.totals.expenseSummary} />
      </section>

      <section className="dashboard-averages-grid" aria-label="Dashboard averages">
        <article className="dashboard-average-card">
          <p className="dashboard-average-label">Average temperature</p>
          <p className="dashboard-average-value">
            {formatAverage(dashboard.averages.averageTemperature, '°F')}
          </p>
        </article>
        <article className="dashboard-average-card">
          <p className="dashboard-average-label">Average miles per ride</p>
          <p className="dashboard-average-value">
            {formatAverage(dashboard.averages.averageMilesPerRide, ' mi')}
          </p>
        </article>
        <article className="dashboard-average-card">
          <p className="dashboard-average-label">Average ride duration</p>
          <p className="dashboard-average-value">
            {formatAverage(dashboard.averages.averageRideMinutes, ' min')}
          </p>
        </article>
      </section>

      {hasSession ? (
        <Suspense fallback={<p className="dashboard-loading">Loading charts…</p>}>
          <DashboardChartSection
            mileageByMonth={dashboard.charts.mileageByMonth}
            savingsByMonth={dashboard.charts.savingsByMonth}
          />
        </Suspense>
      ) : (
        <section className="dashboard-chart-grid" aria-label="Dashboard charts">
          <article className="dashboard-chart-card">
            <div className="dashboard-chart-card-header">
              <div>
                <p className="dashboard-chart-overline">Trend</p>
                <h2>Miles by Month</h2>
              </div>
              <p>Rolling 12 months</p>
            </div>
          </article>
          <article className="dashboard-chart-card">
            <div className="dashboard-chart-card-header">
              <div>
                <p className="dashboard-chart-overline">Savings</p>
                <h2>Savings by Month</h2>
              </div>
              <p>Rolling 12 months</p>
            </div>
          </article>
        </section>
      )}

      <DashboardStatusPanel
        missingData={dashboard.missingData}
        suggestions={dashboard.suggestions}
        hasRides={hasRides}
      />

      {enabledSuggestions.length > 0 ? (
        <section className="dashboard-approved-grid" aria-label="Approved metrics">
          {enabledSuggestions.map((suggestion) => (
            <article key={suggestion.metricKey} className="dashboard-average-card">
              <p className="dashboard-average-label">Approved Metric</p>
              <p className="dashboard-average-value">
                {formatOptionalMetricValue(suggestion.value, suggestion.unitLabel)}
              </p>
              <p className="dashboard-average-label">{suggestion.title}</p>
              <p className="dashboard-summary-card-detail">{suggestion.description}</p>
            </article>
          ))}
        </section>
      ) : null}

      {loading ? <p className="dashboard-loading">Refreshing dashboard…</p> : null}
    </main>
  )
}