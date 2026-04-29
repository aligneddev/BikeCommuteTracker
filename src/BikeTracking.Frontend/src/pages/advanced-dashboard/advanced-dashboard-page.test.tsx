import { BrowserRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../services/advanced-dashboard-api', () => ({
  getAdvancedDashboard: vi.fn(),
}))

vi.mock('./DifficultyAnalyticsSection', () => ({
  DifficultyAnalyticsSection: () => null,
}))

import * as advancedDashboardApi from '../../services/advanced-dashboard-api'
import type { AdvancedDashboardResponse } from '../../services/advanced-dashboard-api'

const mockGetAdvancedDashboard = vi.mocked(advancedDashboardApi.getAdvancedDashboard)

function buildWindow(
  period: 'weekly' | 'monthly' | 'yearly' | 'allTime',
  overrides: Partial<AdvancedDashboardResponse['savingsWindows']['weekly']> = {}
): AdvancedDashboardResponse['savingsWindows']['weekly'] {
  return {
    period,
    rideCount: 0,
    totalMiles: 0,
    gallonsSaved: null,
    fuelCostAvoided: null,
    fuelCostEstimated: false,
    mileageRateSavings: null,
    combinedSavings: null,
    totalExpenses: 0,
    oilChangeSavings: null,
    netSavings: null,
    ...overrides,
  }
}

function buildResponse(
  overrides: Partial<AdvancedDashboardResponse> = {}
): AdvancedDashboardResponse {
  return {
    savingsWindows: {
      weekly: buildWindow('weekly'),
      monthly: buildWindow('monthly'),
      yearly: buildWindow('yearly'),
      allTime: buildWindow('allTime', { rideCount: 2, totalMiles: 30, gallonsSaved: 2 }),
    },
    suggestions: [
      { suggestionKey: 'consistency', title: 'Great Consistency!', description: 'Keep it up!', isEnabled: false },
      { suggestionKey: 'milestone', title: 'Savings Milestone', description: 'Hit $10 first.', isEnabled: false },
      { suggestionKey: 'comeback', title: 'Comeback Ride', description: "You're on a roll!", isEnabled: false },
    ],
    reminders: {
      mpgReminderRequired: false,
      mileageRateReminderRequired: false,
    },
    generatedAtUtc: new Date().toISOString(),
    difficultySection: null,
    ...overrides,
  }
}

describe('AdvancedDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AdvancedDashboardPage_OnLoad_DisplaysAllTimeSavingsCorrectly', async () => {
    mockGetAdvancedDashboard.mockResolvedValue(
      buildResponse({
        savingsWindows: {
          weekly: buildWindow('weekly'),
          monthly: buildWindow('monthly'),
          yearly: buildWindow('yearly'),
          allTime: buildWindow('allTime', {
            rideCount: 5,
            totalMiles: 100,
            gallonsSaved: 5.0,
            fuelCostAvoided: 17.5,
            mileageRateSavings: 67.0,
            combinedSavings: 84.5,
          }),
        },
        suggestions: [
          { suggestionKey: 'consistency', title: 'Great Consistency!', description: 'Keep it up!', isEnabled: false },
          { suggestionKey: 'milestone', title: 'Savings Milestone', description: 'Hit $10 first.', isEnabled: false },
          { suggestionKey: 'comeback', title: 'Comeback Ride', description: "You're on a roll!", isEnabled: false },
        ],
        reminders: { mpgReminderRequired: false, mileageRateReminderRequired: false },
      })
    )

    const { AdvancedDashboardPage } = await import('./advanced-dashboard-page')
    render(
      <BrowserRouter>
        <AdvancedDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/savings breakdown/i)).toBeInTheDocument()
    })

    expect(screen.getAllByText(/all time/i).length).toBeGreaterThan(0)
  })

  it('AdvancedDashboardPage_MpgReminderRequired_ShowsReminderCard', async () => {
    mockGetAdvancedDashboard.mockResolvedValue(
      buildResponse({
        reminders: { mpgReminderRequired: true, mileageRateReminderRequired: false },
      })
    )

    const { AdvancedDashboardPage } = await import('./advanced-dashboard-page')
    render(
      <BrowserRouter>
        <AdvancedDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('mpg-reminder')).toBeInTheDocument()
    })

    expect(screen.getByText(/set your average car mpg/i)).toBeInTheDocument()
  })

  it('AdvancedDashboardPage_MileageRateReminderRequired_ShowsReminderCard', async () => {
    mockGetAdvancedDashboard.mockResolvedValue(
      buildResponse({
        reminders: { mpgReminderRequired: false, mileageRateReminderRequired: true },
      })
    )

    const { AdvancedDashboardPage } = await import('./advanced-dashboard-page')
    render(
      <BrowserRouter>
        <AdvancedDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('mileage-rate-reminder')).toBeInTheDocument()
    })

    expect(screen.getByText(/set your mileage rate/i)).toBeInTheDocument()
  })

  it('AdvancedDashboardPage_AllWindowsPopulated_TablesVisible', async () => {
    mockGetAdvancedDashboard.mockResolvedValue(buildResponse())

    const { AdvancedDashboardPage } = await import('./advanced-dashboard-page')
    render(
      <BrowserRouter>
        <AdvancedDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/this week/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/this month/i)).toBeInTheDocument()
    expect(screen.getByText(/this year/i)).toBeInTheDocument()
    expect(screen.getAllByText(/all time/i).length).toBeGreaterThan(0)
  })

  it('AdvancedDashboardPage_SuggestionsVisible_RendersPanel', async () => {
    mockGetAdvancedDashboard.mockResolvedValue(
      buildResponse({
        suggestions: [
          {
            suggestionKey: 'consistency',
            title: 'Great Consistency!',
            description: "You've biked 3 times this week!",
            isEnabled: true,
          },
          { suggestionKey: 'milestone', title: 'Savings Milestone', description: 'Hit $10 first.', isEnabled: false },
          { suggestionKey: 'comeback', title: 'Comeback Ride', description: "You're on a roll!", isEnabled: false },
        ],
      })
    )

    const { AdvancedDashboardPage } = await import('./advanced-dashboard-page')
    render(
      <BrowserRouter>
        <AdvancedDashboardPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/great consistency/i)).toBeInTheDocument()
    })
  })

  it('DashboardPage_AdvancedStatsLink_NavigatesToAdvancedDashboard', async () => {
    const { DashboardPage } = await import('../dashboard/dashboard-page')
    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    expect(screen.getByRole('link', { name: /view advanced stats/i })).toBeInTheDocument()
  })
})
