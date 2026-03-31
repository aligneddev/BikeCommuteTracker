import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { RecordRidePage } from '../pages/RecordRidePage'

// Mock the ridesService
vi.mock('../services/ridesService', () => ({
  getRideDefaults: vi.fn(),
  getGasPrice: vi.fn(),
  getQuickRideOptions: vi.fn(),
  recordRide: vi.fn(),
}))

import * as ridesService from '../services/ridesService'

const mockGetRideDefaults = vi.mocked(ridesService.getRideDefaults)
const mockGetGasPrice = vi.mocked(ridesService.getGasPrice)
const mockGetQuickRideOptions = vi.mocked(ridesService.getQuickRideOptions)
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
      expect(screen.getByRole('button', { name: /record ride/i })).toBeInTheDocument()
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
      dataSource: 'EIA_EPM0_NUS_Weekly',
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

  it('should render quick ride options when available', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetQuickRideOptions.mockResolvedValue({
      options: [
        {
          miles: 10.5,
          rideMinutes: 40,
          lastUsedAtLocal: new Date().toISOString(),
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
      expect(screen.getByRole('button', { name: /10\.5 mi .* 40 min/i })).toBeInTheDocument()
    })
  })

  it('should prefill miles and duration when quick option selected', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetQuickRideOptions.mockResolvedValue({
      options: [
        {
          miles: 9.25,
          rideMinutes: 33,
          lastUsedAtLocal: new Date().toISOString(),
        },
      ],
      generatedAtUtc: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    const optionButton = await screen.findByRole('button', {
      name: /9\.25 mi .* 33 min/i,
    })
    fireEvent.click(optionButton)

    const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
    const minutesInput = screen.getByLabelText(/duration/i) as HTMLInputElement

    expect(milesInput.value).toBe('9.25')
    expect(minutesInput.value).toBe('33')
    expect(mockRecordRide).not.toHaveBeenCalled()
  })

  it('should allow editing copied values and submit edited payload', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetQuickRideOptions.mockResolvedValue({
      options: [
        {
          miles: 7.5,
          rideMinutes: 25,
          lastUsedAtLocal: new Date().toISOString(),
        },
      ],
      generatedAtUtc: new Date().toISOString(),
    })
    mockRecordRide.mockResolvedValue({
      rideId: 222,
      riderId: 1,
      savedAtUtc: new Date().toISOString(),
      eventStatus: 'Queued',
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    const optionButton = await screen.findByRole('button', {
      name: /7\.5 mi .* 25 min/i,
    })
    fireEvent.click(optionButton)

    const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
    const minutesInput = screen.getByLabelText(/duration/i) as HTMLInputElement

    fireEvent.change(milesInput, { target: { value: '8.25' } })
    fireEvent.change(minutesInput, { target: { value: '29' } })

    const submitButton = screen.getByRole('button', { name: /record ride/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRecordRide).toHaveBeenCalledWith(
        expect.objectContaining({
          miles: 8.25,
          rideMinutes: 29,
        })
      )
    })
  })

  it('should block submit when copied miles is cleared', async () => {
    mockGetRideDefaults.mockResolvedValue({
      hasPreviousRide: false,
      defaultRideDateTimeLocal: new Date().toISOString(),
    })
    mockGetQuickRideOptions.mockResolvedValue({
      options: [
        {
          miles: 6.4,
          rideMinutes: 22,
          lastUsedAtLocal: new Date().toISOString(),
        },
      ],
      generatedAtUtc: new Date().toISOString(),
    })

    render(
      <BrowserRouter>
        <RecordRidePage />
      </BrowserRouter>
    )

    const optionButton = await screen.findByRole('button', {
      name: /6\.4 mi .* 22 min/i,
    })
    fireEvent.click(optionButton)

    const milesInput = screen.getByLabelText(/miles/i) as HTMLInputElement
    fireEvent.change(milesInput, { target: { value: '' } })

    const submitButton = screen.getByRole('button', { name: /record ride/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRecordRide).not.toHaveBeenCalled()
      expect(screen.getByText(/miles must be greater than 0/i)).toBeInTheDocument()
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
})
