import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HistoryPage } from './HistoryPage'
import * as ridesService from '../services/ridesService'

vi.mock('../services/ridesService', () => ({
  getRideHistory: vi.fn(),
  editRide: vi.fn(),
}))

const mockGetRideHistory = vi.mocked(ridesService.getRideHistory)
const mockEditRide = vi.mocked(ridesService.editRide)

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render summary tiles for thisMonth, thisYear, and allTime', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 12.5, rideCount: 2, period: 'thisMonth' },
        thisYear: { miles: 68.4, rideCount: 9, period: 'thisYear' },
        allTime: { miles: 140.2, rideCount: 20, period: 'allTime' },
      },
      filteredTotal: { miles: 140.2, rideCount: 20, period: 'filtered' },
      rides: [
        {
          rideId: 1,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 12.5,
          rideMinutes: 35,
          temperature: 61,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText(/this month/i)).toBeInTheDocument()
      expect(screen.getByText(/this year/i)).toBeInTheDocument()
      expect(screen.getByText(/all time/i)).toBeInTheDocument()
    })
  })

  it('should render ride grid with ride data', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 1,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      const rideRows = screen.getAllByRole('row')
      expect(rideRows.length).toBeGreaterThan(1)
      expect(screen.getByRole('table', { name: /ride history table/i })).toBeInTheDocument()
    })
  })

  it('should show empty state when no rides exist', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 0, rideCount: 0, period: 'thisMonth' },
        thisYear: { miles: 0, rideCount: 0, period: 'thisYear' },
        allTime: { miles: 0, rideCount: 0, period: 'allTime' },
      },
      filteredTotal: { miles: 0, rideCount: 0, period: 'filtered' },
      rides: [],
      page: 1,
      pageSize: 25,
      totalRows: 0,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText(/no rides found/i)).toBeInTheDocument()
    })
  })

  it('should call getRideHistory on mount', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 0, rideCount: 0, period: 'thisMonth' },
        thisYear: { miles: 0, rideCount: 0, period: 'thisYear' },
        allTime: { miles: 0, rideCount: 0, period: 'allTime' },
      },
      filteredTotal: { miles: 0, rideCount: 0, period: 'filtered' },
      rides: [],
      page: 1,
      pageSize: 25,
      totalRows: 0,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25 })
    })
  })

  it('should apply date filters and render filtered total', async () => {
    mockGetRideHistory
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 20, rideCount: 2, period: 'thisMonth' },
          thisYear: { miles: 20, rideCount: 2, period: 'thisYear' },
          allTime: { miles: 30, rideCount: 3, period: 'allTime' },
        },
        filteredTotal: { miles: 30, rideCount: 3, period: 'filtered' },
        rides: [
          { rideId: 1, rideDateTimeLocal: '2026-03-01T08:00:00', miles: 10 },
          { rideId: 2, rideDateTimeLocal: '2026-03-20T08:00:00', miles: 20 },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 2,
      })
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 20, rideCount: 2, period: 'thisMonth' },
          thisYear: { miles: 20, rideCount: 2, period: 'thisYear' },
          allTime: { miles: 30, rideCount: 3, period: 'allTime' },
        },
        filteredTotal: { miles: 20, rideCount: 1, period: 'filtered' },
        rides: [
          { rideId: 2, rideDateTimeLocal: '2026-03-20T08:00:00', miles: 20 },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 1,
      })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25 })
    })

    fireEvent.change(screen.getByLabelText(/^From$/i), {
      target: { value: '2026-03-15' },
    })
    fireEvent.change(screen.getByLabelText(/^To$/i), {
      target: { value: '2026-03-31' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filter/i }))

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenLastCalledWith({
        from: '2026-03-15',
        to: '2026-03-31',
        page: 1,
        pageSize: 25,
      })
      const totalSection = screen.getByLabelText(/visible total miles/i)
      expect(within(totalSection).getByText('20.0 mi')).toBeInTheDocument()
    })
  })

  it('should clear filters and reload full history', async () => {
    mockGetRideHistory
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 20, rideCount: 2, period: 'thisMonth' },
          thisYear: { miles: 20, rideCount: 2, period: 'thisYear' },
          allTime: { miles: 30, rideCount: 3, period: 'allTime' },
        },
        filteredTotal: { miles: 30, rideCount: 3, period: 'filtered' },
        rides: [
          { rideId: 1, rideDateTimeLocal: '2026-03-01T08:00:00', miles: 10 },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 1,
      })
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 20, rideCount: 2, period: 'thisMonth' },
          thisYear: { miles: 20, rideCount: 2, period: 'thisYear' },
          allTime: { miles: 30, rideCount: 3, period: 'allTime' },
        },
        filteredTotal: { miles: 10, rideCount: 1, period: 'filtered' },
        rides: [
          { rideId: 1, rideDateTimeLocal: '2026-03-01T08:00:00', miles: 10 },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 1,
      })
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 20, rideCount: 2, period: 'thisMonth' },
          thisYear: { miles: 20, rideCount: 2, period: 'thisYear' },
          allTime: { miles: 30, rideCount: 3, period: 'allTime' },
        },
        filteredTotal: { miles: 30, rideCount: 3, period: 'filtered' },
        rides: [
          { rideId: 1, rideDateTimeLocal: '2026-03-01T08:00:00', miles: 10 },
          { rideId: 2, rideDateTimeLocal: '2026-03-20T08:00:00', miles: 20 },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 2,
      })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByLabelText(/^From$/i), {
      target: { value: '2026-03-01' },
    })
    fireEvent.change(screen.getByLabelText(/^To$/i), {
      target: { value: '2026-03-05' },
    })

    fireEvent.click(screen.getByRole('button', { name: /apply filter/i }))

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledTimes(2)
    })

    fireEvent.click(screen.getByRole('button', { name: /clear filter/i }))

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledTimes(3)
      expect(mockGetRideHistory).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
    })
  })

  it('should enter edit mode for a row when Edit is clicked', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 1,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  it('should discard in-progress row edits when Cancel is clicked', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 2,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    const milesInput = screen.getByRole('spinbutton', {
      name: /miles/i,
    }) as HTMLInputElement
    fireEvent.change(milesInput, { target: { value: '9.9' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByDisplayValue('9.9')).not.toBeInTheDocument()
      const historyGrid = screen.getByLabelText(/ride history grid/i)
      expect(within(historyGrid).getByText('5.0 mi')).toBeInTheDocument()
    })
  })

  it('should block save and show validation message for invalid miles', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 3,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const milesInput = screen.getByRole('spinbutton', {
      name: /miles/i,
    }) as HTMLInputElement

    fireEvent.change(milesInput, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/miles must be greater than 0/i)
      expect(mockEditRide).not.toHaveBeenCalled()
    })
  })

  it('should show conflict error and keep edit mode on stale version response', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 4,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })
    mockEditRide.mockResolvedValue({
      ok: false,
      error: {
        code: 'RIDE_VERSION_CONFLICT',
        message: 'Ride edit conflict. The ride was updated by another request.',
        currentVersion: 2,
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/conflict/i)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })
})
