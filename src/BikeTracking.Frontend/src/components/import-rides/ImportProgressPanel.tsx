import { useEffect, useState } from 'react'

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
  const isTerminal = isTerminalStatus(status)
  const etaSeconds = etaMinutesRounded === null ? null : Math.max(etaMinutesRounded * 60, 1)
  const [displayedEtaSeconds, setDisplayedEtaSeconds] = useState<number | null>(etaSeconds)
  const [etaTotalSeconds, setEtaTotalSeconds] = useState<number | null>(etaSeconds)

  useEffect(() => {
    setDisplayedEtaSeconds(etaSeconds)
    setEtaTotalSeconds(etaSeconds)
  }, [etaSeconds])

  useEffect(() => {
    if (status !== 'processing' || displayedEtaSeconds === null || displayedEtaSeconds <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setDisplayedEtaSeconds((current) => {
        if (current === null || current <= 0) {
          return current
        }

        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [displayedEtaSeconds, status])

  const etaProgressMax = etaTotalSeconds ?? 1
  const etaProgressValue =
    displayedEtaSeconds === null || etaTotalSeconds === null
      ? 0
      : Math.max(0, etaTotalSeconds - displayedEtaSeconds)
  const etaLabel =
    displayedEtaSeconds === null ? 'ETA: calculating...' : `ETA: ${displayedEtaSeconds}s remaining`

  return (
    <section aria-label="Import progress">
      <h2>Import Progress</h2>
      <p>Status: {status}</p>
      <p>Complete: {percentComplete ?? 0}%</p>
      <p>{etaLabel}</p>
      <progress
        aria-label="ETA progress"
        className="import-rides-eta-progress"
        value={etaProgressValue}
        max={etaProgressMax}
      />
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
