import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { MilesShellPage } from './miles-shell-page'
import * as ridesService from '../../services/ridesService'

vi.mock('../../services/ridesService', () => ({
  getRideHistory: vi.fn(),
}))

vi.mock('../../context/auth-context', () => ({
  useAuth: () => ({ user: { userId: 1, userName: 'Riley' } }),
}))

const mockGetRideHistory = vi.mocked(ridesService.getRideHistory)

describe('MilesShellPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders this year and all time summary cards using shared component', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 10, rideCount: 1, period: 'thisMonth' },
        thisYear: { miles: 120, rideCount: 12, period: 'thisYear' },
        allTime: { miles: 580, rideCount: 56, period: 'allTime' },
      },
      filteredTotal: { miles: 580, rideCount: 56, period: 'filtered' },
      rides: [],
      page: 1,
      pageSize: 1,
      totalRows: 0,
    })

    render(
      <BrowserRouter>
        <MilesShellPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/this year/i)).toBeInTheDocument()
      expect(screen.getByText(/all time/i)).toBeInTheDocument()
      expect(screen.getByText('120.0 mi')).toBeInTheDocument()
      expect(screen.getByText('580.0 mi')).toBeInTheDocument()
    })
  })

  it('loads dashboard summary data from ride history service on mount', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 0, rideCount: 0, period: 'thisMonth' },
        thisYear: { miles: 0, rideCount: 0, period: 'thisYear' },
        allTime: { miles: 0, rideCount: 0, period: 'allTime' },
      },
      filteredTotal: { miles: 0, rideCount: 0, period: 'filtered' },
      rides: [],
      page: 1,
      pageSize: 1,
      totalRows: 0,
    })

    render(
      <BrowserRouter>
        <MilesShellPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(mockGetRideHistory).toHaveBeenCalledWith({ page: 1, pageSize: 1 })
    })
  })

  it('renders a Settings navigation link in the placeholder region', async () => {
    mockGetRideHistory.mockResolvedValue({
      summaries: {
        thisMonth: { miles: 0, rideCount: 0, period: 'thisMonth' },
        thisYear: { miles: 0, rideCount: 0, period: 'thisYear' },
        allTime: { miles: 0, rideCount: 0, period: 'allTime' },
      },
      filteredTotal: { miles: 0, rideCount: 0, period: 'filtered' },
      rides: [],
      page: 1,
      pageSize: 1,
      totalRows: 0,
    })

    render(
      <BrowserRouter>
        <MilesShellPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
        'href',
        '/settings'
      )
      expect(
        screen.getByLabelText(/miles content placeholder/i)
      ).toBeInTheDocument()
    })
  })
})
