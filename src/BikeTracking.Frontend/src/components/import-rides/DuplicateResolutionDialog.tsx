import type { ImportDuplicateResolution, ImportPreviewRow } from '../../services/import-api'
import './DuplicateResolutionDialog.css'

export interface DuplicateResolutionDialogProps {
  isOpen: boolean
  duplicateRows: readonly ImportPreviewRow[]
  overrideAllDuplicates: boolean
  resolutions: readonly ImportDuplicateResolution[]
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
  onOverrideAllDuplicatesChange: (value: boolean) => void
  onResolutionChange: (
    rowNumber: number,
    action: ImportDuplicateResolution['action']
  ) => void
}

function getResolution(
  resolutions: readonly ImportDuplicateResolution[],
  rowNumber: number
): ImportDuplicateResolution['action'] | null {
  const match = resolutions.find((resolution) => resolution.rowNumber === rowNumber)
  return match?.action ?? null
}

function formatMiles(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Unknown miles'
  }

  return `${value.toFixed(1)} mi`
}

export function DuplicateResolutionDialog({
  isOpen,
  duplicateRows,
  overrideAllDuplicates,
  resolutions,
  isSubmitting,
  onClose,
  onConfirm,
  onOverrideAllDuplicatesChange,
  onResolutionChange,
}: DuplicateResolutionDialogProps) {
  if (!isOpen) {
    return null
  }

  const duplicateCount = duplicateRows.length
  const hasAllResolutions = duplicateRows.every(
    (row) => getResolution(resolutions, row.rowNumber) !== null
  )
  const canConfirm = overrideAllDuplicates || hasAllResolutions

  return (
    <div className="duplicate-resolution-backdrop" role="presentation">
      <section
        aria-label="Duplicate resolution"
        aria-modal="true"
        className="duplicate-resolution-dialog"
        role="dialog"
      >
        <h2>Resolve duplicates</h2>
        <p className="duplicate-resolution-summary">
          {duplicateCount} {duplicateCount === 1 ? 'duplicate row requires' : 'duplicate rows require'} a
          decision before import can start.
        </p>

        <label className="duplicate-resolution-override">
          <input
            type="checkbox"
            checked={overrideAllDuplicates}
            onChange={(event) => onOverrideAllDuplicatesChange(event.target.checked)}
          />
          Override all duplicates
        </label>

        <div className="duplicate-resolution-list">
          {duplicateRows.map((row) => {
            const selectedAction = getResolution(resolutions, row.rowNumber)

            return (
              <section key={row.rowNumber} className="duplicate-resolution-row">
                <h3>Row {row.rowNumber}</h3>
                <p>
                  Incoming ride: {row.date ?? 'Unknown date'} • {formatMiles(row.miles)}
                </p>
                <ul>
                  {row.duplicateMatches.map((match) => (
                    <li key={match.existingRideId}>
                      Existing ride #{match.existingRideId}: {match.existingRideDate} •{' '}
                      {formatMiles(match.existingMiles)}
                    </li>
                  ))}
                </ul>

                <fieldset disabled={overrideAllDuplicates}>
                  <legend>Choose how to resolve row {row.rowNumber}</legend>
                  <label>
                    <input
                      type="radio"
                      name={`duplicate-row-${row.rowNumber}`}
                      checked={selectedAction === 'keep-existing'}
                      onChange={() => onResolutionChange(row.rowNumber, 'keep-existing')}
                    />
                    Row {row.rowNumber} keep existing
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`duplicate-row-${row.rowNumber}`}
                      checked={selectedAction === 'replace-with-import'}
                      onChange={() => onResolutionChange(row.rowNumber, 'replace-with-import')}
                    />
                    Row {row.rowNumber} replace with import
                  </label>
                </fieldset>
              </section>
            )
          })}
        </div>

        <div className="duplicate-resolution-actions">
          <button type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={!canConfirm || isSubmitting}>
            {isSubmitting ? 'Starting...' : 'Start Import'}
          </button>
        </div>
      </section>
    </div>
  )
}
