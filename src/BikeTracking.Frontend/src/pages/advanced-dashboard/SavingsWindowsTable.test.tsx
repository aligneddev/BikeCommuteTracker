import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SavingsWindowsTable } from './SavingsWindowsTable'
import type { AdvancedSavingsWindow } from '../../services/advanced-dashboard-api'

function buildWindow(
  period: 'weekly' | 'monthly' | 'yearly' | 'allTime',
  overrides: Partial<AdvancedSavingsWindow> = {}
): AdvancedSavingsWindow {
  return {
    period,
    rideCount: 0,
    totalMiles: 0,
    gallonsSaved: null,
    fuelCostAvoided: null,
    fuelCostEstimated: false,
    mileageRateSavings: null,
    combinedSavings: null,
    ...overrides,
  }
}

describe('SavingsWindowsTable', () => {
  it('SavingsWindowsTable_WithMultipleWindows_RendersFourRows', () => {
    render(
      <SavingsWindowsTable
        weekly={buildWindow('weekly', { rideCount: 1, totalMiles: 5 })}
        monthly={buildWindow('monthly', { rideCount: 4, totalMiles: 20 })}
        yearly={buildWindow('yearly', { rideCount: 40, totalMiles: 200 })}
        allTime={buildWindow('allTime', { rideCount: 100, totalMiles: 500 })}
      />
    )

    expect(screen.getByText(/this week/i)).toBeInTheDocument()
    expect(screen.getByText(/this month/i)).toBeInTheDocument()
    expect(screen.getByText(/this year/i)).toBeInTheDocument()
    expect(screen.getByText(/all time/i)).toBeInTheDocument()
  })

  it('SavingsWindowsTable_FuelCostEstimated_ShowsEstimatedBadge', () => {
    render(
      <SavingsWindowsTable
        weekly={buildWindow('weekly', {
          fuelCostAvoided: 5.25,
          fuelCostEstimated: true,
          gallonsSaved: 1.5,
        })}
        monthly={buildWindow('monthly')}
        yearly={buildWindow('yearly')}
        allTime={buildWindow('allTime')}
      />
    )

    expect(screen.getByText('Est.')).toBeInTheDocument()
  })

  it('renders dash for null savings values', () => {
    render(
      <SavingsWindowsTable
        weekly={buildWindow('weekly')}
        monthly={buildWindow('monthly')}
        yearly={buildWindow('yearly')}
        allTime={buildWindow('allTime')}
      />
    )

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
