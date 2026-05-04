import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { RecordRidePage } from '../pages/RecordRidePage'

// Mock the ridesService
vi.mock('../services/ridesService', () => ({
  getRideDefaults: vi.fn(),
  getGasPrice: vi.fn(),
  getRideWeather: vi.fn(),
  getQuickRideOptions: vi.fn(),
  getRidePresets: vi.fn(),
  recordRide: vi.fn(),
  COMPASS_DIRECTIONS: ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'],
}))

vi.mock('../utils/windResistance', () => ({
  suggestDifficulty: vi.fn().mockReturnValue(null),
}))

import * as ridesService from '../services/ridesService'

const mockGetRideDefaults = vi.mocked(ridesService.getRideDefaults)
const mockGetGasPrice = vi.mocked(ridesService.getGasPrice)
const mockGetRideWeather = vi.mocked(ridesService.getRideWeather)
const mockGetQuickRideOptions = vi.mocked(ridesService.getQuickRideOptions)
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
    mockGetQuickRideOptions.mockResolvedValue({
      options: [],
      generatedAtUtc: new Date().toISOString(),
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

  it('should render form fields', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })

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

  it('should load ride presets and not render the legacy quick options section', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
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
    })

    expect(screen.queryByText(/quick ride options/i)).not.toBeInTheDocument()
  })

  it('should apply selected preset values and still allow manual overrides', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
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

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    const presetSelector = await screen.findByLabelText(/ride preset/i)
    fireEvent.change(presetSelector, { target: { value: '11' } })

    const applyPresetButton = screen.getByRole('button', { name: /apply preset/i })
    fireEvent.click(applyPresetButton)

    await waitFor(() => {
      expect((screen.getByLabelText(/primary direction of travel/i) as HTMLSelectElement).value).toBe(
        'NE'
      )
      expect((screen.getByLabelText(/duration/i) as HTMLInputElement).value).toBe('32')
      expect((screen.getByLabelText(/date & time/i) as HTMLInputElement).value).toContain('T17:35')
    })

    const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement
    fireEvent.change(durationInput, { target: { value: '40' } })
    expect(durationInput.value).toBe('40')
  })

  it('should include note in submit payload when provided', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockRecordRide.mockResolvedValue({
      rideId: 321,
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
      expect(screen.getByLabelText(/miles/i)).toBeInTheDocument()
    })

    const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
    fireEvent.change(milesInput, { target: { value: '9.4' } })

    const notesInput = screen.getByLabelText(/notes/i) as HTMLTextAreaElement
    fireEvent.change(notesInput, {
      target: { value: 'Strong headwind near the river trail.' },
    })

    const submitButton = screen.getByRole('button', { name: /record ride/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRecordRide).toHaveBeenCalledWith(
        expect.objectContaining({
          note: 'Strong headwind near the river trail.',
        })
      )
    })
  })

  it('should render an import rides link', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const importLink = screen.getByRole('link', { name: /import rides from csv/i })
      expect(importLink).toHaveAttribute('href', '/rides/import')
    })
  })

  it('should default date/time to now', async () => {
    const now = new Date()
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: now.toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const input = screen.getByLabelText(/date & time/i) as HTMLInputElement
      // Component uses toISOString() (UTC) — compare the UTC date+hour prefix
      // which is timezone-safe regardless of the container's local timezone
      expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      const utcDateHour = now.toISOString().slice(0, 13) // 'YYYY-MM-DDTHH'
      expect(input.value).toContain(utcDateHour)
    })
  })

  it('should fetch and display defaults', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: true,
      defaultRideDateTimeLocal: new Date().toISOString(),
      defaultMiles: 10.5,
      defaultRideMinutes: 45,
      defaultTemperature: 72,
      defaultGasPricePerGallon: 3.1111,
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
      expect(milesInput.value).toBe('10.5')

      const minutesInput = screen.getByLabelText(/duration/i) as HTMLInputElement
      expect(minutesInput.value).toBe('45')

      const tempInput = screen.getByLabelText(/temperature/i) as HTMLInputElement
      expect(tempInput.value).toBe('72')

      const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
      expect(gasPriceInput.value).toBe('3.1111')
    })
  })

  it('should call getGasPrice on initial load and use available value', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: true,
      defaultRideDateTimeLocal: new Date().toISOString(),
      defaultGasPricePerGallon: 3.1111,
    })
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
      expect(
        screen.getByText('Source: U.S. Energy Information Administration (EIA)')
      ).toBeInTheDocument()
    })
  })

  it('should allow empty gas price and omit it on submit', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
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

    const submitButton = screen.getByRole('button', { name: /record ride/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRecordRide).toHaveBeenCalledWith(
        expect.not.objectContaining({ gasPricePerGallon: expect.anything() })
      )
    })
  })

  it('should block submit when gas price is negative', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
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
    fireEvent.change(gasPriceInput, { target: { value: '-1' } })

    const submitButton = screen.getByRole('button', { name: /record ride/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRecordRide).not.toHaveBeenCalled()
      expect(screen.getByText(/gas price must be greater than 0/i)).toBeInTheDocument()
    })
  })

  it('should retain fallback gas price when date-change lookup is unavailable', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: true,
      defaultRideDateTimeLocal: new Date().toISOString(),
      defaultGasPricePerGallon: 3.1111,
    })
    mockGetGasPrice.mockResolvedValue({
      date: new Date().toISOString().slice(0, 10),
      pricePerGallon: null,
      isAvailable: false,
      dataSource: null,
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
      expect(gasPriceInput.value).toBe('3.1111')
    })

    const dateInput = screen.getByLabelText(/date & time/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-01-01T09:00' } })

    await waitFor(() => {
      const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
      expect(gasPriceInput.value).toBe('3.1111')
    })
  })

  it('should keep gas price empty when lookup unavailable and no fallback exists', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetGasPrice.mockResolvedValue({
      date: new Date().toISOString().slice(0, 10),
      pricePerGallon: null,
      isAvailable: false,
      dataSource: null,
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
      expect(gasPriceInput.value).toBe('')
    })

    const dateInput = screen.getByLabelText(/date & time/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-01-01T09:00' } })

    await waitFor(() => {
      const gasPriceInput = screen.getByLabelText(/gas price/i) as HTMLInputElement
      expect(gasPriceInput.value).toBe('')
    })
  })

  it('should show validation error for negative miles', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
      fireEvent.change(milesInput, { target: { value: '-1' } })

      const submitButton = screen.getByRole('button', { name: /record ride/i })
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/miles must be greater than 0/i)).toBeInTheDocument()
    })
  })

  it('should show validation error for miles above maximum', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
      fireEvent.change(milesInput, { target: { value: '201' } })

      const submitButton = screen.getByRole('button', { name: /record ride/i })
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(
        screen.getByText(/miles must be less than or equal to 200/i)
      ).toBeInTheDocument()
      expect(mockRecordRide).not.toHaveBeenCalled()
    })
  })

  it('should show success message on successful submit', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockRecordRide.mockResolvedValue({
      rideId: 123,
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

      const submitButton = screen.getByRole('button', { name: /record ride/i })
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/ride recorded successfully/i)).toBeInTheDocument()
    })
  })

  it('should preserve form values on submit error', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockRecordRide.mockRejectedValue(new Error('Server error'))

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
      fireEvent.change(milesInput, { target: { value: '10' } })

      const submitButton = screen.getByRole('button', { name: /record ride/i })
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
      expect(milesInput.value).toBe('10')
      // The component surfaces error.message from the rejection
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    })
  })

  it('should not render quick ride options section when no options exist', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetQuickRideOptions.mockResolvedValue({
      options: [],
      generatedAtUtc: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/miles/i)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /quick ride options/i })).not.toBeInTheDocument()
    })
  })

  it('should keep manual entry available when quick options fetch fails', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetQuickRideOptions.mockRejectedValue(new Error('Quick options unavailable'))

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/miles/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /record ride/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /quick ride options/i })).not.toBeInTheDocument()
    })
  })

  it('should render editable weather fields for manual override on create', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/wind speed/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/wind direction/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/relative humidity/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/cloud cover/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/precipitation type/i)).toBeInTheDocument()
    })
  })

  it('should send weatherUserOverridden when weather fields are manually edited', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockRecordRide.mockResolvedValue({
      rideId: 321,
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
      fireEvent.change(screen.getByLabelText(/miles/i), { target: { value: '12.5' } })
    })

    fireEvent.change(screen.getByLabelText(/wind speed/i), {
      target: { value: '11.2' },
    })

    fireEvent.click(screen.getByRole('button', { name: /record ride/i }))

    await waitFor(() => {
      expect(mockRecordRide).toHaveBeenCalledWith(
        expect.objectContaining({
          windSpeedMph: 11.2,
          weatherUserOverridden: true,
        })
      )
    })
  })

  it('should load weather into fields when Load Weather is clicked', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
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
