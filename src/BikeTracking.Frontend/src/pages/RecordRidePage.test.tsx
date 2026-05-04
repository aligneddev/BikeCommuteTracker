import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { RecordRidePage } from '../pages/RecordRidePage'

vi.mock('../services/ridesService', () => ({
  getGasPrice: vi.fn(),
  getRideWeather: vi.fn(),
  getRidePresets: vi.fn(),
  recordRide: vi.fn(),
  COMPASS_DIRECTIONS: ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'],
}))

vi.mock('../utils/windResistance', () => ({
  suggestDifficulty: vi.fn().mockReturnValue(null),
}))

import * as ridesService from '../services/ridesService'

const mockGetGasPrice = vi.mocked(ridesService.getGasPrice)
const mockGetRideWeather = vi.mocked(ridesService.getRideWeather)
const mockGetRidePresets = vi.mocked(ridesService.getRidePresets)
const mockRecordRide = vi.mocked(ridesService.recordRide)

describe('RecordRidePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGasPrice.mockResolvedValue({
      date: new Date().toISOString().slice(0, 10),
      pricePerGallon: null,
      isAvailable: false,
      dataSource: null,
    })
    mockGetRidePresets.mockResolvedValue({
      presets: [],
      generatedAtUtc: new Date().toISOString(),
    })
    mockGetRideWeather.mockResolvedValue({
      rideDateTimeLocal: new Date().toISOString(),
      temperature: undefined,
      windSpeedMph: undefined,
      windDirectionDeg: undefined,
      relativeHumidityPercent: undefined,
      cloudCoverPercent: undefined,
      precipitationType: undefined,
      isAvailable: false,
    })
  })

  it('renders form fields', async () => {
    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/miles/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /record ride/i })).toBeInTheDocument()
    })
  })

  it('loads ride presets and does not render legacy quick options section', async () => {
    mockGetRidePresets.mockResolvedValue({
      presets: [
        {
          presetId: 10,
          name: 'Morning Commute',
          primaryDirection: 'SW',
          periodTag: 'morning',
          exactStartTimeLocal: '07:45',
          durationMinutes: 34,
          lastUsedAtUtc: null,
          updatedAtUtc: new Date().toISOString(),
        },
      ],
      generatedAtUtc: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockGetRidePresets).toHaveBeenCalled()
      expect(screen.getByLabelText(/ride preset/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/quick ride options/i)).not.toBeInTheDocument()
  })

  it('applies selected preset and loads weather while preserving gas price', async () => {
    mockGetGasPrice.mockResolvedValue({
      date: new Date().toISOString().slice(0, 10),
      pricePerGallon: 3.55,
      isAvailable: true,
      dataSource: 'Source: U.S. Energy Information Administration (EIA)',
    })
    mockGetRidePresets.mockResolvedValue({
      presets: [
        {
          presetId: 11,
          name: 'Afternoon Return',
          primaryDirection: 'NE',
          periodTag: 'afternoon',
          exactStartTimeLocal: '17:35',
          durationMinutes: 32,
          lastUsedAtUtc: null,
          updatedAtUtc: new Date().toISOString(),
        },
      ],
      generatedAtUtc: new Date().toISOString(),
    })
    mockGetRideWeather.mockResolvedValue({
      rideDateTimeLocal: '2026-04-03T17:35:00',
      temperature: 58.2,
      windSpeedMph: 12.4,
      windDirectionDeg: 240,
      relativeHumidityPercent: 81,
      cloudCoverPercent: 72,
      precipitationType: 'rain',
      isAvailable: true,
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    const presetSelector = await screen.findByLabelText(/ride preset/i)
    fireEvent.change(presetSelector, { target: { value: '11' } })

    await waitFor(() => {
      expect(mockGetRideWeather).toHaveBeenCalled()
      expect((screen.getByLabelText(/primary direction of travel/i) as HTMLSelectElement).value).toBe('NE')
      expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('32')
      expect((screen.getByLabelText(/date & time/i) as HTMLInputElement).value).toContain('T17:35')
      expect((screen.getByLabelText(/gas price/i) as HTMLInputElement).value).toBe('3.55')
    })
  })

  it('defaults date/time to now format', async () => {
    const now = new Date()

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const input = screen.getByLabelText(/date & time/i) as HTMLInputElement
      expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      const utcDateHour = now.toISOString().slice(0, 13)
      expect(input.value).toContain(utcDateHour)
    })
  })

  it('calls getGasPrice on initial load and uses available value', async () => {
    mockGetGasPrice.mockResolvedValue({
      date: new Date().toISOString().slice(0, 10),
      pricePerGallon: 3.2222,
      isAvailable: true,
      dataSource: 'Source: U.S. Energy Information Administration (EIA)',
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockGetGasPrice).toHaveBeenCalled()
      const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
      expect(gasPriceInput.value).toBe('3.2222')
      expect(screen.getByText('Source: U.S. Energy Information Administration (EIA)')).toBeInTheDocument()
    })
  })

  it('allows empty gas price and omits it on submit', async () => {
    mockRecordRide.mockResolvedValue({
      rideId: 50,
      riderId: 1,
      savedAtUtc: new Date().toISOString(),
      eventStatus: 'Queued',
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
      fireEvent.change(milesInput, { target: { value: '10' } })
    })

    const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
    fireEvent.change(gasPriceInput, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: /record ride/i }))

    await waitFor(() => {
      expect(mockRecordRide).toHaveBeenCalledWith(
        expect.not.objectContaining({ gasPricePerGallon: expect.anything() })
      )
    })
  })

  it('loads weather into fields when Load Weather is clicked', async () => {
    mockGetRideWeather.mockResolvedValue({
      rideDateTimeLocal: '2026-04-03T08:00:00',
      temperature: 58.2,
      windSpeedMph: 12.4,
      windDirectionDeg: 240,
      relativeHumidityPercent: 81,
      cloudCoverPercent: 72,
      precipitationType: 'rain',
      isAvailable: true,
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load weather/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /load weather/i }))

    await waitFor(() => {
      expect(mockGetRideWeather).toHaveBeenCalled()
      expect((screen.getByLabelText(/temperature/i) as HTMLInputElement).value).toBe('58.2')
      expect((screen.getByLabelText(/wind speed/i) as HTMLInputElement).value).toBe('12.4')
      expect((screen.getByLabelText(/wind direction/i) as HTMLInputElement).value).toBe('240')
      expect((screen.getByLabelText(/relative humidity/i) as HTMLInputElement).value).toBe('81')
      expect((screen.getByLabelText(/cloud cover/i) as HTMLInputElement).value).toBe('72')
      expect((screen.getByLabelText(/precipitation type/i) as HTMLInputElement).value).toBe('rain')
    })
  })
})
