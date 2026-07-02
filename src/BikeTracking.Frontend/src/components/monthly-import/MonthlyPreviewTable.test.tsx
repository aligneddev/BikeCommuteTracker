import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthlyPreviewTable } from './MonthlyPreviewTable'
import type { MonthlyImportMonthRow } from '../../services/monthly-import-api'

function makeRow(overrides: Partial<MonthlyImportMonthRow> = {}): MonthlyImportMonthRow {
  return {
    rowNumber: 1,
    rawMonth: 'January',
    year: 2025,
    totalMiles: 96,
    days: 8,
    isValid: true,
    errors: [],
    generatedRides: [
      { rideIndex: 1, date: '2025-01-02', miles: 12, isDuplicate: false, duplicateMatches: [] },
    ],
    ...overrides,
  }
}

describe('MonthlyPreviewTable', () => {
  it('renders an empty-state message when there are no rows', () => {
    render(<MonthlyPreviewTable rows={[]} headerDetectionWarning={false} />)

    expect(screen.getByText(/no month rows found/i)).toBeInTheDocument()
  })

  it('renders each month row with the generated ride count', () => {
    const rows = [
      makeRow({ rowNumber: 1, rawMonth: 'January' }),
      makeRow({ rowNumber: 2, rawMonth: 'February', generatedRides: [] }),
    ]

    render(<MonthlyPreviewTable rows={rows} headerDetectionWarning={false} />)

    expect(screen.getByText('January')).toBeInTheDocument()
    expect(screen.getByText('February')).toBeInTheDocument()
  })

  it('marks duplicate rides with a visual indicator', () => {
    const rows = [
      makeRow({
        generatedRides: [
          {
            rideIndex: 1,
            date: '2025-01-02',
            miles: 12,
            isDuplicate: true,
            duplicateMatches: [{ existingRideId: 5, existingRideDate: '2025-01-02', existingMiles: 4 }],
          },
        ],
      }),
    ]

    render(<MonthlyPreviewTable rows={rows} headerDetectionWarning={false} />)

    expect(screen.getByText(/duplicate/i)).toBeInTheDocument()
  })

  it('renders per-row validation error messages', () => {
    const rows = [
      makeRow({
        isValid: false,
        generatedRides: [],
        errors: [{ rowNumber: 1, code: 'INVALID_MONTH', message: 'Unrecognised month name.' }],
      }),
    ]

    render(<MonthlyPreviewTable rows={rows} headerDetectionWarning={false} />)

    expect(screen.getByText('Unrecognised month name.')).toBeInTheDocument()
  })

  it('shows the header detection warning when true', () => {
    render(<MonthlyPreviewTable rows={[makeRow()]} headerDetectionWarning={true} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/column mapping/i)
  })
})
