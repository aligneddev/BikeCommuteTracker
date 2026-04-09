interface ImportProgressPanelProps {
  status: string
  percentComplete: number | null
  etaMinutesRounded: number | null
  importedRows: number
  skippedRows: number
  failedRows: number
  isCancelling: boolean
  onCancel: () => void
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed'
}

export function ImportProgressPanel({
  status,
  percentComplete,
  etaMinutesRounded,
  importedRows,
  skippedRows,
  failedRows,
  isCancelling,
  onCancel,
}: ImportProgressPanelProps) {
  const etaText = etaMinutesRounded === null ? 'Estimating...' : `~${etaMinutesRounded} minutes remaining`
  const isTerminal = isTerminalStatus(status)

  return (
    <section aria-label="Import progress">
      <h2>Import Progress</h2>
      <p>Status: {status}</p>
      <p>Complete: {percentComplete ?? 0}%</p>
      <p>ETA: {etaText}</p>
      <p>Imported: {importedRows}</p>
      <p>Skipped: {skippedRows}</p>
      <p>Failed: {failedRows}</p>
      {!isTerminal ? (
        <button type="button" onClick={onCancel} disabled={isCancelling}>
          {isCancelling ? 'Cancelling...' : 'Cancel Import'}
        </button>
      ) : null}
    </section>
  )
}
