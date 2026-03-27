import { useEffect, useMemo, useState } from 'react'
import type {
  GetRideHistoryParams,
  RideHistoryResponse,
  RideHistoryRow,
} from '../services/ridesService'
import { editRide, getRideHistory } from '../services/ridesService'
import { MileageSummaryCard } from '../components/mileage-summary-card/mileage-summary-card'
import {
  formatMiles,
  formatRideDate,
  formatRideDuration,
  formatTemperature,
} from './miles/history-page.helpers'
import './HistoryPage.css'

function HistoryTable({
  rides,
  editingRideId,
  editedMiles,
  onStartEdit,
  onEditedMilesChange,
  onSaveEdit,
  onCancelEdit,
}: {
  rides: RideHistoryRow[]
  editingRideId: number | null
  editedMiles: string
  onStartEdit: (ride: RideHistoryRow) => void
  onEditedMilesChange: (value: string) => void
  onSaveEdit: (ride: RideHistoryRow) => void
  onCancelEdit: () => void
}) {
  if (rides.length === 0) {
    return <p className="history-page-empty">No rides found for this rider.</p>
  }

  return (
    <table className="history-page-table" aria-label="Ride history table">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Miles</th>
          <th scope="col">Duration</th>
          <th scope="col">Temperature</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rides.map((ride) => (
          <tr key={ride.rideId}>
            <td>{formatRideDate(ride.rideDateTimeLocal)}</td>
            <td>
              {editingRideId === ride.rideId ? (
                <div className="history-page-inline-editor">
                  <label htmlFor={`edit-ride-miles-${ride.rideId}`}>Miles</label>
                  <input
                    id={`edit-ride-miles-${ride.rideId}`}
                    type="number"
                    step="0.1"
                    value={editedMiles}
                    onChange={(event) => onEditedMilesChange(event.target.value)}
                  />
                </div>
              ) : (
                formatMiles(ride.miles)
              )}
            </td>
            <td>{formatRideDuration(ride.rideMinutes) || 'N/A'}</td>
            <td>{formatTemperature(ride.temperature) || 'N/A'}</td>
            <td>
              {editingRideId === ride.rideId ? (
                <div className="history-page-edit-actions">
                  <button type="button" className="history-page-edit-button" onClick={() => onSaveEdit(ride)}>
                    Save
                  </button>
                  <button type="button" className="history-page-edit-button" onClick={onCancelEdit}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="history-page-edit-button"
                  onClick={() => onStartEdit(ride)}
                >
                  Edit
                </button>
              )}
            </td>
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
  const [editingRideId, setEditingRideId] = useState<number | null>(null)
  const [editedMiles, setEditedMiles] = useState<string>('')

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

  function handleStartEdit(ride: RideHistoryRow): void {
    setEditingRideId(ride.rideId)
    setEditedMiles(ride.miles.toFixed(1))
  }

  function handleCancelEdit(): void {
    setEditingRideId(null)
    setEditedMiles('')
  }

  async function handleSaveEdit(ride: RideHistoryRow): Promise<void> {
    const milesValue = Number(editedMiles)
    if (!Number.isFinite(milesValue) || milesValue <= 0) {
      setError('Miles must be greater than 0')
      return
    }

    const result = await editRide(ride.rideId, {
      rideDateTimeLocal: ride.rideDateTimeLocal,
      miles: milesValue,
      rideMinutes: ride.rideMinutes,
      temperature: ride.temperature,
      // Version tokens are added to history rows in later tasks; use baseline v1 for now.
      expectedVersion: 1,
    })

    if (!result.ok) {
      const { code, message, currentVersion } = result.error
      if (code === 'RIDE_VERSION_CONFLICT') {
        const versionInfo = currentVersion ? ` Current version: ${currentVersion}.` : ''
        setError(`${message}${versionInfo}`)
      } else {
        setError(message)
      }
      return
    }

    setError('')
    setEditingRideId(null)
    setEditedMiles('')

    await loadHistory({
      from: fromDate || undefined,
      to: toDate || undefined,
      page: data?.page ?? 1,
      pageSize: data?.pageSize ?? 25,
    })
  }

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
      <header className="history-page-header">
        <h1>Ride History</h1>
      </header>

      <section className="history-page-filters" aria-label="Date range filters">
        <div className="history-page-filter-field">
          <label htmlFor="history-from-date">From</label>
          <input
            id="history-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="history-page-filter-field">
          <label htmlFor="history-to-date">To</label>
          <input
            id="history-to-date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <div className="history-page-filter-actions">
          <button type="button" onClick={() => void handleApplyFilter()}>
            Apply Filter
          </button>
          <button
            type="button"
            className="history-page-clear-button"
            onClick={() => void handleClearFilter()}
            disabled={!hasActiveFilter}
          >
            Clear Filter
          </button>
        </div>
      </section>

      {isLoading ? <p>Loading history...</p> : null}
      {error ? (
        <p role="alert" className="history-page-error">
          {error}
        </p>
      ) : null}

      {summaries ? (
        <section className="history-page-summaries" aria-label="Ride summaries">
          {summaries.map((item) => (
            <MileageSummaryCard
              key={item.summary.period}
              title={item.title}
              summary={item.summary}
            />
          ))}
        </section>
      ) : null}

      <section className="history-page-total" aria-label="Visible total miles">
        <h2>Total Miles (Visible)</h2>
        <p>{formatMiles(data?.filteredTotal.miles ?? 0)}</p>
      </section>

      <section className="history-page-grid" aria-label="Ride history grid">
        <HistoryTable
          rides={data?.rides ?? []}
          editingRideId={editingRideId}
          editedMiles={editedMiles}
          onStartEdit={handleStartEdit}
          onEditedMilesChange={setEditedMiles}
          onSaveEdit={(ride) => void handleSaveEdit(ride)}
          onCancelEdit={handleCancelEdit}
        />
      </section>
    </main>
  )
}