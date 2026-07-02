import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DuplicateResolutionDialog } from '../../components/import-rides/DuplicateResolutionDialog'
import { ImportProgressPanel } from '../../components/import-rides/ImportProgressPanel'
import { MonthlyImportSummaryPanel } from '../../components/monthly-import/MonthlyImportSummaryPanel'
import { MonthlyPreviewTable } from '../../components/monthly-import/MonthlyPreviewTable'
import { MonthlyYearSelector } from '../../components/monthly-import/MonthlyYearSelector'
import {
  cancelMonthlyImport,
  getMonthlyImportStatus,
  previewMonthlyImport,
  startMonthlyImport,
  type MonthlyImportPreviewResponse,
} from '../../services/monthly-import-api'
import type { ImportDuplicateResolution, ImportPreviewRow } from '../../services/import-api'
import './MonthlyImportPage.css'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed'
}

export function MonthlyImportPage() {
  const [pastedText, setPastedText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [year, setYear] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [preview, setPreview] = useState<MonthlyImportPreviewResponse | null>(null)
  const [status, setStatus] = useState<{
    importJobId: number
    status: string
    totalRows: number
    processedRows: number
    importedRows: number
    skippedRows: number
    failedRows: number
    percentComplete: number | null
    etaMinutesRounded: number | null
  } | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
  const [duplicateResolutions, setDuplicateResolutions] = useState<ImportDuplicateResolution[]>([])
  const [overrideAllDuplicates, setOverrideAllDuplicates] = useState(false)
  const [headerWarningAcknowledged, setHeaderWarningAcknowledged] = useState(false)

  const duplicateRows: ImportPreviewRow[] = useMemo(() => {
    return (
      preview?.monthRows.flatMap((row) =>
        row.generatedRides
          .filter((ride) => ride.isDuplicate)
          .map((ride) => ({
            rowNumber: ride.rideIndex,
            date: ride.date,
            miles: ride.miles,
            rideMinutes: null,
            temperature: null,
            tags: null,
            notes: row.rawMonth ?? null,
            isValid: true,
            errors: [],
            duplicateMatches: ride.duplicateMatches,
          })),
      ) ?? []
    )
  }, [preview])

  useEffect(() => {
    if (status?.status !== 'processing') {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshStatus(status.importJobId)
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [status?.importJobId, status?.status])

  async function refreshStatus(importJobId: number): Promise<void> {
    const response = await getMonthlyImportStatus(importJobId)
    if (!response.ok || !response.data) {
      setErrorMessage(response.error?.message ?? 'Unable to load import status.')
      return
    }

    setStatus({
      importJobId: response.data.importJobId,
      status: response.data.status,
      totalRows: response.data.totalRows,
      processedRows: response.data.processedRows,
      importedRows: response.data.importedRows,
      skippedRows: response.data.skippedRows,
      failedRows: response.data.failedRows,
      percentComplete: response.data.percentComplete ?? null,
      etaMinutesRounded: response.data.etaMinutesRounded ?? null,
    })
  }

  async function toBase64(text: string): Promise<string> {
    return window.btoa(unescape(encodeURIComponent(text)))
  }

  async function onPreview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage('')
    setIsPreviewing(true)
    setStatus(null)

    try {
      const parsedYear = Number.parseInt(year, 10)
      if (Number.isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        setErrorMessage('Enter a year between 2000 and 2100.')
        return
      }

      const content = pastedText.trim() !== '' ? pastedText : await selectedFile?.text()
      if (!content) {
        setErrorMessage('Enter monthly summary text or choose a file.')
        return
      }

      const bytes = new TextEncoder().encode(content)
      if (bytes.length > MAX_UPLOAD_BYTES) {
        setErrorMessage('Monthly summary file must be 5 MB or smaller.')
        return
      }

      const response = await previewMonthlyImport({
        fileName: selectedFile?.name ?? 'paste.txt',
        contentBase64: await toBase64(content),
        startYear: parsedYear,
      })

      if (response.ok && response.data) {
        setPreview(response.data)
        setHeaderWarningAcknowledged(false)
        return
      }

      setErrorMessage(response.error?.message ?? 'Unable to preview monthly import.')
    } catch {
      setErrorMessage('Unable to preview monthly import.')
    } finally {
      setIsPreviewing(false)
    }
  }

  async function runStartImport(): Promise<void> {
    if (!preview) {
      return
    }

    setIsStarting(true)
    setErrorMessage('')
    try {
      const response = await startMonthlyImport({
        importJobId: preview.importJobId,
        overrideAllDuplicates,
        resolutions: duplicateResolutions,
      })
      if (!response.ok || !response.data) {
        setErrorMessage(response.error?.message ?? 'Unable to start import.')
        return
      }

      setIsDuplicateDialogOpen(false)
      await refreshStatus(response.data.importJobId)
    } catch {
      setErrorMessage('Unable to start import.')
    } finally {
      setIsStarting(false)
    }
  }

  async function onCancelImport(): Promise<void> {
    if (!status) {
      return
    }

    setIsCancelling(true)
    try {
      await cancelMonthlyImport(status.importJobId)
      setStatus((current) => (current ? { ...current, status: 'cancelled' } : current))
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <main className="monthly-import-page">
      <section className="monthly-import-card">
        <h1>Monthly Summary Import</h1>
        <p>Paste or upload Month / Miles / Days rows, choose a year, then preview generated rides.</p>

        <form onSubmit={onPreview}>
          <label htmlFor="monthly-import-textarea">Monthly summary input</label>
          <textarea
            id="monthly-import-textarea"
            rows={8}
            value={pastedText}
            onChange={(event) => {
              setPastedText(event.target.value)
              setSelectedFile(null)
            }}
          />

          <label htmlFor="monthly-import-file">Or choose a file</label>
          <input
            id="monthly-import-file"
            type="file"
            accept=".txt,.tsv,.csv,text/plain,text/tab-separated-values"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null)
              setPastedText('')
            }}
          />

          <MonthlyYearSelector value={year} onChange={setYear} />

          {errorMessage ? <p role="alert">{errorMessage}</p> : null}

          <button type="submit" disabled={isPreviewing}>
            {isPreviewing ? 'Previewing...' : 'Preview import'}
          </button>
        </form>

        {preview ? (
          <>
            <MonthlyPreviewTable rows={preview.monthRows} headerDetectionWarning={preview.headerDetectionWarning} />
            <div>
              <p>Total generated rides: {preview.totalGeneratedRides}</p>
              <p>Duplicate rides: {preview.duplicateRides}</p>
            </div>
            {preview.headerDetectionWarning && !headerWarningAcknowledged ? (
              <div role="alert">
                <p>
                  Column mapping was detected automatically (Month, Miles, Days). Please confirm
                  the columns are correct before importing.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={headerWarningAcknowledged}
                    onChange={(event) => setHeaderWarningAcknowledged(event.target.checked)}
                  />
                  Confirm column mapping
                </label>
              </div>
            ) : null}
            {preview.invalidMonthRows > 0 ? (
              <p role="alert">
                {preview.invalidMonthRows} row(s) have validation errors. Fix the source data and
                re-preview before confirming import.
              </p>
            ) : null}
            {!status || isTerminalStatus(status.status) ? (
              <button
                type="button"
                disabled={
                  preview.invalidMonthRows > 0 ||
                  (preview.headerDetectionWarning && !headerWarningAcknowledged)
                }
                onClick={() => {
                  if (preview.requiresDuplicateResolution && duplicateRows.length > 0) {
                    setIsDuplicateDialogOpen(true)
                    return
                  }
                  void runStartImport()
                }}
              >
                Start import
              </button>
            ) : null}
          </>
        ) : null}

        {status?.status === 'completed' ? (
          <MonthlyImportSummaryPanel
            monthsProcessed={preview?.totalMonthRows ?? 0}
            ridesCreated={status.importedRows}
            ridesReplaced={0}
            ridesSkipped={status.skippedRows}
            rowsRejected={status.failedRows}
          />
        ) : status ? (
          <ImportProgressPanel
            status={status.status}
            percentComplete={status.percentComplete}
            etaMinutesRounded={status.etaMinutesRounded}
            importedRows={status.importedRows}
            skippedRows={status.skippedRows}
            failedRows={status.failedRows}
            isCancelling={isCancelling}
            onCancel={() => void onCancelImport()}
          />
        ) : null}

        <p>
          <Link to="/rides/import">Back to ride imports</Link>
        </p>
      </section>

      <DuplicateResolutionDialog
        isOpen={isDuplicateDialogOpen}
        duplicateRows={duplicateRows}
        overrideAllDuplicates={overrideAllDuplicates}
        resolutions={duplicateResolutions}
        isSubmitting={isStarting}
        onClose={() => setIsDuplicateDialogOpen(false)}
        onConfirm={() => void runStartImport()}
        onOverrideAllDuplicatesChange={setOverrideAllDuplicates}
        onResolutionChange={(rowNumber, action) => {
          setDuplicateResolutions((current) => {
            const next = current.filter((entry) => entry.rowNumber !== rowNumber)
            next.push({ rowNumber, action })
            return next.sort((left, right) => left.rowNumber - right.rowNumber)
          })
        }}
      />
    </main>
  )
}
