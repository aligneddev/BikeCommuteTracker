import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImportProgressPanel } from './ImportProgressPanel'

describe('ImportProgressPanel', () => {
  it('renders processing progress with estimating text and cancel action', () => {
    render(
      <ImportProgressPanel
        status="processing"
        percentComplete={25}
        etaMinutesRounded={null}
        importedRows={3}
        skippedRows={1}
        failedRows={0}
        isCancelling={false}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/status: processing/i)).toBeInTheDocument()
    expect(screen.getByText(/complete: 25%/i)).toBeInTheDocument()
    expect(screen.getByText(/eta: estimating/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel import/i })).toBeInTheDocument()
  })

  it('renders terminal summary and hides cancel action after cancellation', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <ImportProgressPanel
        status="cancelled"
        percentComplete={40}
        etaMinutesRounded={null}
        importedRows={4}
        skippedRows={2}
        failedRows={1}
        isCancelling={false}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText(/imported: 4/i)).toBeInTheDocument()
    expect(screen.getByText(/skipped: 2/i)).toBeInTheDocument()
    expect(screen.getByText(/failed: 1/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel import/i })).not.toBeInTheDocument()

    await user.keyboard('{Tab}')
    expect(onCancel).not.toHaveBeenCalled()
  })
})
