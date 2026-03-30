import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MileageSummaryCard } from '../../components/mileage-summary-card/mileage-summary-card'
import { useAuth } from '../../context/auth-context'
import type { RideHistoryResponse } from '../../services/ridesService'
import { getRideHistory } from '../../services/ridesService'
import './miles-shell-page.css'

export function MilesShellPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<RideHistoryResponse | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let isMounted = true

    async function loadDashboardSummaries(): Promise<void> {
      setError('')
      try {
        const response = await getRideHistory({ page: 1, pageSize: 1 })
        if (isMounted) {
          setHistory(response)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard summaries')
        }
      }
    }

    void loadDashboardSummaries()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="miles-shell">
      <div className="miles-welcome">
        <h1>Welcome, {user?.userName}.</h1>
        <p>Track your year-to-date and all-time progress at a glance.</p>
      </div>

      {error ? <p role="alert">{error}</p> : null}

      {history ? (
        <section className="miles-summary-grid" aria-label="Dashboard mileage summaries">
          <MileageSummaryCard title="This Year" summary={history.summaries.thisYear} />
          <MileageSummaryCard title="All Time" summary={history.summaries.allTime} />
        </section>
      ) : null}

      <div className="miles-placeholder" aria-label="Miles content placeholder">
        <p>Ride history and trends can be explored from the History page.</p>
        <p>
          Manage your profile assumptions from <Link to="/settings">Settings</Link>.
        </p>
      </div>
    </main>
  )
}
