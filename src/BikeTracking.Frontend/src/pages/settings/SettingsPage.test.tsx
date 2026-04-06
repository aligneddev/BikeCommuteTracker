import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import * as usersApi from '../../services/users-api'

vi.mock('../../services/users-api', () => ({
  getUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
}))

const mockGetUserSettings = vi.mocked(usersApi.getUserSettings)
const mockSaveUserSettings = vi.mocked(usersApi.saveUserSettings)

function installGeolocationMock(
  implementation: Geolocation['getCurrentPosition']
): void {
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: implementation,
    } satisfies Pick<Geolocation, 'getCurrentPosition'>,
  })
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installGeolocationMock((success) => {
      success({
        coords: {
          latitude: 41.881832,
          longitude: -87.623177,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      })
    })
  })

  it('loads and displays saved numeric settings values', async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: 31.5,
          yearlyGoalMiles: 1800,
          oilChangePrice: 89.99,
          mileageRateCents: 67.5,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:00:00Z',
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/average car mpg/i)).toHaveValue(31.5)
      expect(screen.getByLabelText(/yearly goal/i)).toHaveValue(1800)
      expect(screen.getByLabelText(/oil change price/i)).toHaveValue(89.99)
      expect(screen.getByLabelText(/mileage rate/i)).toHaveValue(67.5)
    })
  })

  it('submits edited numeric settings via save action', async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: false,
        settings: {
          averageCarMpg: null,
          yearlyGoalMiles: null,
          oilChangePrice: null,
          mileageRateCents: null,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: null,
        },
      },
    })

    mockSaveUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: 31.5,
          yearlyGoalMiles: 1800,
          oilChangePrice: 89.99,
          mileageRateCents: 67.5,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:00:00Z',
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save settings/i })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/average car mpg/i), {
      target: { value: '31.5' },
    })
    fireEvent.change(screen.getByLabelText(/yearly goal/i), {
      target: { value: '1800' },
    })
    fireEvent.change(screen.getByLabelText(/oil change price/i), {
      target: { value: '89.99' },
    })
    fireEvent.change(screen.getByLabelText(/mileage rate/i), {
      target: { value: '67.5' },
    })

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(mockSaveUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          averageCarMpg: 31.5,
          yearlyGoalMiles: 1800,
          oilChangePrice: 89.99,
          mileageRateCents: 67.5,
        })
      )
    })
  })

  it('loads and saves location picker values with coordinates', async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: null,
          yearlyGoalMiles: null,
          oilChangePrice: null,
          mileageRateCents: null,
          locationLabel: 'Downtown Office',
          latitude: 42.3601,
          longitude: -71.0589,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:00:00Z',
        },
      },
    })

    mockSaveUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: null,
          yearlyGoalMiles: null,
          oilChangePrice: null,
          mileageRateCents: null,
          locationLabel: 'HQ Campus',
          latitude: 41.9,
          longitude: -87.6,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:10:00Z',
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/location/i)).toHaveValue('Downtown Office')
      expect(screen.getByLabelText(/latitude/i)).toHaveValue(42.3601)
      expect(screen.getByLabelText(/longitude/i)).toHaveValue(-71.0589)
    })

    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'HQ Campus' },
    })
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '41.9' },
    })
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '-87.6' },
    })

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(mockSaveUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          locationLabel: 'HQ Campus',
          latitude: 41.9,
          longitude: -87.6,
        })
      )
    })
  })

  it('submits only changed field values when updating a single setting', async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: 28,
          yearlyGoalMiles: 1000,
          oilChangePrice: 60,
          mileageRateCents: 55,
          locationLabel: 'Home',
          latitude: 41.881,
          longitude: -87.623,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:00:00Z',
        },
      },
    })

    mockSaveUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: 30,
          yearlyGoalMiles: 1000,
          oilChangePrice: 60,
          mileageRateCents: 55,
          locationLabel: 'Home',
          latitude: 41.881,
          longitude: -87.623,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:05:00Z',
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/average car mpg/i)).toHaveValue(28)
    })

    fireEvent.change(screen.getByLabelText(/average car mpg/i), {
      target: { value: '30' },
    })

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(mockSaveUserSettings).toHaveBeenCalledWith({
        averageCarMpg: 30,
      })
    })
  })

  it('fills latitude and longitude from the browser location action', async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: false,
        settings: {
          averageCarMpg: null,
          yearlyGoalMiles: null,
          oilChangePrice: null,
          mileageRateCents: null,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: null,
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /use browser location/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /use browser location/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/latitude/i)).toHaveValue(41.881832)
      expect(screen.getByLabelText(/longitude/i)).toHaveValue(-87.623177)
    })
  })

  it('shows an error when browser location lookup fails', async () => {
    installGeolocationMock((_success, error) => {
      error?.({
        code: 1,
        message: 'Permission denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    })

    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: false,
        settings: {
          averageCarMpg: null,
          yearlyGoalMiles: null,
          oilChangePrice: null,
          mileageRateCents: null,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: null,
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /use browser location/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /use browser location/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to read browser location/i)
    })
  })

  it('loads and saves dashboard optional metric approvals', async () => {
    mockGetUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: 30,
          yearlyGoalMiles: 1600,
          oilChangePrice: 70,
          mileageRateCents: 60,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: false,
          dashboardGoalProgressEnabled: false,
          updatedAtUtc: '2026-03-30T10:00:00Z',
        },
      },
    })

    mockSaveUserSettings.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        hasSettings: true,
        settings: {
          averageCarMpg: 30,
          yearlyGoalMiles: 1600,
          oilChangePrice: 70,
          mileageRateCents: 60,
          locationLabel: null,
          latitude: null,
          longitude: null,
          dashboardGallonsAvoidedEnabled: true,
          dashboardGoalProgressEnabled: true,
          updatedAtUtc: '2026-03-30T10:15:00Z',
        },
      },
    })

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/show gallons avoided metric/i)).not.toBeChecked()
      expect(screen.getByLabelText(/show goal progress metric/i)).not.toBeChecked()
    })

    fireEvent.click(screen.getByLabelText(/show gallons avoided metric/i))
    fireEvent.click(screen.getByLabelText(/show goal progress metric/i))
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }))

    await waitFor(() => {
      expect(mockSaveUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboardGallonsAvoidedEnabled: true,
          dashboardGoalProgressEnabled: true,
        })
      )
    })
  })
})
