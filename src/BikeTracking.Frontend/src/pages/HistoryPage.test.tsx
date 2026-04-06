import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HistoryPage } from './HistoryPage'
import * as ridesService from '../services/ridesService'

vi.mock('../services/ridesService', () => ({
  getRideHistory: vi.fn(),
  editRide: vi.fn(),
  deleteRide: vi.fn(),
  getGasPrice: vi.fn(),
  getRideWeather: vi.fn(),
}))

const mockGetRideHistory = vi.mocked(ridesService.getRideHistory)
const mockEditRide = vi.mocked(ridesService.editRide)
const mockDeleteRide = vi.mocked(ridesService.deleteRide)
const mockGetGasPrice = vi.mocked(ridesService.getGasPrice)
const mockGetRideWeather = vi.mocked(ridesService.getRideWeather)

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGasPrice.mockResolvedValue({
      date: '2026-03-20',
      pricePerGallon: null,
      isAvailable: false,
      dataSource: null,
    })
    mockDeleteRide.mockResolvedValue({
      ok: true,
      value: {
        rideId: 1,
        deletedAt: '2026-03-30T14:22:15Z',
        message: 'Ride deleted successfully.',
        isIdempotent: false,
      },
    })
    mockGetRideWeather.mockResolvedValue({
      rideDateTimeLocal: '2026-03-20T10:30:00',
      temperature: undefined,
      windSpeedMph: undefined,
      windDirectionDeg: undefined,
      relativeHumidityPercent: undefined,
      cloudCoverPercent: undefined,
      precipitationType: undefined,
      isAvailable: false,
    })
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
          gasPricePerGallon: 3.1111,
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
      const gasPriceInput = screen.getByRole('spinbutton', {
        name: /gas price/i,
      }) as HTMLInputElement
      expect(gasPriceInput.value).toBe('3.1111')
    })
  })

  it('should render gas price column values in history table', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 21,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
          gasPricePerGallon: 3.5555,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByText('$3.5555')).toBeInTheDocument()
    })
  })

  it('should block save and show validation message for invalid gas price', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 32,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
          gasPricePerGallon: 3.1111,
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

    const gasPriceInput = screen.getByRole('spinbutton', {
      name: /gas price/i,
    }) as HTMLInputElement
    fireEvent.change(gasPriceInput, { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/gas price must be between 0.01 and 999.9999/i)
      expect(mockEditRide).not.toHaveBeenCalled()
    })
  })

  it('should refresh gas price on date change in edit mode when lookup is available', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 33,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 5,
          rideMinutes: 30,
          temperature: 70,
          gasPricePerGallon: 3.1111,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })
    mockGetGasPrice.mockResolvedValue({
      date: '2026-01-01',
      pricePerGallon: 3.9999,
      isAvailable: true,
      dataSource: 'Source: U.S. Energy Information Administration (EIA)',
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const dateInput = screen.getByLabelText(/^Date$/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-01-01T09:00' } })

    await waitFor(() => {
      const gasPriceInput = screen.getByRole('spinbutton', {
        name: /gas price/i,
      }) as HTMLInputElement
      expect(gasPriceInput.value).toBe('3.9999')
      // I moved this to a tooltip
      // expect(
      //   screen.getByText('Source: U.S. Energy Information Administration (EIA)')
      // ).toBeInTheDocument()
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

  it('should block save and show validation message for miles above maximum', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 5, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 31,
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

    fireEvent.change(milesInput, { target: { value: '201' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /miles must be less than or equal to 200/i
      )
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

  it('should refresh filtered totals and summaries after a successful edit save', async () => {
    mockGetRideHistory
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
          thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
          allTime: { miles: 5, rideCount: 1, period: 'allTime' },
        },
        filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
        rides: [
          {
            rideId: 8,
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
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 5, rideCount: 1, period: 'thisMonth' },
          thisYear: { miles: 5, rideCount: 1, period: 'thisYear' },
          allTime: { miles: 5, rideCount: 1, period: 'allTime' },
        },
        filteredTotal: { miles: 5, rideCount: 1, period: 'filtered' },
        rides: [
          {
            rideId: 8,
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
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 8.5, rideCount: 1, period: 'thisMonth' },
          thisYear: { miles: 8.5, rideCount: 1, period: 'thisYear' },
          allTime: { miles: 8.5, rideCount: 1, period: 'allTime' },
        },
        filteredTotal: { miles: 8.5, rideCount: 1, period: 'filtered' },
        rides: [
          {
            rideId: 8,
            rideDateTimeLocal: '2026-03-20T10:30:00',
            miles: 8.5,
            rideMinutes: 30,
            temperature: 70,
          },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 1,
      })

    mockEditRide.mockResolvedValue({
      ok: true,
      value: {
        rideId: 8,
        newVersion: 2,
        message: 'Ride updated successfully.',
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25 })
    })

    fireEvent.change(screen.getByLabelText(/^From$/i), {
      target: { value: '2026-03-01' },
    })
    fireEvent.change(screen.getByLabelText(/^To$/i), {
      target: { value: '2026-03-31' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filter/i }))

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenLastCalledWith({
        from: '2026-03-01',
        to: '2026-03-31',
        page: 1,
        pageSize: 25,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const milesInput = screen.getByRole('spinbutton', {
      name: /miles/i,
    }) as HTMLInputElement
    fireEvent.change(milesInput, { target: { value: '8.5' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenLastCalledWith({
        from: '2026-03-01',
        to: '2026-03-31',
        page: 1,
        pageSize: 25,
      })
    })

    await waitFor(() => {
      const totalSection = screen.getByLabelText(/visible total miles/i)
      expect(within(totalSection).getByText('8.5 mi')).toBeInTheDocument()
      const summaries = screen.getByLabelText(/ride summaries/i)
      expect(within(summaries).getAllByText('8.5 mi')).toHaveLength(3)
    })
  })

  it('should open delete confirmation dialog and cancel without deleting', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 10, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 10, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 10, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 10, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 12,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 10,
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
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /delete ride confirmation/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /delete ride confirmation/i }),
      ).not.toBeInTheDocument()
      expect(mockDeleteRide).not.toHaveBeenCalled()
    })
  })

  it('should delete ride and reload history with active filters', async () => {
    mockGetRideHistory
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 30, rideCount: 2, period: 'thisMonth' },
          thisYear: { miles: 30, rideCount: 2, period: 'thisYear' },
          allTime: { miles: 30, rideCount: 2, period: 'allTime' },
        },
        filteredTotal: { miles: 30, rideCount: 2, period: 'filtered' },
        rides: [
          {
            rideId: 1,
            rideDateTimeLocal: '2026-03-10T10:30:00',
            miles: 10,
            rideMinutes: 30,
            temperature: 70,
          },
          {
            rideId: 2,
            rideDateTimeLocal: '2026-03-20T10:30:00',
            miles: 20,
            rideMinutes: 40,
            temperature: 72,
          },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 2,
      })
      .mockResolvedValueOnce({
        summaries: {
          thisMonth: { miles: 20, rideCount: 1, period: 'thisMonth' },
          thisYear: { miles: 20, rideCount: 1, period: 'thisYear' },
          allTime: { miles: 20, rideCount: 1, period: 'allTime' },
        },
        filteredTotal: { miles: 20, rideCount: 1, period: 'filtered' },
        rides: [
          {
            rideId: 2,
            rideDateTimeLocal: '2026-03-20T10:30:00',
            miles: 20,
            rideMinutes: 40,
            temperature: 72,
          },
        ],
        page: 1,
        pageSize: 25,
        totalRows: 1,
      })

    mockDeleteRide.mockResolvedValue({
      ok: true,
      value: {
        rideId: 1,
        deletedAt: '2026-03-30T14:22:15Z',
        message: 'Ride deleted successfully.',
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledWith({ page: 1, pageSize: 25 })
    })

    fireEvent.change(screen.getByLabelText(/^From$/i), {
      target: { value: '2026-03-01' },
    })
    fireEvent.change(screen.getByLabelText(/^To$/i), {
      target: { value: '2026-03-31' },
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /delete ride confirmation/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => {
      expect(mockDeleteRide).toHaveBeenCalledWith(1)
      expect(mockGetRideHistory).toHaveBeenLastCalledWith({
        from: '2026-03-01',
        to: '2026-03-31',
        page: 1,
        pageSize: 25,
      })
    })
  })

  it('should allow editing weather fields in history and send weatherUserOverridden', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 10, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 10, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 10, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 10, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 44,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 10,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })
    mockEditRide.mockResolvedValue({
      ok: true,
      value: {
        rideId: 44,
        newVersion: 2,
        message: 'Ride updated successfully.',
      },
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/wind speed/i), {
      target: { value: '14.1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockEditRide).toHaveBeenCalledWith(
        44,
        expect.objectContaining({
          windSpeedMph: 14.1,
          weatherUserOverridden: true,
        })
      )
    })
  })

  it('should load weather into edit fields when Load Weather is clicked', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 10, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 10, rideCount: 1, period: 'thisYear' },
        allTime: { miles: 10, rideCount: 1, period: 'allTime' },
      },
      filteredTotal: { miles: 10, rideCount: 1, period: 'filtered' },
      rides: [
        {
          rideId: 45,
          rideDateTimeLocal: '2026-03-20T10:30:00',
          miles: 10,
          rideMinutes: 30,
          temperature: 70,
        },
      ],
      page: 1,
      pageSize: 25,
      totalRows: 1,
    })
    mockGetRideWeather.mockResolvedValue({
      rideDateTimeLocal: '2026-03-20T10:30:00',
      temperature: 51.5,
      windSpeedMph: 8.4,
      windDirectionDeg: 195,
      relativeHumidityPercent: 77,
      cloudCoverPercent: 66,
      precipitationType: 'snow',
      isAvailable: true,
    })

    render(<HistoryPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: /load weather/i }))

    await waitFor(() => {
      expect(mockGetRideWeather).toHaveBeenCalledWith('2026-03-20T10:30')
      expect((screen.getByLabelText(/temperature/i) as HTMLInputElement).value).toBe('51.5')
      expect((screen.getByLabelText(/wind speed/i) as HTMLInputElement).value).toBe('8.4')
      expect((screen.getByLabelText(/wind direction/i) as HTMLInputElement).value).toBe('195')
      expect((screen.getByLabelText(/relative humidity/i) as HTMLInputElement).value).toBe('77')
      expect((screen.getByLabelText(/cloud cover/i) as HTMLInputElement).value).toBe('66')
      expect((screen.getByLabelText(/precipitation type/i) as HTMLInputElement).value).toBe('snow')
    })
  })
})
