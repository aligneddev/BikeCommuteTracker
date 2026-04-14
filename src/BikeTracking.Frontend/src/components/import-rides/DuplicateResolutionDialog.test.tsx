import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DuplicateResolutionDialog } from './DuplicateResolutionDialog'

const duplicateRows = [
  {
    rowNumber: 1,
    date: '2026-04-01',
    miles: 12.5,
    rideMinutes: 45,
    temperature: 60,
    tags: 'commute',
    notes: 'incoming ride',
    isValid: true,
    errors: [],
    duplicateMatches: [
      {
        existingRideId: 9,
        existingRideDate: '2026-04-01',
        existingMiles: 12.5,
      },
    ],
  },
  {
    rowNumber: 2,
    date: '2026-04-02',
    miles: 9.25,
    rideMinutes: 30,
    temperature: null,
    tags: 'errand',
    notes: 'another incoming ride',
    isValid: true,
    errors: [],
    duplicateMatches: [
      {
        existingRideId: 10,
        existingRideDate: '2026-04-02',
        existingMiles: 9.25,
      },
    ],
  },
] as const

describe('DuplicateResolutionDialog', () => {
  it('does not render when closed', () => {
    render(
      <DuplicateResolutionDialog
        isOpen={false}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={false}
        resolutions={[]}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onOverrideAllDuplicatesChange={vi.fn()}
        onResolutionChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('dialog', { name: /duplicate resolution/i })).not.toBeInTheDocument()
  })

  it('renders duplicate rows and enables confirmation once every row has a resolution', async () => {
    const user = userEvent.setup()
    const onResolutionChange = vi.fn()

    const { rerender } = render(
      <DuplicateResolutionDialog
        isOpen={true}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={false}
        resolutions={[]}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onOverrideAllDuplicatesChange={vi.fn()}
        onResolutionChange={onResolutionChange}
      />
    )

    expect(screen.getByRole('heading', { name: /row 1/i })).toBeInTheDocument()
    expect(screen.getByText(/existing ride #9/i)).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: /start import/i })
    expect(confirmButton).toBeDisabled()

    await user.click(screen.getByLabelText(/row 1 keep existing/i))
    expect(onResolutionChange).toHaveBeenCalledWith(1, 'keep-existing')

    rerender(
      <DuplicateResolutionDialog
        isOpen={true}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={false}
        resolutions={[{ rowNumber: 1, action: 'keep-existing' }]}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onOverrideAllDuplicatesChange={vi.fn()}
        onResolutionChange={onResolutionChange}
      />
    )

    expect(confirmButton).toBeDisabled()

    await user.click(screen.getByLabelText(/row 2 replace with import/i))
    expect(onResolutionChange).toHaveBeenCalledWith(2, 'replace-with-import')

    rerender(
      <DuplicateResolutionDialog
        isOpen={true}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={false}
        resolutions={[
          { rowNumber: 1, action: 'keep-existing' },
          { rowNumber: 2, action: 'replace-with-import' },
        ]}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onOverrideAllDuplicatesChange={vi.fn()}
        onResolutionChange={onResolutionChange}
      />
    )

    expect(confirmButton).toBeEnabled()
  })

  it('allows override-all to enable confirmation without per-row selections', async () => {
    const user = userEvent.setup()
    const onOverrideAllDuplicatesChange = vi.fn()
    const onConfirm = vi.fn()

    const { rerender } = render(
      <DuplicateResolutionDialog
        isOpen={true}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={false}
        resolutions={[]}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        onOverrideAllDuplicatesChange={onOverrideAllDuplicatesChange}
        onResolutionChange={vi.fn()}
      />
    )

    await user.click(screen.getByLabelText(/override all duplicates/i))
    expect(onOverrideAllDuplicatesChange).toHaveBeenCalledWith(true)

    rerender(
      <DuplicateResolutionDialog
        isOpen={true}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={true}
        resolutions={[]}
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        onOverrideAllDuplicatesChange={onOverrideAllDuplicatesChange}
        onResolutionChange={vi.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /start import/i })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})