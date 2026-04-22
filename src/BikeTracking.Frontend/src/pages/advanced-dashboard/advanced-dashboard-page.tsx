import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdvancedDashboard,
  type AdvancedDashboardResponse,
} from '../../services/advanced-dashboard-api'
import { SavingsWindowsTable } from './SavingsWindowsTable'
import { AdvancedSuggestionsPanel } from './AdvancedSuggestionsPanel'
import './advanced-dashboard-page.css'

/**
 * Advanced Statistics Dashboard page.
 *
 * Fetches the user's advanced savings data on mount and renders:
 * - Reminder cards when MPG or mileage-rate settings are missing
 * - A 4-row savings breakdown table (weekly / monthly / yearly / all-time)
 * - Personalised suggestion cards (consistency, milestone, comeback)
 */
export function AdvancedDashboardPage() {
  const [data, setData] = useState<AdvancedDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function load(): Promise<void> {
      try {
        const response = await getAdvancedDashboard()
        if (isMounted) {
          setData(response)
          setError('')
        }
      } catch {
        if (isMounted) {
          setError('Could not load advanced dashboard data.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="advanced-dashboard-page">
      <section className="advanced-dashboard-hero">
        <div>
          <p className="advanced-dashboard-kicker">Advanced statistics</p>
          <h1>Deep-dive into your savings.</h1>
          <p className="advanced-dashboard-intro">
            Gallons saved, fuel cost avoided, and mileage-rate earnings — broken down by week,
            month, year, and all time.
          </p>
        </div>
        <div className="advanced-dashboard-hero-actions">
          <Link to="/dashboard" className="advanced-dashboard-back-link">
            ← Back to Dashboard
          </Link>
        </div>
      </section>

      {error ? (
        <p className="advanced-dashboard-banner" role="alert">
          {error}
        </p>
      ) : null}

      {data?.reminders.mpgReminderRequired ? (
        <div className="advanced-dashboard-reminder-card" role="note" data-testid="mpg-reminder">
          <strong>Set your average car MPG</strong>
          <p>
            To calculate gallons saved and fuel cost avoided, add your car's average MPG in{' '}
            <Link to="/settings">Settings</Link>.
          </p>
        </div>
      ) : null}

      {data?.reminders.mileageRateReminderRequired ? (
        <div
          className="advanced-dashboard-reminder-card"
          role="note"
          data-testid="mileage-rate-reminder"
        >
          <strong>Set your mileage rate</strong>
          <p>
            To calculate mileage-rate savings, add your IRS mileage rate (cents per mile) in{' '}
            <Link to="/settings">Settings</Link>.
          </p>
        </div>
      ) : null}

      {data ? (
        <>
          <section aria-label="Savings breakdown by time window">
            <h2 className="advanced-dashboard-section-heading">Savings Breakdown</h2>
            <SavingsWindowsTable
              weekly={data.savingsWindows.weekly}
              monthly={data.savingsWindows.monthly}
              yearly={data.savingsWindows.yearly}
              allTime={data.savingsWindows.allTime}
            />
          </section>

          <AdvancedSuggestionsPanel suggestions={data.suggestions} />
        </>
      ) : null}

      {loading ? <p className="advanced-dashboard-loading">Loading advanced stats…</p> : null}
    </main>
  )
}
