import { useEffect, useState } from 'react'
import type { RecordRideRequest } from '../services/ridesService'
import { recordRide, getRideDefaults } from '../services/ridesService'

export function RecordRidePage() {
  const [rideDateTimeLocal, setRideDateTimeLocal] = useState<string>('')
  const [miles, setMiles] = useState<string>('')
  const [rideMinutes, setRideMinutes] = useState<string>('')
  const [temperature, setTemperature] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

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
        }
      } catch (error) {
        console.error('Failed to load defaults:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeDefaults()
  }, [])

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

    if (rideMinutes && parseInt(rideMinutes) <= 0) {
      setErrorMessage('Ride minutes must be greater than 0')
      return
    }

    setSubmitting(true)
    try {
      const request: RecordRideRequest = {
        rideDateTimeLocal,
        miles: milesNum,
        rideMinutes: rideMinutes ? parseInt(rideMinutes) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
      }

      const response = await recordRide(request)
      setSuccessMessage(`Ride recorded successfully (ID: ${response.rideId})`)

      // Keep form values but clear after delay
      setTimeout(() => {
        setRideDateTimeLocal('')
        setMiles('')
        setRideMinutes('')
        setTemperature('')
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
            onChange={(e) => setMiles(e.target.value)}
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
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Record Ride'}
        </button>
      </form>
    </div>
  )
}
