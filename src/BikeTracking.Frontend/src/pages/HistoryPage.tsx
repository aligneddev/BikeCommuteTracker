import { useEffect, useMemo, useState } from 'react'
import type {
  GetRideHistoryParams,
  RideHistoryResponse,
  RideHistoryRow,
} from '../services/ridesService'
import { getRideHistory } from '../services/ridesService'
import { MileageSummaryCard } from '../components/mileage-summary-card/mileage-summary-card'
import {
  formatMiles,
  formatRideDate,
  formatRideDuration,
  formatTemperature,
} from './miles/history-page.helpers'
import './HistoryPage.css'

function HistoryTable({ rides }: { rides: RideHistoryRow[] }) {
  if (rides.length === 0) {
    return <p className="history-page__empty">No rides found for this rider.</p>
  }

  return (
    <table className="history-page__table" aria-label="Ride history table">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Miles</th>
          <th scope="col">Duration</th>
          <th scope="col">Temperature</th>
        </tr>
      </thead>
      <tbody>
        {rides.map((ride) => (
          <tr key={ride.rideId}>
            <td>{formatRideDate(ride.rideDateTimeLocal)}</td>
            <td>{formatMiles(ride.miles)}</td>
            <td>{formatRideDuration(ride.rideMinutes) || 'N/A'}</td>
            <td>{formatTemperature(ride.temperature) || 'N/A'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function HistoryPage() {
  const [data, setData] = useState<RideHistoryResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')

  async function loadHistory(params: GetRideHistoryParams): Promise<void> {
    setIsLoading(true)
    setError('')
    try {
      const response = await getRideHistory(params)
      setData(response)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load ride history'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory({ page: 1, pageSize: 25 })
  }, [])

  const summaries = useMemo(() => {
    if (!data) {
      return null
    }

    return [
      { title: 'This Month', summary: data.summaries.thisMonth },
      { title: 'This Year', summary: data.summaries.thisYear },
      { title: 'All Time', summary: data.summaries.allTime },
    ]
  }, [data])

  const hasActiveFilter = fromDate.length > 0 || toDate.length > 0

  async function handleApplyFilter(): Promise<void> {
    if (fromDate && toDate && fromDate > toDate) {
      setError('Start date must be before or equal to end date.')
      return
    }

    await loadHistory({
      from: fromDate || undefined,
      to: toDate || undefined,
      page: 1,
      pageSize: 25,
    })
  }

  async function handleClearFilter(): Promise<void> {
    setFromDate('')
    setToDate('')
    await loadHistory({ page: 1, pageSize: 25 })
  }

  return (
    <main className="history-page">
      <header className="history-page__header">
        <h1>Ride History</h1>
      </header>

      <section className="history-page__filters" aria-label="Date range filters">
        <div className="history-page__filter-field">
          <label htmlFor="history-from-date">From</label>
          <input
            id="history-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="history-page__filter-field">
          <label htmlFor="history-to-date">To</label>
          <input
            id="history-to-date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <div className="history-page__filter-actions">
          <button type="button" onClick={() => void handleApplyFilter()}>
            Apply Filter
          </button>
          <button
            type="button"
            className="history-page__clear-button"
            onClick={() => void handleClearFilter()}
            disabled={!hasActiveFilter}
          >
            Clear Filter
          </button>
        </div>
      </section>

      {isLoading ? <p>Loading history...</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {summaries ? (
        <section className="history-page__summaries" aria-label="Ride summaries">
          {summaries.map((item) => (
            <MileageSummaryCard
              key={item.summary.period}
              title={item.title}
              summary={item.summary}
            />
          ))}
        </section>
      ) : null}

      <section className="history-page__total" aria-label="Visible total miles">
        <h2>Total Miles (Visible)</h2>
        <p>{formatMiles(data?.filteredTotal.miles ?? 0)}</p>
      </section>

      <section className="history-page__grid" aria-label="Ride history grid">
        <HistoryTable rides={data?.rides ?? []} />
      </section>
    </main>
  )
}