import { useEffect, useState } from 'react'
import {
  getUserSettings,
  saveUserSettings,
  type UserSettingsResponse,
  type UserSettingsUpsertRequest,
} from '../../services/users-api'
import './SettingsPage.css'

interface SettingsFormSnapshot {
  averageCarMpg: number | null
  yearlyGoalMiles: number | null
  oilChangePrice: number | null
  mileageRateCents: number | null
  locationLabel: string | null
  latitude: number | null
  longitude: number | null
  dashboardGallonsAvoidedEnabled: boolean
  dashboardGoalProgressEnabled: boolean
}

function toSnapshot(response: UserSettingsResponse): SettingsFormSnapshot {
  return {
    averageCarMpg: response.settings.averageCarMpg,
    yearlyGoalMiles: response.settings.yearlyGoalMiles,
    oilChangePrice: response.settings.oilChangePrice,
    mileageRateCents: response.settings.mileageRateCents,
    locationLabel: response.settings.locationLabel,
    latitude: response.settings.latitude,
    longitude: response.settings.longitude,
    dashboardGallonsAvoidedEnabled: response.settings.dashboardGallonsAvoidedEnabled,
    dashboardGoalProgressEnabled: response.settings.dashboardGoalProgressEnabled,
  }
}

function normalizeLocationLabel(value: string): string | null {
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

export function SettingsPage() {
  const [averageCarMpg, setAverageCarMpg] = useState<number | ''>('')
  const [yearlyGoalMiles, setYearlyGoalMiles] = useState<number | ''>('')
  const [oilChangePrice, setOilChangePrice] = useState<number | ''>('')
  const [mileageRateCents, setMileageRateCents] = useState<number | ''>('')
  const [locationLabel, setLocationLabel] = useState<string>('')
  const [latitude, setLatitude] = useState<number | ''>('')
  const [longitude, setLongitude] = useState<number | ''>('')
  const [dashboardGallonsAvoidedEnabled, setDashboardGallonsAvoidedEnabled] = useState<boolean>(false)
  const [dashboardGoalProgressEnabled, setDashboardGoalProgressEnabled] = useState<boolean>(false)
  const [locating, setLocating] = useState<boolean>(false)
  const [initialSnapshot, setInitialSnapshot] = useState<SettingsFormSnapshot>({
    averageCarMpg: null,
    yearlyGoalMiles: null,
    oilChangePrice: null,
    mileageRateCents: null,
    locationLabel: null,
    latitude: null,
    longitude: null,
    dashboardGallonsAvoidedEnabled: false,
    dashboardGoalProgressEnabled: false,
  })

  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  useEffect(() => {
    let isMounted = true

    async function load(): Promise<void> {
      setError('')
      try {
        const response = await getUserSettings()
        if (!isMounted) return

        if (response.ok && response.data) {
          const settings = response.data.settings
          setAverageCarMpg(settings.averageCarMpg ?? '')
          setYearlyGoalMiles(settings.yearlyGoalMiles ?? '')
          setOilChangePrice(settings.oilChangePrice ?? '')
          setMileageRateCents(settings.mileageRateCents ?? '')
          setLocationLabel(settings.locationLabel ?? '')
          setLatitude(settings.latitude ?? '')
          setLongitude(settings.longitude ?? '')
          setDashboardGallonsAvoidedEnabled(settings.dashboardGallonsAvoidedEnabled)
          setDashboardGoalProgressEnabled(settings.dashboardGoalProgressEnabled)
          setInitialSnapshot(toSnapshot(response.data))
        } else {
          setError(response.error?.message ?? 'Failed to load settings')
        }
      } catch {
        if (isMounted) {
          setError('Failed to load settings')
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

  function onUseBrowserLocation(): void {
    setError('')
    setSuccess('')

    if (!window.navigator.geolocation) {
      setError('Unable to read browser location on this device.')
      return
    }

    setLocating(true)
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)))
        setLongitude(Number(position.coords.longitude.toFixed(6)))
        setLocating(false)
        setSuccess('Browser location loaded. Save settings to keep it.')
      },
      () => {
        setLocating(false)
        setError('Unable to read browser location. Check browser permissions and try again.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  async function onSave(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const currentSnapshot: SettingsFormSnapshot = {
      averageCarMpg: averageCarMpg === '' ? null : averageCarMpg,
      yearlyGoalMiles: yearlyGoalMiles === '' ? null : yearlyGoalMiles,
      oilChangePrice: oilChangePrice === '' ? null : oilChangePrice,
      mileageRateCents: mileageRateCents === '' ? null : mileageRateCents,
      locationLabel: normalizeLocationLabel(locationLabel),
      latitude: latitude === '' ? null : latitude,
      longitude: longitude === '' ? null : longitude,
      dashboardGallonsAvoidedEnabled,
      dashboardGoalProgressEnabled,
    }

    const payload: UserSettingsUpsertRequest = {}
    if (currentSnapshot.averageCarMpg !== initialSnapshot.averageCarMpg)
      payload.averageCarMpg = currentSnapshot.averageCarMpg
    if (currentSnapshot.yearlyGoalMiles !== initialSnapshot.yearlyGoalMiles)
      payload.yearlyGoalMiles = currentSnapshot.yearlyGoalMiles
    if (currentSnapshot.oilChangePrice !== initialSnapshot.oilChangePrice)
      payload.oilChangePrice = currentSnapshot.oilChangePrice
    if (currentSnapshot.mileageRateCents !== initialSnapshot.mileageRateCents)
      payload.mileageRateCents = currentSnapshot.mileageRateCents
    if (currentSnapshot.locationLabel !== initialSnapshot.locationLabel)
      payload.locationLabel = currentSnapshot.locationLabel
    if (currentSnapshot.latitude !== initialSnapshot.latitude)
      payload.latitude = currentSnapshot.latitude
    if (currentSnapshot.longitude !== initialSnapshot.longitude)
      payload.longitude = currentSnapshot.longitude
    if (
      currentSnapshot.dashboardGallonsAvoidedEnabled !==
      initialSnapshot.dashboardGallonsAvoidedEnabled
    ) {
      payload.dashboardGallonsAvoidedEnabled = currentSnapshot.dashboardGallonsAvoidedEnabled
    }
    if (
      currentSnapshot.dashboardGoalProgressEnabled !==
      initialSnapshot.dashboardGoalProgressEnabled
    ) {
      payload.dashboardGoalProgressEnabled = currentSnapshot.dashboardGoalProgressEnabled
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false)
      setSuccess('No changes to save.')
      return
    }

    try {
      const response = await saveUserSettings(payload)
      if (response.ok && response.data) {
        const settings = response.data.settings
        setAverageCarMpg(settings.averageCarMpg ?? '')
        setYearlyGoalMiles(settings.yearlyGoalMiles ?? '')
        setOilChangePrice(settings.oilChangePrice ?? '')
        setMileageRateCents(settings.mileageRateCents ?? '')
        setLocationLabel(settings.locationLabel ?? '')
        setLatitude(settings.latitude ?? '')
        setLongitude(settings.longitude ?? '')
        setDashboardGallonsAvoidedEnabled(settings.dashboardGallonsAvoidedEnabled)
        setDashboardGoalProgressEnabled(settings.dashboardGoalProgressEnabled)
        setInitialSnapshot(toSnapshot(response.data))
        setSuccess('Settings saved successfully.')
      } else {
        setError(response.error?.message ?? 'Failed to save settings')
      }
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div>Loading settings...</div>
  }

  return (
    <main className="settings-page">
      <section className="settings-card">
        <h1>Settings</h1>

        {error ? (
          <p className="settings-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? <p className="settings-success">{success}</p> : null}

        <form onSubmit={onSave}>
          <div className="settings-grid">
            <div className="settings-field">
              <label htmlFor="averageCarMpg">Average Car MPG</label>
              <input
                id="averageCarMpg"
                type="number"
                step="0.01"
                value={averageCarMpg}
                onChange={(e) =>
                  setAverageCarMpg(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="yearlyGoalMiles">Yearly Goal</label>
              <input
                id="yearlyGoalMiles"
                type="number"
                step="0.01"
                value={yearlyGoalMiles}
                onChange={(e) =>
                  setYearlyGoalMiles(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="oilChangePrice">Oil Change Price</label>
              <input
                id="oilChangePrice"
                type="number"
                step="0.01"
                value={oilChangePrice}
                onChange={(e) =>
                  setOilChangePrice(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="mileageRateCents">Mileage Rate (cents per mile)</label>
              <input
                id="mileageRateCents"
                type="number"
                step="0.01"
                value={mileageRateCents}
                onChange={(e) =>
                  setMileageRateCents(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="locationLabel">Location</label>
              <input
                id="locationLabel"
                type="text"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
              />
              <div className="settings-inline-actions">
                <button
                  className="settings-secondary-action"
                  type="button"
                  onClick={onUseBrowserLocation}
                  disabled={locating}
                >
                  {locating ? 'Finding browser location...' : 'Use Browser Location'}
                </button>
                <span className="settings-hint">
                  Optionally fill latitude and longitude from this browser.
                </span>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="latitude">Latitude</label>
              <input
                id="latitude"
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(e) =>
                  setLatitude(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            <div className="settings-field">
              <label htmlFor="longitude">Longitude</label>
              <input
                id="longitude"
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(e) =>
                  setLongitude(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </div>

            <fieldset className="settings-field settings-checkbox-group">
              <legend>Dashboard Optional Metrics</legend>

              <label className="settings-checkbox-row" htmlFor="dashboardGallonsAvoidedEnabled">
                <input
                  id="dashboardGallonsAvoidedEnabled"
                  type="checkbox"
                  checked={dashboardGallonsAvoidedEnabled}
                  onChange={(e) => setDashboardGallonsAvoidedEnabled(e.target.checked)}
                />
                Show gallons avoided metric
              </label>

              <label className="settings-checkbox-row" htmlFor="dashboardGoalProgressEnabled">
                <input
                  id="dashboardGoalProgressEnabled"
                  type="checkbox"
                  checked={dashboardGoalProgressEnabled}
                  onChange={(e) => setDashboardGoalProgressEnabled(e.target.checked)}
                />
                Show goal progress metric
              </label>
            </fieldset>
          </div>

          <div className="settings-actions">
            <button className="settings-save" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
