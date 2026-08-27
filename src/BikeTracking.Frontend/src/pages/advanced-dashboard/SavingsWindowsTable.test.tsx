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
    totalExpenses: 0,
    oilChangeSavings: null,
    netSavings: null,
    co2Saved: 0,
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

  it('SavingsWindowsTable_WithExpenses_ShowsExpensesAndNetSavingsColumns', () => {
    render(
      <SavingsWindowsTable
        weekly={buildWindow('weekly')}
        monthly={buildWindow('monthly', {
          totalExpenses: 50,
          combinedSavings: 67,
          netSavings: 17,
        })}
        yearly={buildWindow('yearly')}
        allTime={buildWindow('allTime', {
          totalExpenses: 50,
          combinedSavings: 67,
          netSavings: 17,
        })}
      />
    )

    // Column headers
    expect(screen.getByText(/expenses/i)).toBeInTheDocument()
    expect(screen.getByText(/net savings/i)).toBeInTheDocument()
    // Expense value rendered
    expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0)
    // Net savings value rendered
    expect(screen.getAllByText('$17.00').length).toBeGreaterThan(0)
  })

  it('SavingsWindowsTable_NegativeNetSavings_AppliesRedStyle', () => {
    render(
      <SavingsWindowsTable
        weekly={buildWindow('weekly')}
        monthly={buildWindow('monthly', {
          totalExpenses: 50,
          combinedSavings: 10,
          netSavings: -40,
        })}
        yearly={buildWindow('yearly')}
        allTime={buildWindow('allTime')}
      />
    )

    // The negative net savings cell should have the red CSS class
    const negativeCell = screen.getByText('-$40.00')
    expect(negativeCell).toBeInTheDocument()
    expect(negativeCell.closest('td')?.className).toContain('savings-windows-negative')
  })

  it('SavingsWindowsTable_WithCo2SavedValues_RendersCo2SavedColumnForAllFourWindows', () => {
    render(
      <SavingsWindowsTable
        weekly={buildWindow('weekly', { totalMiles: 10, co2Saved: 9 })}
        monthly={buildWindow('monthly', { totalMiles: 24.5, co2Saved: 22.05 })}
        yearly={buildWindow('yearly', { totalMiles: 100, co2Saved: 90 })}
        allTime={buildWindow('allTime', { totalMiles: 0, co2Saved: 0 })}
      />
    )

    expect(screen.getByText(/co2 saved/i)).toBeInTheDocument()
    expect(screen.getByText('9.00 lb')).toBeInTheDocument()
    expect(screen.getByText('22.05 lb')).toBeInTheDocument()
    expect(screen.getByText('90.00 lb')).toBeInTheDocument()
    // Zero-mile window shows "0.00 lb", never blank or "—"
    expect(screen.getByText('0.00 lb')).toBeInTheDocument()
  })
})

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
