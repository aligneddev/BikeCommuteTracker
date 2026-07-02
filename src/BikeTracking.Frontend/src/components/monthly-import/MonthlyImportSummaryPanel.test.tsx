import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthlyImportSummaryPanel } from './MonthlyImportSummaryPanel'

describe('MonthlyImportSummaryPanel', () => {
  it('displays months processed, rides created, replaced, skipped, and rows rejected', () => {
    render(
      <MonthlyImportSummaryPanel
        monthsProcessed={3}
        ridesCreated={23}
        ridesReplaced={2}
        ridesSkipped={1}
        rowsRejected={4}
      />,
    )

    expect(screen.getByText(/months processed: 3/i)).toBeInTheDocument()
    expect(screen.getByText(/rides created: 23/i)).toBeInTheDocument()
    expect(screen.getByText(/rides replaced: 2/i)).toBeInTheDocument()
    expect(screen.getByText(/rides skipped: 1/i)).toBeInTheDocument()
    expect(screen.getByText(/rows rejected: 4/i)).toBeInTheDocument()
  })

  it('renders zero values instead of leaving them blank', () => {
    render(
      <MonthlyImportSummaryPanel
        monthsProcessed={0}
        ridesCreated={0}
        ridesReplaced={0}
        ridesSkipped={0}
        rowsRejected={0}
      />,
    )

    expect(screen.getByText(/months processed: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/rides created: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/rides replaced: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/rides skipped: 0/i)).toBeInTheDocument()
    expect(screen.getByText(/rows rejected: 0/i)).toBeInTheDocument()
  })
})
