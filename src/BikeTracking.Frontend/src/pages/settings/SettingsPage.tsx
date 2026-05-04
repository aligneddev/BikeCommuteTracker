import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getUserSettings,
  saveUserSettings,
  type UserSettingsResponse,
  type UserSettingsUpsertRequest,
} from '../../services/users-api'
import {
  COMPASS_DIRECTIONS,
  createRidePreset,
  deleteRidePreset,
  getRidePresets,
  updateRidePreset,
  type RidePreset,
  type RidePresetPeriodTag,
  type UpsertRidePresetRequest,
} from '../../services/ridesService'
import { PERIOD_TAG_DEFAULT_DIRECTIONS } from '../../services/ridesService'
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
  const [ridePresets, setRidePresets] = useState<RidePreset[]>([])
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null)
  const [presetName, setPresetName] = useState<string>('')
  const [presetPrimaryDirection, setPresetPrimaryDirection] = useState<string>('SW')
  const [presetPeriodTag, setPresetPeriodTag] = useState<RidePresetPeriodTag>('morning')
  const [presetExactStartTimeLocal, setPresetExactStartTimeLocal] = useState<string>('07:45')
  const [presetDurationMinutes, setPresetDurationMinutes] = useState<number | ''>('')

  useEffect(() => {
    let isMounted = true

    async function load(): Promise<void> {
      setError('')
      try {
        const [settingsResponse, presetsResponse] = await Promise.all([
          getUserSettings(),
          getRidePresets(),
        ])
        if (!isMounted) return

        if (settingsResponse.ok && settingsResponse.data) {
          const settings = settingsResponse.data.settings
          setAverageCarMpg(settings.averageCarMpg ?? '')
          setYearlyGoalMiles(settings.yearlyGoalMiles ?? '')
          setOilChangePrice(settings.oilChangePrice ?? '')
          setMileageRateCents(settings.mileageRateCents ?? '')
          setLocationLabel(settings.locationLabel ?? '')
          setLatitude(settings.latitude ?? '')
          setLongitude(settings.longitude ?? '')
          setDashboardGallonsAvoidedEnabled(settings.dashboardGallonsAvoidedEnabled)
          setDashboardGoalProgressEnabled(settings.dashboardGoalProgressEnabled)
          setInitialSnapshot(toSnapshot(settingsResponse.data))
          setRidePresets(presetsResponse.presets)
        } else {
          setError(settingsResponse.error?.message ?? 'Failed to load settings')
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

  function resetPresetForm(): void {
    setEditingPresetId(null)
    setPresetName('')
    setPresetPrimaryDirection('SW')
    setPresetPeriodTag('morning')
    setPresetExactStartTimeLocal('07:45')
    setPresetDurationMinutes('')
  }

  function onPeriodTagChange(tag: RidePresetPeriodTag): void {
    setPresetPeriodTag(tag)
    setPresetPrimaryDirection(PERIOD_TAG_DEFAULT_DIRECTIONS[tag])
  }

  async function onSubmitPreset(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (presetName.trim().length === 0) {
      setError('Preset name is required.')
      return
    }

    if (presetDurationMinutes === '' || presetDurationMinutes <= 0) {
      setError('Duration minutes must be greater than 0.')
      return
    }

    const request: UpsertRidePresetRequest = {
      name: presetName.trim(),
      primaryDirection: presetPrimaryDirection as UpsertRidePresetRequest['primaryDirection'],
      periodTag: presetPeriodTag,
      exactStartTimeLocal: presetExactStartTimeLocal,
      durationMinutes: presetDurationMinutes,
    }

    try {
      if (editingPresetId === null) {
        const created = await createRidePreset(request)
        setRidePresets((current) => [created, ...current])
        setSuccess('Preset created.')
      } else {
        const updated = await updateRidePreset(editingPresetId, request)
        setRidePresets((current) =>
          current.map((preset) => (preset.presetId === updated.presetId ? updated : preset))
        )
        setSuccess('Preset updated.')
      }

      resetPresetForm()
    } catch {
      setError('Failed to save preset')
    }
  }

  function onEditPreset(preset: RidePreset): void {
    setEditingPresetId(preset.presetId)
    setPresetName(preset.name)
    setPresetPrimaryDirection(preset.primaryDirection)
    setPresetPeriodTag(preset.periodTag)
    setPresetExactStartTimeLocal(preset.exactStartTimeLocal)
    setPresetDurationMinutes(preset.durationMinutes)
  }

  async function onDeletePreset(presetId: number): Promise<void> {
    setError('')
    setSuccess('')

    try {
      await deleteRidePreset(presetId)
      setRidePresets((current) => current.filter((preset) => preset.presetId !== presetId))
      if (editingPresetId === presetId) {
        resetPresetForm()
      }
      setSuccess('Preset deleted.')
    } catch {
      setError('Failed to delete preset')
    }
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
        <p className="settings-import-link-wrapper">
          <Link className="settings-import-link" to="/rides/import">
            Import Rides from CSV
          </Link>
        </p>

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

        <section className="settings-presets" aria-label="Ride presets">
          <h2>Ride Presets</h2>

          <form onSubmit={onSubmitPreset} className="settings-presets-form">
            <div className="settings-grid">
              <div className="settings-field">
                <label htmlFor="presetName">Preset Name</label>
                <input
                  id="presetName"
                  type="text"
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                />
              </div>

              <div className="settings-field">
                <label htmlFor="presetPrimaryDirection">Primary Direction</label>
                <select
                  id="presetPrimaryDirection"
                  value={presetPrimaryDirection}
                  onChange={(event) => setPresetPrimaryDirection(event.target.value)}
                >
                  {COMPASS_DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label htmlFor="presetPeriodTag">Period Tag</label>
                <select
                  id="presetPeriodTag"
                  value={presetPeriodTag}
                  onChange={(event) =>
                    onPeriodTagChange(event.target.value as RidePresetPeriodTag)
                  }
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                </select>
              </div>

              <div className="settings-field">
                <label htmlFor="presetExactStartTimeLocal">Exact Start Time</label>
                <input
                  id="presetExactStartTimeLocal"
                  type="time"
                  value={presetExactStartTimeLocal}
                  onChange={(event) => setPresetExactStartTimeLocal(event.target.value)}
                />
              </div>

              <div className="settings-field">
                <label htmlFor="presetDurationMinutes">Duration Minutes</label>
                <input
                  id="presetDurationMinutes"
                  type="number"
                  min={1}
                  value={presetDurationMinutes}
                  onChange={(event) =>
                    setPresetDurationMinutes(
                      event.target.value === '' ? '' : Number(event.target.value)
                    )
                  }
                />
              </div>
            </div>

            <div className="settings-actions">
              <button type="submit" className="settings-save">
                {editingPresetId === null ? 'Add Preset' : 'Save Preset'}
              </button>
              {editingPresetId === null ? null : (
                <button
                  type="button"
                  className="settings-secondary-action"
                  onClick={resetPresetForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <ul className="settings-presets-list">
            {ridePresets.map((preset) => (
              <li key={preset.presetId} className="settings-presets-item">
                <span>
                  {preset.name} ({preset.primaryDirection}, {preset.periodTag}, {preset.exactStartTimeLocal},{' '}
                  {preset.durationMinutes} min)
                </span>
                <div className="settings-inline-actions">
                  <button
                    type="button"
                    className="settings-secondary-action"
                    onClick={() => onEditPreset(preset)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="settings-secondary-action"
                    onClick={() => void onDeletePreset(preset.presetId)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}
