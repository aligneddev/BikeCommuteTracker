import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RideDeleteDialog } from './RideDeleteDialog'

describe('RideDeleteDialog', () => {
  const mockRide = {
    rideId: 1,
    rideDateTimeLocal: '2024-01-15T08:30:00',
    miles: 5.5,
    rideMinutes: 30,
    temperature: 65,
    notes: 'Morning commute',
  }

  it('should not be rendered when isOpen is false', () => {
    const { container } = render(
      <RideDeleteDialog
        isOpen={false}
        ride={mockRide}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Dialog should either not exist or have display: none
    const dialog = container.querySelector('[data-testid="delete-dialog"]')
    if (dialog) {
      expect(window.getComputedStyle(dialog).display).toBe('none')
    } else {
      expect(dialog).toBeNull()
    }
  })

  it('should render when isOpen is true with ride details', async () => {
    render(
      <RideDeleteDialog
        isOpen={true}
        ride={mockRide}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Should display ride date (formatted: "MMM DD, YYYY")
    await waitFor(() => {
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
    })

    // Should display miles
    expect(screen.getByText(/5\.5/)).toBeInTheDocument()

    // Should display warning message
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
  })

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()

    render(
      <RideDeleteDialog
        isOpen={true}
        ride={mockRide}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelButton)

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should call onConfirm when confirm delete button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <RideDeleteDialog
        isOpen={true}
        ride={mockRide}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /Confirm Delete|Delete/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
  })

  it('should disable confirm button and show loading state during API call', async () => {
    const onConfirm = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve(undefined)
          }, 100)
        )
    )

    render(
      <RideDeleteDialog
        isOpen={true}
        ride={mockRide}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /Confirm Delete|Delete/i })
    fireEvent.click(confirmButton)

    // Button should be disabled during the call
    await waitFor(() => {
      expect(confirmButton).toBeDisabled()
    })
  })

  it('should display error message when delete fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Delete failed'))

    render(
      <RideDeleteDialog
        isOpen={true}
        ride={mockRide}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /Confirm Delete|Delete/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/Delete failed/)).toBeInTheDocument()
    })

    // Button should be re-enabled for retry
    expect(confirmButton).not.toBeDisabled()
  })

  it('should call onConfirm and keep parent-controlled visibility on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <RideDeleteDialog
        isOpen={true}
        ride={mockRide}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: /Confirm Delete|Delete/i })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    // The parent controls closing by toggling isOpen after successful mutation.
    expect(screen.getByRole('dialog', { name: /delete ride confirmation/i })).toBeInTheDocument()
  })
})
