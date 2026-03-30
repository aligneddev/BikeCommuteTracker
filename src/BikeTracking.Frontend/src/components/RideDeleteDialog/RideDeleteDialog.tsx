import { useMemo, useState } from 'react'
import './RideDeleteDialog.css'

export interface RideDeleteDialogRide {
  rideId: number
  rideDateTimeLocal: string
  miles: number
  rideMinutes?: number
  temperature?: number
  notes?: string
}

interface RideDeleteDialogProps {
  isOpen: boolean
  ride: RideDeleteDialogRide | null
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}

function formatDialogDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function RideDeleteDialog({
  isOpen,
  ride,
  onConfirm,
  onCancel,
}: RideDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const formattedDate = useMemo(() => {
    if (!ride) {
      return ''
    }

    return formatDialogDate(ride.rideDateTimeLocal)
  }, [ride])

  if (!isOpen || !ride) {
    return null
  }

  async function handleConfirm(): Promise<void> {
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await onConfirm()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Delete failed'
      setErrorMessage(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="ride-delete-dialog-backdrop" role="presentation">
      <section
        aria-label="Delete ride confirmation"
        aria-modal="true"
        className="ride-delete-dialog"
        data-testid="delete-dialog"
        role="dialog"
      >
        <h2>Delete Ride</h2>
        <p className="ride-delete-dialog-warning">This action cannot be undone.</p>

        <dl className="ride-delete-dialog-details">
          <div>
            <dt>Date</dt>
            <dd>{formattedDate}</dd>
          </div>
          <div>
            <dt>Miles</dt>
            <dd>{ride.miles.toFixed(1)} mi</dd>
          </div>
        </dl>

        {errorMessage ? (
          <p className="ride-delete-dialog-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="ride-delete-dialog-actions">
          <button type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" onClick={() => void handleConfirm()} disabled={isSubmitting}>
            {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </section>
    </div>
  )
}
