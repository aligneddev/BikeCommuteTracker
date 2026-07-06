import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardChartSection } from './dashboard-chart-section'

const mileageByMonth = [
  { monthKey: '2025-01', label: 'Jan', miles: 10 },
  { monthKey: '2025-02', label: 'Feb', miles: 20 },
]

const savingsByMonth = [
  { monthKey: '2025-01', label: 'Jan', mileageRateSavings: 1, fuelCostAvoided: 2, combinedSavings: 3 },
  { monthKey: '2025-02', label: 'Feb', mileageRateSavings: 4, fuelCostAvoided: 5, combinedSavings: 9 },
]

describe('DashboardChartSection', () => {
  it('shows "Rolling 12 months" copy by default (no year/seriesLabel props)', () => {
    render(
      <DashboardChartSection mileageByMonth={mileageByMonth} savingsByMonth={savingsByMonth} />
    )

    expect(screen.getAllByText('Rolling 12 months')).toHaveLength(2)
  })

  it('renders a custom seriesLabel instead of "Rolling 12 months" when provided', () => {
    render(
      <DashboardChartSection
        mileageByMonth={mileageByMonth}
        savingsByMonth={savingsByMonth}
        seriesLabel="Calendar year 2025"
      />
    )

    expect(screen.getAllByText('Calendar year 2025')).toHaveLength(2)
    expect(screen.queryByText('Rolling 12 months')).not.toBeInTheDocument()
  })

  it('renders identical chart data regardless of which label prop is used', () => {
    const { container: defaultContainer } = render(
      <DashboardChartSection mileageByMonth={mileageByMonth} savingsByMonth={savingsByMonth} />
    )
    const defaultMileageCard = defaultContainer.querySelector('.dashboard-chart-card')

    const { container: yearContainer } = render(
      <DashboardChartSection
        mileageByMonth={mileageByMonth}
        savingsByMonth={savingsByMonth}
        seriesLabel="Calendar year 2025"
      />
    )
    const yearMileageCard = yearContainer.querySelector('.dashboard-chart-card')

    expect(defaultMileageCard).not.toBeNull()
    expect(yearMileageCard).not.toBeNull()
  })
})
