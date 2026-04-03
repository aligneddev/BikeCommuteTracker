import { useEffect, useState } from 'react'
import type { QuickRideOption, RecordRideRequest } from '../services/ridesService'
import {
  getGasPrice,
  getQuickRideOptions,
  recordRide,
  getRideDefaults,
} from '../services/ridesService'

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
  const [weatherEdited, setWeatherEdited] = useState<boolean>(false)
  const [gasPrice, setGasPrice] = useState<string>('')
  const [gasPriceSource, setGasPriceSource] = useState<string>('')
  const [quickRideOptions, setQuickRideOptions] = useState<QuickRideOption[]>([])

  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const loadQuickRideOptions = async () => {
    try {
      const quickOptionsResponse = await getQuickRideOptions()
      setQuickRideOptions(quickOptionsResponse.options)
    } catch (error) {
      setQuickRideOptions([])
      console.error('Failed to load quick ride options:', error)
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
        await loadQuickRideOptions()
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

  const applyQuickRideOption = (option: QuickRideOption) => {
    setMiles(option.miles.toString())
    setRideMinutes(option.rideMinutes.toString())
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
        weatherUserOverridden: weatherEdited,
        gasPricePerGallon: gasPrice ? parseFloat(gasPrice) : undefined,
      }

      const response = await recordRide(request)
      setSuccessMessage(`Ride recorded successfully (ID: ${response.rideId})`)
      await loadQuickRideOptions()

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
        setWeatherEdited(false)
        setGasPrice('')
        setGasPriceSource('')
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

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {quickRideOptions.length > 0 && (
        <section aria-label="Quick ride options" className="quick-ride-options">
          <h2>Quick Ride Options</h2>
          <div className="quick-ride-options-list">
            {quickRideOptions.map((option, index) => (
              <button
                key={`${option.miles}-${option.rideMinutes}-${option.lastUsedAtLocal}-${index}`}
                type="button"
                onClick={() => applyQuickRideOption(option)}
              >
                {`${option.miles} mi - ${option.rideMinutes} min`}
              </button>
            ))}
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
