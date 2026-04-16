import { useEffect, useMemo, useState } from 'react'
import type {
  GetRideHistoryParams,
  RideHistoryResponse,
  RideHistoryRow,
} from '../services/ridesService'
import {
  deleteRide,
  editRide,
  getGasPrice,
  getRideHistory,
  getRideWeather,
} from '../services/ridesService'
import { RideDeleteDialog } from '../components/RideDeleteDialog/RideDeleteDialog'
import { MileageSummaryCard } from '../components/mileage-summary-card/mileage-summary-card'
import {
  formatMiles,
  formatRideDate,
  formatRideDuration,
  formatTemperature,
} from './miles/history-page.helpers'
import './HistoryPage.css'

const EIA_GAS_PRICE_SOURCE = 'Source: (EIA)'

function HistoryTable({
  rides,
  editingRideId,
  editedRideDateTimeLocal,
  editedMiles,
  editedTemperature,
  editedWindSpeedMph,
  editedWindDirectionDeg,
  editedRelativeHumidityPercent,
  editedCloudCoverPercent,
  editedPrecipitationType,
  editedNote,
  editedGasPrice,
  editedGasPriceSource,
  loadingWeather,
  onStartEdit,
  onEditedRideDateTimeLocalChange,
  onEditedMilesChange,
  onEditedTemperatureChange,
  onEditedWindSpeedMphChange,
  onEditedWindDirectionDegChange,
  onEditedRelativeHumidityPercentChange,
  onEditedCloudCoverPercentChange,
  onEditedPrecipitationTypeChange,
  onEditedNoteChange,
  onEditedGasPriceChange,
  onLoadWeather,
  onSaveEdit,
  onCancelEdit,
  onStartDelete,
}: {
  rides: RideHistoryRow[]
  editingRideId: number | null
  editedRideDateTimeLocal: string
  editedMiles: string
  editedTemperature: string
  editedWindSpeedMph: string
  editedWindDirectionDeg: string
  editedRelativeHumidityPercent: string
  editedCloudCoverPercent: string
  editedPrecipitationType: string
  editedNote: string
  editedGasPrice: string
  editedGasPriceSource: string
  loadingWeather: boolean
  onStartEdit: (ride: RideHistoryRow) => void
  onEditedRideDateTimeLocalChange: (value: string) => void
  onEditedMilesChange: (value: string) => void
  onEditedTemperatureChange: (value: string) => void
  onEditedWindSpeedMphChange: (value: string) => void
  onEditedWindDirectionDegChange: (value: string) => void
  onEditedRelativeHumidityPercentChange: (value: string) => void
  onEditedCloudCoverPercentChange: (value: string) => void
  onEditedPrecipitationTypeChange: (value: string) => void
  onEditedNoteChange: (value: string) => void
  onEditedGasPriceChange: (value: string) => void
  onLoadWeather: () => void
  onSaveEdit: (ride: RideHistoryRow) => void
  onCancelEdit: () => void
  onStartDelete: (ride: RideHistoryRow) => void
}) {
  const [openNoteRideId, setOpenNoteRideId] = useState<number | null>(null)

  if (rides.length === 0) {
    return <p className="history-page-empty">No rides found for this rider.</p>
  }

  return (
    <table className="history-page-table" aria-label="Ride history table">
      <thead>
        <tr>
          <th scope="col">Dateddddd</th>
          <th scope="col">Miles</th>
          <th scope="col">Duration</th>
          <th scope="col">Temperature</th>
          <th scope="col">Gas Price</th>
          <th scope="col">Notes</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rides.map((ride) => (
          <tr key={ride.rideId}>
            <td>
              {editingRideId === ride.rideId ? (
                <div className="history-page-inline-editor">
                  <label htmlFor={`edit-ride-date-${ride.rideId}`}>Date</label>
                  <input
                    id={`edit-ride-date-${ride.rideId}`}
                    type="datetime-local"
                    value={editedRideDateTimeLocal}
                    onChange={(event) =>
                      onEditedRideDateTimeLocalChange(event.target.value)
                    }
                  />
                </div>
              ) : (
                formatRideDate(ride.rideDateTimeLocal)
              )}
            </td>
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
            <td>
              {editingRideId === ride.rideId ? (
                <div className="history-page-inline-editor">
                  <label htmlFor={`edit-ride-temperature-${ride.rideId}`}>Temperature</label>
                  <input
                    id={`edit-ride-temperature-${ride.rideId}`}
                    type="number"
                    step="0.1"
                    value={editedTemperature}
                    onChange={(event) => onEditedTemperatureChange(event.target.value)}
                  />
                  <label htmlFor={`edit-ride-wind-speed-${ride.rideId}`}>Wind Speed</label>
                  <input
                    id={`edit-ride-wind-speed-${ride.rideId}`}
                    type="number"
                    step="0.1"
                    value={editedWindSpeedMph}
                    onChange={(event) => onEditedWindSpeedMphChange(event.target.value)}
                  />
                  <label htmlFor={`edit-ride-wind-direction-${ride.rideId}`}>Wind Direction</label>
                  <input
                    id={`edit-ride-wind-direction-${ride.rideId}`}
                    type="number"
                    value={editedWindDirectionDeg}
                    onChange={(event) => onEditedWindDirectionDegChange(event.target.value)}
                  />
                  <label htmlFor={`edit-ride-relative-humidity-${ride.rideId}`}>Relative Humidity</label>
                  <input
                    id={`edit-ride-relative-humidity-${ride.rideId}`}
                    type="number"
                    value={editedRelativeHumidityPercent}
                    onChange={(event) =>
                      onEditedRelativeHumidityPercentChange(event.target.value)
                    }
                  />
                  <label htmlFor={`edit-ride-cloud-cover-${ride.rideId}`}>Cloud Cover</label>
                  <input
                    id={`edit-ride-cloud-cover-${ride.rideId}`}
                    type="number"
                    value={editedCloudCoverPercent}
                    onChange={(event) => onEditedCloudCoverPercentChange(event.target.value)}
                  />
                  <label htmlFor={`edit-ride-precipitation-type-${ride.rideId}`}>Precipitation Type</label>
                  <input
                    id={`edit-ride-precipitation-type-${ride.rideId}`}
                    type="text"
                    value={editedPrecipitationType}
                    onChange={(event) => onEditedPrecipitationTypeChange(event.target.value)}
                  />
                  <button type="button" onClick={onLoadWeather} disabled={loadingWeather}>
                    {loadingWeather ? 'Loading Weather...' : 'Load Weather'}
                  </button>
                </div>
              ) : (
                formatTemperature(ride.temperature) || 'N/A'
              )}
            </td>
            <td>
              {editingRideId === ride.rideId ? (
                <div className="history-page-inline-editor">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label htmlFor={`edit-ride-gas-price-${ride.rideId}`}>Gas Price</label>
                    {editedGasPriceSource ? <span className="info-icon" style={{ cursor: 'pointer' }} title={editedGasPriceSource}>ℹ️</span> : null}
                  </div>
                  <input
                    id={`edit-ride-gas-price-${ride.rideId}`}
                    type="number"
                    step="0.0001"
                    min="0"
                    value={editedGasPrice}
                    onChange={(event) => onEditedGasPriceChange(event.target.value)}
                  />
                </div>
              ) : ride.gasPricePerGallon != null ? (
                `$${ride.gasPricePerGallon.toFixed(4)}`
              ) : (
                'N/A'
              )}
            </td>
            <td>
              {editingRideId === ride.rideId ? (
                <div className="history-page-inline-editor">
                  <label htmlFor={`edit-ride-note-${ride.rideId}`}>Notes</label>
                  <textarea
                    id={`edit-ride-note-${ride.rideId}`}
                    value={editedNote}
                    maxLength={500}
                    onChange={(event) => onEditedNoteChange(event.target.value)}
                  />
                </div>
              ) : ride.note ? (
                <div
                  className={`history-note-wrap ${
                    openNoteRideId === ride.rideId ? 'is-open' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="history-note-button"
                    aria-label="View ride note"
                    onClick={() =>
                      setOpenNoteRideId((current) =>
                        current === ride.rideId ? null : ride.rideId
                      )
                    }
                  >
                    i
                  </button>
                  <div className="history-note-popover" role="tooltip">
                    {ride.note}
                  </div>
                </div>
              ) : null}
            </td>
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
                <div className="history-page-edit-actions">
                  <button
                    type="button"
                    className="history-page-edit-button"
                    onClick={() => onStartEdit(ride)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="history-page-delete-button"
                    onClick={() => onStartDelete(ride)}
                  >
                    Delete
                  </button>
                </div>
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
  const [editedRideDateTimeLocal, setEditedRideDateTimeLocal] = useState<string>('')
  const [editedMiles, setEditedMiles] = useState<string>('')
  const [editedTemperature, setEditedTemperature] = useState<string>('')
  const [editedWindSpeedMph, setEditedWindSpeedMph] = useState<string>('')
  const [editedWindDirectionDeg, setEditedWindDirectionDeg] = useState<string>('')
  const [editedRelativeHumidityPercent, setEditedRelativeHumidityPercent] = useState<string>('')
  const [editedCloudCoverPercent, setEditedCloudCoverPercent] = useState<string>('')
  const [editedPrecipitationType, setEditedPrecipitationType] = useState<string>('')
  const [editedNote, setEditedNote] = useState<string>('')
  const [weatherEditedManually, setWeatherEditedManually] = useState<boolean>(false)
  const [editedGasPrice, setEditedGasPrice] = useState<string>('')
  const [editedGasPriceSource, setEditedGasPriceSource] = useState<string>('')
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false)
  const [ridePendingDelete, setRidePendingDelete] = useState<RideHistoryRow | null>(null)

  function applyLoadedWeather(weather: {
    temperature?: number
    windSpeedMph?: number
    windDirectionDeg?: number
    relativeHumidityPercent?: number
    cloudCoverPercent?: number
    precipitationType?: string
  }): void {
    setEditedTemperature(weather.temperature != null ? weather.temperature.toString() : '')
    setEditedWindSpeedMph(weather.windSpeedMph != null ? weather.windSpeedMph.toString() : '')
    setEditedWindDirectionDeg(
      weather.windDirectionDeg != null ? weather.windDirectionDeg.toString() : ''
    )
    setEditedRelativeHumidityPercent(
      weather.relativeHumidityPercent != null
        ? weather.relativeHumidityPercent.toString()
        : ''
    )
    setEditedCloudCoverPercent(
      weather.cloudCoverPercent != null ? weather.cloudCoverPercent.toString() : ''
    )
    setEditedPrecipitationType(weather.precipitationType ?? '')
    setWeatherEditedManually(false)
  }

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
    setEditedRideDateTimeLocal(ride.rideDateTimeLocal.slice(0, 16))
    setEditedMiles(ride.miles.toFixed(1))
    setEditedTemperature(ride.temperature != null ? ride.temperature.toString() : '')
    setEditedWindSpeedMph(ride.windSpeedMph != null ? ride.windSpeedMph.toString() : '')
    setEditedWindDirectionDeg(
      ride.windDirectionDeg != null ? ride.windDirectionDeg.toString() : ''
    )
    setEditedRelativeHumidityPercent(
      ride.relativeHumidityPercent != null ? ride.relativeHumidityPercent.toString() : ''
    )
    setEditedCloudCoverPercent(
      ride.cloudCoverPercent != null ? ride.cloudCoverPercent.toString() : ''
    )
    setEditedPrecipitationType(ride.precipitationType ?? '')
    setEditedNote(ride.note ?? '')
    setWeatherEditedManually(false)
    setEditedGasPrice(
      ride.gasPricePerGallon != null ? ride.gasPricePerGallon.toFixed(4) : ''
    )
  }

  function handleCancelEdit(): void {
    setEditingRideId(null)
    setEditedRideDateTimeLocal('')
    setEditedMiles('')
    setEditedTemperature('')
    setEditedWindSpeedMph('')
    setEditedWindDirectionDeg('')
    setEditedRelativeHumidityPercent('')
    setEditedCloudCoverPercent('')
    setEditedPrecipitationType('')
    setEditedNote('')
    setWeatherEditedManually(false)
    setEditedGasPrice('')
    setEditedGasPriceSource('')
  }

  async function handleLoadWeather(): Promise<void> {
    if (!editedRideDateTimeLocal) {
      setError('Ride date/time is required to load weather')
      return
    }

    setLoadingWeather(true)
    setError('')

    try {
      const weather = await getRideWeather(editedRideDateTimeLocal)
      applyLoadedWeather(weather)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load weather'
      setError(message)
    } finally {
      setLoadingWeather(false)
    }
  }

  useEffect(() => {
    if (editingRideId === null || !editedRideDateTimeLocal) {
      return
    }

    const timerId = setTimeout(async () => {
      const dateOnly = editedRideDateTimeLocal.slice(0, 10)
      if (!dateOnly) {
        return
      }

      try {
        const lookup = await getGasPrice(dateOnly)
        if (lookup.isAvailable && lookup.pricePerGallon !== null) {
          setEditedGasPrice(lookup.pricePerGallon.toString())
          const source = lookup.dataSource ?? EIA_GAS_PRICE_SOURCE;
          if (source.includes('EIA')) {
            setEditedGasPriceSource(EIA_GAS_PRICE_SOURCE)
          } else {
            setEditedGasPriceSource(source.substring(0, 15))
          }
        } else {
          setEditedGasPriceSource('')
        }
      } catch {
        setEditedGasPriceSource('')
        // Keep current gas price value if lookup fails.
      }
    }, 300)

    return () => clearTimeout(timerId)
  }, [editingRideId, editedRideDateTimeLocal])

  async function handleSaveEdit(ride: RideHistoryRow): Promise<void> {
    const milesValue = Number(editedMiles)
    if (!Number.isFinite(milesValue) || milesValue <= 0) {
      setError('Miles must be greater than 0')
      return
    }

    if (milesValue > 200) {
      setError('Miles must be less than or equal to 200')
      return
    }

    if (editedNote.length > 500) {
      setError('Note must be 500 characters or fewer')
      return
    }

    let gasPriceValue: number | undefined
    if (editedGasPrice.length > 0) {
      gasPriceValue = Number(editedGasPrice)
      if (
        !Number.isFinite(gasPriceValue) ||
        gasPriceValue < 0.01 ||
        gasPriceValue > 999.9999
      ) {
        setError('Gas price must be between 0.01 and 999.9999')
        return
      }
    }

    const temperatureValue =
      editedTemperature.length > 0 ? Number(editedTemperature) : undefined
    const windSpeedMphValue =
      editedWindSpeedMph.length > 0 ? Number(editedWindSpeedMph) : undefined
    const windDirectionDegValue =
      editedWindDirectionDeg.length > 0 ? Number(editedWindDirectionDeg) : undefined
    const relativeHumidityPercentValue =
      editedRelativeHumidityPercent.length > 0
        ? Number(editedRelativeHumidityPercent)
        : undefined
    const cloudCoverPercentValue =
      editedCloudCoverPercent.length > 0 ? Number(editedCloudCoverPercent) : undefined
    const precipitationTypeValue =
      editedPrecipitationType.length > 0 ? editedPrecipitationType : undefined

    const result = await editRide(ride.rideId, {
      rideDateTimeLocal: editedRideDateTimeLocal || ride.rideDateTimeLocal,
      miles: milesValue,
      rideMinutes: ride.rideMinutes,
      temperature: temperatureValue,
      gasPricePerGallon: gasPriceValue,
      windSpeedMph: windSpeedMphValue,
      windDirectionDeg: windDirectionDegValue,
      relativeHumidityPercent: relativeHumidityPercentValue,
      cloudCoverPercent: cloudCoverPercentValue,
      precipitationType: precipitationTypeValue,
      note: editedNote,
      weatherUserOverridden: weatherEditedManually,
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
    setEditedRideDateTimeLocal('')
    setEditedMiles('')
    setEditedTemperature('')
    setEditedWindSpeedMph('')
    setEditedWindDirectionDeg('')
    setEditedRelativeHumidityPercent('')
    setEditedCloudCoverPercent('')
    setEditedPrecipitationType('')
    setEditedNote('')
    setWeatherEditedManually(false)
    setEditedGasPrice('')
    setEditedGasPriceSource('')

    await loadHistory({
      from: fromDate || undefined,
      to: toDate || undefined,
      page: data?.page ?? 1,
      pageSize: data?.pageSize ?? 25,
    })
  }

  function handleStartDelete(ride: RideHistoryRow): void {
    setRidePendingDelete(ride)
    setError('')
  }

  function handleCancelDelete(): void {
    setRidePendingDelete(null)
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!ridePendingDelete) {
      return
    }

    const result = await deleteRide(ridePendingDelete.rideId)
    if (!result.ok) {
      setError(result.error.message)
      throw new Error(result.error.message)
    }

    setError('')
    setRidePendingDelete(null)

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
        <p className="history-page-import-link">
          Need to add older rides? <a href="/rides/import">Import rides from CSV</a>.
        </p>
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
          editedRideDateTimeLocal={editedRideDateTimeLocal}
          editedMiles={editedMiles}
          editedTemperature={editedTemperature}
          editedWindSpeedMph={editedWindSpeedMph}
          editedWindDirectionDeg={editedWindDirectionDeg}
          editedRelativeHumidityPercent={editedRelativeHumidityPercent}
          editedCloudCoverPercent={editedCloudCoverPercent}
          editedPrecipitationType={editedPrecipitationType}
          editedNote={editedNote}
          editedGasPrice={editedGasPrice}
          editedGasPriceSource={editedGasPriceSource}
          loadingWeather={loadingWeather}
          onStartEdit={handleStartEdit}
          onEditedRideDateTimeLocalChange={setEditedRideDateTimeLocal}
          onEditedMilesChange={setEditedMiles}
          onEditedTemperatureChange={(value) => {
            setEditedTemperature(value)
            setWeatherEditedManually(true)
          }}
          onEditedWindSpeedMphChange={(value) => {
            setEditedWindSpeedMph(value)
            setWeatherEditedManually(true)
          }}
          onEditedWindDirectionDegChange={(value) => {
            setEditedWindDirectionDeg(value)
            setWeatherEditedManually(true)
          }}
          onEditedRelativeHumidityPercentChange={(value) => {
            setEditedRelativeHumidityPercent(value)
            setWeatherEditedManually(true)
          }}
          onEditedCloudCoverPercentChange={(value) => {
            setEditedCloudCoverPercent(value)
            setWeatherEditedManually(true)
          }}
          onEditedPrecipitationTypeChange={(value) => {
            setEditedPrecipitationType(value)
            setWeatherEditedManually(true)
          }}
          onEditedNoteChange={setEditedNote}
          onEditedGasPriceChange={(value) => {
            setEditedGasPrice(value)
            setEditedGasPriceSource('')
          }}
          onLoadWeather={() => void handleLoadWeather()}
          onSaveEdit={(ride) => void handleSaveEdit(ride)}
          onCancelEdit={handleCancelEdit}
          onStartDelete={handleStartDelete}
        />
      </section>

      <RideDeleteDialog
        key={ridePendingDelete ? `delete-${ridePendingDelete.rideId}` : 'delete-closed'}
        isOpen={ridePendingDelete !== null}
        ride={ridePendingDelete}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </main>
  )
}