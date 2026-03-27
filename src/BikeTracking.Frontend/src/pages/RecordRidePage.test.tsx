import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { RecordRidePage } from '../pages/RecordRidePage'

// Mock the ridesService
vi.mock('../services/ridesService', () => ({
  getRideDefaults: vi.fn(),
  recordRide: vi.fn(),
}))

import * as ridesService from '../services/ridesService'

const mockGetRideDefaults = vi.mocked(ridesService.getRideDefaults)
const mockRecordRide = vi.mocked(ridesService.recordRide)

describe('RecordRidePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
