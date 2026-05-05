import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  cancelImport,
  getImportStatus,
  type ImportDuplicateResolution,
  previewImportCsv,
  startImportCsv,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type ImportStatusResponse,
} from '../../services/import-api'
import {
  subscribeToImportProgress,
  type ImportProgressRealtimeNotification,
  type ImportProgressRealtimeSubscription,
} from '../../services/import-progress-realtime'
import { DuplicateResolutionDialog } from '../../components/import-rides/DuplicateResolutionDialog'
import { ImportProgressPanel } from '../../components/import-rides/ImportProgressPanel'
import './ImportRidesPage.css'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ACTIVE_IMPORT_JOB_KEY = 'bike_tracking_active_import_job_id'

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed'
}

function readActiveImportJobId(): number | null {
  const raw = sessionStorage.getItem(ACTIVE_IMPORT_JOB_KEY)
  if (raw === null) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
}

function persistActiveImportJobId(importJobId: number): void {
  sessionStorage.setItem(ACTIVE_IMPORT_JOB_KEY, importJobId.toString())
}

function clearActiveImportJobId(): void {
  sessionStorage.removeItem(ACTIVE_IMPORT_JOB_KEY)
}

export function ImportRidesPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false)
  const [isStarting, setIsStarting] = useState<boolean>(false)
  const [isCancelling, setIsCancelling] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [status, setStatus] = useState<ImportStatusResponse | null>(null)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState<boolean>(false)
  const [overrideAllDuplicates, setOverrideAllDuplicates] = useState<boolean>(false)
  const [duplicateResolutions, setDuplicateResolutions] = useState<ImportDuplicateResolution[]>([])
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false)
  const [isDiscardingPreview, setIsDiscardingPreview] = useState<boolean>(false)

  const duplicateRows: ImportPreviewRow[] =
    preview?.rows.filter((row) => row.duplicateMatches.length > 0) ?? []
  const hasStartedImport = isStarting || status !== null
  const isImportCompleted = status?.status === 'completed'

  useEffect(() => {
    const importJobId = readActiveImportJobId()
    if (importJobId === null) {
      return
    }

    void loadStatus(importJobId)
  }, [])

  useEffect(() => {
    if (status?.status !== 'processing' || isRealtimeConnected) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadStatus(status.importJobId)
    }, 2000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRealtimeConnected, status?.importJobId, status?.status])

  useEffect(() => {
    if (status?.status !== 'processing') {
      setIsRealtimeConnected(false)
      return
    }

    let subscription: ImportProgressRealtimeSubscription | null = null
    let isMounted = true

    const connect = async (): Promise<void> => {
      try {
        subscription = await subscribeToImportProgress(status.importJobId, {
          onProgress: (notification: ImportProgressRealtimeNotification): void => {
            if (!isMounted || notification.importJobId !== status.importJobId) {
              return
            }

            setStatus((current) => {
              if (current === null || current.importJobId !== notification.importJobId) {
                return current
              }

              return {
                ...current,
                status: notification.status,
                totalRows: notification.totalRows,
                processedRows: notification.processedRows,
                importedRows: notification.importedRows,
                skippedRows: notification.skippedRows,
                failedRows: notification.failedRows,
                percentComplete: notification.percentComplete,
                etaMinutesRounded: notification.etaMinutesRounded ?? null,
                completedAtUtc: isTerminalStatus(notification.status)
                  ? notification.emittedAtUtc
                  : current.completedAtUtc,
              }
            })

            if (isTerminalStatus(notification.status)) {
              clearActiveImportJobId()
              setIsRealtimeConnected(false)
            }
          },
          onConnectionStateChanged: (state): void => {
            if (!isMounted) {
              return
            }

            setIsRealtimeConnected(state === 'connected')
          },
        })
      } catch {
        if (!isMounted) {
          return
        }

        setIsRealtimeConnected(false)
      }
    }

    void connect()

    return () => {
      isMounted = false
      setIsRealtimeConnected(false)
      if (subscription !== null) {
        void subscription.stop()
      }
    }
  }, [status?.importJobId, status?.status])

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]

    setErrorMessage('')
    setPreview(null)
    setStatus(null)
    setIsDuplicateDialogOpen(false)
    setOverrideAllDuplicates(false)
    setDuplicateResolutions([])
    clearActiveImportJobId()

    if (!file) {
      setSelectedFile(null)
      setSelectedFileName('')
      return
    }

    const hasCsvExtension = file.name.toLowerCase().endsWith('.csv')
    if (!hasCsvExtension) {
      setSelectedFile(null)
      setSelectedFileName(file.name)
      setErrorMessage('Please upload a .csv file.')
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null)
      setSelectedFileName(file.name)
      setErrorMessage('CSV file must be 5 MB or smaller.')
      return
    }

    setSelectedFile(file)
    setSelectedFileName(file.name)
  }

  async function loadStatus(importJobId: number): Promise<void> {
    const statusResponse = await getImportStatus(importJobId)
    if (!statusResponse.ok || !statusResponse.data) {
      setErrorMessage(statusResponse.error?.message ?? 'Unable to load import status.')
      return
    }

    setStatus(statusResponse.data)
    if (isTerminalStatus(statusResponse.data.status)) {
      clearActiveImportJobId()
    } else {
      persistActiveImportJobId(statusResponse.data.importJobId)
    }
  }

  async function toBase64(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })

    return window.btoa(binary)
  }

  async function onPreview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage('')

    if (!selectedFile) {
      setErrorMessage('Select a CSV file before previewing import results.')
      return
    }

    setIsPreviewing(true)
    setStatus(null)
    try {
      const contentBase64 = await toBase64(selectedFile)
      const response = await previewImportCsv({
        fileName: selectedFile.name,
        contentBase64,
      })

      if (response.ok && response.data) {
        setPreview(response.data)
        setIsDuplicateDialogOpen(false)
        setOverrideAllDuplicates(false)
        setDuplicateResolutions([])
        return
      }

      setPreview(null)
      setErrorMessage(response.error?.message ?? 'Unable to preview this CSV import.')
    } catch {
      setPreview(null)
      setErrorMessage('Unable to preview this CSV import.')
    } finally {
      setIsPreviewing(false)
    }
  }

  function resetForNewImport(): void {
    setSelectedFile(null)
    setSelectedFileName('')
    setPreview(null)
    setStatus(null)
    setIsDuplicateDialogOpen(false)
    setOverrideAllDuplicates(false)
    setDuplicateResolutions([])
    setIsRealtimeConnected(false)
    clearActiveImportJobId()
  }

  function onResolutionChange(
    rowNumber: number,
    action: ImportDuplicateResolution['action']
  ): void {
    setDuplicateResolutions((current) => {
      const next = current.filter((resolution) => resolution.rowNumber !== rowNumber)
      next.push({ rowNumber, action })
      next.sort((left, right) => left.rowNumber - right.rowNumber)
      return next
    })
  }

  async function runStartImport(
    importJobId: number,
    overrideAll: boolean,
    resolutions: ImportDuplicateResolution[]
  ): Promise<void> {
    setErrorMessage('')
    setIsStarting(true)
    try {
      const startResponse = await startImportCsv({
        importJobId,
        overrideAllDuplicates: overrideAll,
        resolutions,
      })

      if (!startResponse.ok || !startResponse.data) {
        setErrorMessage(startResponse.error?.message ?? 'Unable to start import.')
        return
      }

      setIsDuplicateDialogOpen(false)
      persistActiveImportJobId(startResponse.data.importJobId)
      await loadStatus(startResponse.data.importJobId)
    } catch {
      setErrorMessage('Unable to start import.')
    } finally {
      setIsStarting(false)
    }
  }

  async function onStartImport(): Promise<void> {
    if (!preview || hasStartedImport) {
      return
    }

    if (preview.requiresDuplicateResolution && duplicateRows.length > 0) {
      setIsDuplicateDialogOpen(true)
      return
    }

    await runStartImport(preview.importJobId, false, [])
  }

  async function onConfirmDuplicateResolution(): Promise<void> {
    if (!preview) {
      return
    }

    await runStartImport(preview.importJobId, overrideAllDuplicates, duplicateResolutions)
  }

  async function onCancelDuplicateResolution(): Promise<void> {
    if (!preview) {
      resetForNewImport()
      return
    }

    setIsDiscardingPreview(true)
    setErrorMessage('')

    try {
      const cancelResponse = await cancelImport(preview.importJobId)
      if (!cancelResponse.ok) {
        setErrorMessage(cancelResponse.error?.message ?? 'Unable to discard import preview.')
        return
      }

      resetForNewImport()
    } catch {
      setErrorMessage('Unable to discard import preview.')
    } finally {
      setIsDiscardingPreview(false)
    }
  }

  async function onCancelImport(): Promise<void> {
    if (status === null) {
      return
    }

    setErrorMessage('')
    setIsCancelling(true)
    try {
      const cancelResponse = await cancelImport(status.importJobId)
      if (!cancelResponse.ok || !cancelResponse.data) {
        setErrorMessage(cancelResponse.error?.message ?? 'Unable to cancel import.')
        return
      }

      const cancelled = cancelResponse.data

      clearActiveImportJobId()
      setStatus((current) => ({
        importJobId: cancelled.importJobId,
        status: cancelled.status,
        totalRows: current?.totalRows ?? 0,
        processedRows: cancelled.processedRows,
        importedRows: cancelled.importedRows,
        skippedRows: cancelled.skippedRows,
        failedRows: cancelled.failedRows,
        percentComplete: current?.percentComplete ?? null,
        etaMinutesRounded: null,
        createdAtUtc: current?.createdAtUtc ?? cancelled.cancelledAtUtc,
        startedAtUtc: current?.startedAtUtc ?? null,
        completedAtUtc: cancelled.cancelledAtUtc,
        lastError: null,
      }))
    } catch {
      setErrorMessage('Unable to cancel import.')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <main className="import-rides-page">
      <section className="import-rides-card">
        <h1>Import Rides</h1>
        <p className="import-rides-description">
          Upload a CSV to preview row validation, duplicate matches, and import summary before
          processing.
        </p>
        <p className="import-rides-description">
          <a href="/api/rides/csv-sample" download="ride-import-sample.csv">
            Download sample CSV
          </a>
        </p>

        <form onSubmit={onPreview}>
          <label className="import-rides-file-label" htmlFor="csv-upload-input">
            Select CSV file
          </label>
          <input
            id="csv-upload-input"
            className="import-rides-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={onSelectFile}
          />

          <p className="import-rides-selected-file" aria-live="polite">
            {selectedFileName === '' ? 'No file selected.' : `Selected file: ${selectedFileName}`}
          </p>

          {errorMessage !== '' ? (
            <p className="import-rides-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="import-rides-actions">
            <button type="submit" disabled={isPreviewing}>
              {isPreviewing ? 'Previewing...' : 'Preview Import'}
            </button>
          </div>

          {isPreviewing ? (
            <div className="import-rides-loading" aria-live="polite" aria-busy="true">
              <div className="import-rides-spinner" aria-hidden="true" />
              <span>Parsing CSV and checking for duplicates... This may take a moment for large files.</span>
            </div>
          ) : null}
        </form>

        {preview && !isImportCompleted ? (
          <section className="import-rides-preview" aria-label="Import preview">
            <h2>{hasStartedImport ? 'Import Summary' : 'Preview Summary'}</h2>
            <p>
              Total rows: {preview.totalRows} | Valid rows: {preview.validRows} | Invalid rows: {preview.invalidRows}
            </p>

            <p className="import-rides-duplicates">
              Duplicate rows: {preview.duplicateRows}
              {preview.requiresDuplicateResolution
                ? ' | Resolve duplicates before starting import.'
                : ' | No duplicate review required.'}
            </p>

            {hasStartedImport ? (
              <p className="import-rides-summary-line">
                Import running for {preview.validRows} valid rows. Duplicates reviewed: {preview.duplicateRows}.
              </p>
            ) : preview.rows.length > 0 ? (
              <ul>
                {preview.rows.map((row) => (
                  <li key={row.rowNumber}>
                    Row {row.rowNumber}: {row.isValid ? 'Valid' : 'Invalid'}
                    {row.errors.length > 0 ? (
                      <ul>
                        {row.errors.map((error) => (
                          <li key={`${row.rowNumber}-${error.code}-${error.field ?? 'none'}`}>
                            {error.field ?? 'Row'}: {error.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="import-rides-actions">
              {!isDuplicateDialogOpen ? (
                <button type="button" onClick={() => void onStartImport()} disabled={hasStartedImport}>
                  {isStarting ? 'Starting...' : hasStartedImport ? 'Import Started' : 'Start Import'}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {isImportCompleted ? (
          <section className="import-rides-complete" aria-label="Import complete celebration">
            <div className="import-rides-complete-burst" aria-hidden="true" />
            <div className="import-rides-complete-icon" aria-hidden="true">
              ✓
            </div>
            <h2>Import Complete</h2>
            <p>
              Nice work. {status?.importedRows ?? 0} rides were imported successfully.
            </p>
            <p>Head to your dashboard to see your updated stats and trends.</p>
            <Link className="import-rides-dashboard-link" to="/dashboard">
              Go To Dashboard
            </Link>
          </section>
        ) : status ? (
          <ImportProgressPanel
            status={status.status}
            percentComplete={status.percentComplete ?? null}
            etaMinutesRounded={status.etaMinutesRounded ?? null}
            importedRows={status.importedRows}
            skippedRows={status.skippedRows}
            failedRows={status.failedRows}
            isCancelling={isCancelling}
            onCancel={() => void onCancelImport()}
          />
        ) : (
          <p className="import-rides-placeholder">
            Start an import to see progress and cancellation controls.
          </p>
        )}
      </section>

      <DuplicateResolutionDialog
        isOpen={isDuplicateDialogOpen}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={overrideAllDuplicates}
        resolutions={duplicateResolutions}
        isSubmitting={isStarting || isDiscardingPreview}
        onClose={() => void onCancelDuplicateResolution()}
        onConfirm={() => void onConfirmDuplicateResolution()}
        onOverrideAllDuplicatesChange={setOverrideAllDuplicates}
        onResolutionChange={onResolutionChange}
      />
    </main>
  )
}
