import { useEffect, useState } from 'react'
import type { CompassDirection, RidePreset, RecordRideRequest } from '../services/ridesService'
import {
  getGasPrice,
  getRideWeather,
  getRidePresets,
  recordRide,
  getRideDefaults,
  COMPASS_DIRECTIONS,
} from '../services/ridesService'
import { suggestDifficulty } from '../utils/windResistance'

const EIA_GAS_PRICE_SOURCE = 'Source: U.S. Energy Information Administration (EIA)'

export function RecordRidePage() {
  const [rideDateTimeLocal, setRideDateTimeLocal] = useState<string>('')
  const [miles, setMiles] = useState<string>('')
  const [rideMinutes, setRideMinutes] = useState<string>('')
  const [temperature, setTemperature] = useState<string>('')
  const [windSpeedMph, setWindSpeedMph] = useState<string>('')
  const [windDirectionDeg, setWindDirectionDeg] = useState<string>('')
  const [relativeHumidityPercent, setRelativeHumidityPercent] = useState<string>('')
  const [cloudCoverPercent, setCloudCoverPercent] = useState<string>('')
  const [precipitationType, setPrecipitationType] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [weatherEdited, setWeatherEdited] = useState<boolean>(false)
  const [gasPrice, setGasPrice] = useState<string>('')
  const [gasPriceSource, setGasPriceSource] = useState<string>('')
  const [ridePresets, setRidePresets] = useState<RidePreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)

  const [primaryTravelDirection, setPrimaryTravelDirection] = useState<CompassDirection | ''>('')
  const [difficulty, setDifficulty] = useState<string>('')
  const [difficultyAutoSuggested, setDifficultyAutoSuggested] = useState<boolean>(false)

  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const applyLoadedWeather = (weather: {
    temperature?: number
    windSpeedMph?: number
    windDirectionDeg?: number
    relativeHumidityPercent?: number
    cloudCoverPercent?: number
    precipitationType?: string
  }) => {
    setTemperature(weather.temperature != null ? weather.temperature.toString() : '')
    setWindSpeedMph(weather.windSpeedMph != null ? weather.windSpeedMph.toString() : '')
    setWindDirectionDeg(
      weather.windDirectionDeg != null ? weather.windDirectionDeg.toString() : ''
    )
    setRelativeHumidityPercent(
      weather.relativeHumidityPercent != null
        ? weather.relativeHumidityPercent.toString()
        : ''
    )
    setCloudCoverPercent(
      weather.cloudCoverPercent != null ? weather.cloudCoverPercent.toString() : ''
    )
    setPrecipitationType(weather.precipitationType ?? '')
    setWeatherEdited(false)
  }

  const handleLoadWeather = async () => {
    if (!rideDateTimeLocal) {
      setErrorMessage('Ride date/time is required to load weather')
      return
    }

    setLoadingWeather(true)
    setErrorMessage('')

    try {
      const weather = await getRideWeather(rideDateTimeLocal)
      applyLoadedWeather(weather)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load weather')
    } finally {
      setLoadingWeather(false)
    }
  }

  const loadRidePresets = async () => {
    try {
      const presetsResponse = await getRidePresets()
      setRidePresets(presetsResponse.presets)
    } catch (error) {
      setRidePresets([])
      console.error('Failed to load ride presets:', error)
    }
  }

  useEffect(() => {
    const initializeDefaults = async () => {
      try {
        const defaults = await getRideDefaults()

        // Set date/time to current local time
        const now = new Date()
        const localIso = now.toISOString().slice(0, 16)
        setRideDateTimeLocal(localIso)

        // Set optional defaults
        if (defaults.hasPreviousRide) {
          if (defaults.defaultMiles) setMiles(defaults.defaultMiles.toString())
          if (defaults.defaultRideMinutes)
            setRideMinutes(defaults.defaultRideMinutes.toString())
          if (defaults.defaultTemperature)
            setTemperature(defaults.defaultTemperature.toString())
          if (defaults.defaultWindSpeedMph)
            setWindSpeedMph(defaults.defaultWindSpeedMph.toString())
          if (defaults.defaultWindDirectionDeg)
            setWindDirectionDeg(defaults.defaultWindDirectionDeg.toString())
          if (defaults.defaultRelativeHumidityPercent)
            setRelativeHumidityPercent(defaults.defaultRelativeHumidityPercent.toString())
          if (defaults.defaultCloudCoverPercent)
            setCloudCoverPercent(defaults.defaultCloudCoverPercent.toString())
          if (defaults.defaultPrecipitationType)
            setPrecipitationType(defaults.defaultPrecipitationType)
          if (defaults.defaultGasPricePerGallon)
            setGasPrice(defaults.defaultGasPricePerGallon.toString())
        }

        try {
          const today = localIso.slice(0, 10)
          const lookup = await getGasPrice(today)
          if (lookup.isAvailable && lookup.pricePerGallon !== null) {
            setGasPrice(lookup.pricePerGallon.toString())
            setGasPriceSource(lookup.dataSource ?? EIA_GAS_PRICE_SOURCE)
          } else {
            setGasPriceSource('')
          }
        } catch (error) {
          setGasPriceSource('')
          console.error('Failed to load gas price:', error)
        }
      } catch (error) {
        console.error('Failed to load defaults:', error)
      }

      try {
        await loadRidePresets()
      } finally {
        setLoading(false)
      }
    }

    initializeDefaults()
  }, [])

  useEffect(() => {
    if (!rideDateTimeLocal) {
      return
    }

    const timerId = setTimeout(async () => {
      const dateOnly = rideDateTimeLocal.slice(0, 10)
      if (!dateOnly) {
        return
      }

      try {
        const lookup = await getGasPrice(dateOnly)
        if (lookup.isAvailable && lookup.pricePerGallon !== null) {
          setGasPrice(lookup.pricePerGallon.toString())
          setGasPriceSource(lookup.dataSource ?? EIA_GAS_PRICE_SOURCE)
        } else {
          setGasPriceSource('')
        }
      } catch (error) {
        setGasPriceSource('')
        // Keep the existing gas price value as fallback if lookup fails.
        console.error('Failed to refresh gas price for date change:', error)
      }
    }, 300)

    return () => clearTimeout(timerId)
  }, [rideDateTimeLocal])

  useEffect(() => {
    if (!primaryTravelDirection) return
    const suggestion = suggestDifficulty(
      windSpeedMph ? parseFloat(windSpeedMph) : undefined,
      primaryTravelDirection,
      windDirectionDeg ? parseInt(windDirectionDeg) : undefined
    )
    if (suggestion !== null) {
      setDifficulty(suggestion.toString())
      setDifficultyAutoSuggested(true)
    }
  }, [primaryTravelDirection, windSpeedMph, windDirectionDeg])

  const applyPreset = (preset: RidePreset) => {
    setPrimaryTravelDirection(preset.primaryDirection as CompassDirection)
    setRideMinutes(preset.durationMinutes.toString())
    // Keep current date, replace time with preset's exact start time
    const datePart = rideDateTimeLocal ? rideDateTimeLocal.slice(0, 11) : new Date().toISOString().slice(0, 11)
    setRideDateTimeLocal(`${datePart}${preset.exactStartTimeLocal}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    // Client-side validation
    const milesNum = parseFloat(miles)
    if (!miles || milesNum <= 0) {
      setErrorMessage('Miles must be greater than 0')
      return
    }

    if (milesNum > 200) {
      setErrorMessage('Miles must be less than or equal to 200')
      return
    }

    if (rideMinutes && parseInt(rideMinutes) <= 0) {
      setErrorMessage('Ride minutes must be greater than 0')
      return
    }

    if (note.length > 500) {
      setErrorMessage('Note must be 500 characters or fewer')
      return
    }

    if (difficulty) {
      const diffNum = parseInt(difficulty)
      if (diffNum < 1 || diffNum > 5) {
        setErrorMessage('Difficulty must be between 1 and 5')
        return
      }
    }

    if (gasPrice) {
      const gasPriceNum = parseFloat(gasPrice)
      if (Number.isNaN(gasPriceNum) || gasPriceNum < 0.01 || gasPriceNum > 999.9999) {
        setErrorMessage('Gas price must be a number between 0.01 and 999.9999')
        return
      }
    }

    setSubmitting(true)
    try {
      const request: RecordRideRequest = {
        rideDateTimeLocal,
        miles: milesNum,
        rideMinutes: rideMinutes ? parseInt(rideMinutes) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        windSpeedMph: windSpeedMph ? parseFloat(windSpeedMph) : undefined,
        windDirectionDeg: windDirectionDeg ? parseInt(windDirectionDeg) : undefined,
        relativeHumidityPercent: relativeHumidityPercent
          ? parseInt(relativeHumidityPercent)
          : undefined,
        cloudCoverPercent: cloudCoverPercent ? parseInt(cloudCoverPercent) : undefined,
        precipitationType: precipitationType || undefined,
        note: note.length > 0 ? note : undefined,
        weatherUserOverridden: weatherEdited,
        gasPricePerGallon: gasPrice ? parseFloat(gasPrice) : undefined,
        difficulty: difficulty ? parseInt(difficulty) : undefined,
        primaryTravelDirection: primaryTravelDirection || undefined,
        selectedPresetId: selectedPresetId ?? undefined,
      }

      const response = await recordRide(request)
      setSuccessMessage(`Ride recorded successfully (ID: ${response.rideId})`)
      await loadRidePresets()
      setSelectedPresetId(null)

      // Keep form values but clear after delay
      setTimeout(() => {
        setRideDateTimeLocal('')
        setMiles('')
        setRideMinutes('')
        setTemperature('')
        setWindSpeedMph('')
        setWindDirectionDeg('')
        setRelativeHumidityPercent('')
        setCloudCoverPercent('')
        setPrecipitationType('')
        setNote('')
        setWeatherEdited(false)
        setGasPrice('')
        setGasPriceSource('')
        setPrimaryTravelDirection('')
        setDifficulty('')
        setDifficultyAutoSuggested(false)
        setSelectedPresetId(null)
        setSuccessMessage('')
      }, 3000)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to record ride'
      )
      // Form values are preserved for retry
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div>Loading defaults...</div>

  return (
    <div className="record-ride-page">
      <h1>Record a Ride</h1>
      <p>
        Need to add past rides in bulk? <a href="/rides/import">Import rides from CSV</a>.
      </p>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {ridePresets.length > 0 && (
        <section className="ride-presets">
          <div className="form-group">
            <label htmlFor="ridePreset">Ride Preset</label>
            <select
              id="ridePreset"
              value={selectedPresetId ?? ''}
              onChange={(e) => setSelectedPresetId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">-- Select a preset --</option>
              {ridePresets.map((preset) => (
                <option key={preset.presetId} value={preset.presetId}>
                  {preset.name} ({preset.periodTag}, {preset.exactStartTimeLocal}, {preset.durationMinutes} min)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const preset = ridePresets.find((p) => p.presetId === selectedPresetId)
                if (preset) applyPreset(preset)
              }}
              disabled={selectedPresetId === null}
            >
              Apply Preset
            </button>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="rideDateTimeLocal">Date & Time</label>
          <input
            id="rideDateTimeLocal"
            type="datetime-local"
            value={rideDateTimeLocal}
            onChange={(e) => setRideDateTimeLocal(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="miles">Miles (required)</label>
          <input
            id="miles"
            type="number"
            step="0.01"
            value={miles}
            onChange={(e) => {
              setMiles(e.target.value)
              if (errorMessage.length > 0) {
                setErrorMessage('')
              }
            }}
            onInvalid={(e) => {
              e.preventDefault()
              setErrorMessage('Miles must be greater than 0')
            }}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="rideMinutes">Duration (minutes, optional)</label>
          <input
            id="rideMinutes"
            type="number"
            value={rideMinutes}
            onChange={(e) => setRideMinutes(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="temperature">Temperature (optional)</label>
          <input
            id="temperature"
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => {
              setTemperature(e.target.value)
              setWeatherEdited(true)
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="windSpeedMph">Wind Speed (mph, optional)</label>
          <input
            id="windSpeedMph"
            type="number"
            step="0.1"
            value={windSpeedMph}
            onChange={(e) => {
              setWindSpeedMph(e.target.value)
              setWeatherEdited(true)
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="windDirectionDeg">Wind Direction (deg, optional)</label>
          <input
            id="windDirectionDeg"
            type="number"
            value={windDirectionDeg}
            onChange={(e) => {
              setWindDirectionDeg(e.target.value)
              setWeatherEdited(true)
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="relativeHumidityPercent">Relative Humidity (%, optional)</label>
          <input
            id="relativeHumidityPercent"
            type="number"
            value={relativeHumidityPercent}
            onChange={(e) => {
              setRelativeHumidityPercent(e.target.value)
              setWeatherEdited(true)
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="cloudCoverPercent">Cloud Cover (%, optional)</label>
          <input
            id="cloudCoverPercent"
            type="number"
            value={cloudCoverPercent}
            onChange={(e) => {
              setCloudCoverPercent(e.target.value)
              setWeatherEdited(true)
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="precipitationType">Precipitation Type (optional)</label>
          <input
            id="precipitationType"
            type="text"
            value={precipitationType}
            onChange={(e) => {
              setPrecipitationType(e.target.value)
              setWeatherEdited(true)
            }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label htmlFor="primaryTravelDirection">Primary Direction of Travel (optional)</label>
            <span
              className="info-icon"
              title="Your primary travel direction is used with wind data to calculate wind resistance — how much the wind helped or hindered your ride."
              aria-label="Direction info"
              style={{ cursor: 'help' }}
            >
              ℹ️
            </span>
          </div>
          <select
            id="primaryTravelDirection"
            value={primaryTravelDirection}
            onChange={(e) => {
              setPrimaryTravelDirection(e.target.value as CompassDirection | '')
              setDifficultyAutoSuggested(false)
            }}
          >
            <option value="">-- Select direction --</option>
            {COMPASS_DIRECTIONS.map((dir) => (
              <option key={dir} value={dir}>{dir}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="difficulty">
            Difficulty (1 = Very Easy, 5 = Very Hard, optional)
            {difficultyAutoSuggested && difficulty ? ' ✦ auto-suggested' : ''}
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value)
              setDifficultyAutoSuggested(false)
            }}
          >
            <option value="">-- Select difficulty --</option>
            <option value="1">1 – Very Easy</option>
            <option value="2">2 – Easy</option>
            <option value="3">3 – Moderate</option>
            <option value="4">4 – Hard</option>
            <option value="5">5 – Very Hard</option>
          </select>
        </div>

        <div className="form-group">
          <button type="button" onClick={() => void handleLoadWeather()} disabled={loadingWeather}>
            {loadingWeather ? 'Loading Weather...' : 'Load Weather'}
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="gasPrice">Gas Price ($/gal) (optional)</label>
          <input
            id="gasPrice"
            type="number"
            step="0.0001"
            min="0"
            value={gasPrice}
            onChange={(e) => {
              setGasPrice(e.target.value)
              setGasPriceSource('')
              if (errorMessage.length > 0) {
                setErrorMessage('')
              }
            }}
            onInvalid={(e) => {
              e.preventDefault()
              setErrorMessage('Gas price must be greater than 0')
            }}
          />
          {gasPriceSource ? <p>{gasPriceSource}</p> : null}
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Record Ride'}
        </button>
      </form>
    </div>
  )
}
