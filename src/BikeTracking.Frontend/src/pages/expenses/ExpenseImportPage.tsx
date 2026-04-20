import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  confirmExpenseImport,
  deleteExpenseImport,
  previewExpenseImport,
  type ConfirmExpenseImportRequest,
  type ExpenseImportPreviewResponse,
  type ExpenseImportSummaryResponse,
} from '../../services/expense-import-api'
import './ExpenseImportPage.css'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function ExpenseImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [preview, setPreview] = useState<ExpenseImportPreviewResponse | null>(null)
  const [summary, setSummary] = useState<ExpenseImportSummaryResponse | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [overrideAllDuplicates, setOverrideAllDuplicates] = useState(false)
  const [duplicateChoices, setDuplicateChoices] = useState<Record<number, 'keep-existing' | 'replace-with-import'>>({})
  const summaryJobIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (summary === null) {
      return
    }

    summaryJobIdRef.current = summary.jobId

    const handleBeforeUnload = (): void => {
      const jobId = summaryJobIdRef.current
      if (jobId !== null) {
        void deleteExpenseImport(jobId)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      const jobId = summaryJobIdRef.current
      if (jobId !== null) {
        void deleteExpenseImport(jobId)
      }
      summaryJobIdRef.current = null
    }
  }, [summary])

  function onSelectFile(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null
    setPreview(null)
    setSummary(null)
    setDuplicateChoices({})
    setOverrideAllDuplicates(false)
    setErrorMessage('')

    if (file === null) {
      setSelectedFile(null)
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(null)
      setErrorMessage('Please upload a .csv file.')
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null)
      setErrorMessage('CSV file must be 5 MB or smaller.')
      return
    }

    setSelectedFile(file)
  }

  async function onPreview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (selectedFile === null) {
      setErrorMessage('Select a CSV file before previewing import results.')
      return
    }

    setErrorMessage('')
    setIsPreviewing(true)
    try {
      const result = await previewExpenseImport({ file: selectedFile })
      if (result.ok && result.data) {
        setPreview(result.data)
        return
      }

      setErrorMessage(result.error?.message ?? 'Unable to preview this CSV import.')
    } finally {
      setIsPreviewing(false)
    }
  }

  async function onConfirm(): Promise<void> {
    if (preview === null) {
      return
    }

    const request: ConfirmExpenseImportRequest = {
      overrideAllDuplicates: overrideAllDuplicates,
      duplicateChoices: Object.entries(duplicateChoices).map(([rowNumber, resolution]) => ({
        rowNumber: Number.parseInt(rowNumber, 10),
        resolution,
      })),
    }

    setErrorMessage('')
    setIsConfirming(true)
    try {
      const result = await confirmExpenseImport(preview.jobId, request)
      if (result.ok && result.data) {
        setSummary(result.data)
        return
      }

      setErrorMessage(result.error?.message ?? 'Unable to confirm this CSV import.')
    } finally {
      setIsConfirming(false)
    }
  }

  function setDuplicateResolution(
    rowNumber: number,
    resolution: 'keep-existing' | 'replace-with-import',
  ): void {
    setDuplicateChoices((current) => ({ ...current, [rowNumber]: resolution }))
  }

  return (
    <main className="expense-import-page">
      <section className="expense-import-card">
        <h1>Import Expenses</h1>
        <p className="expense-import-description">
          Upload a CSV with Date, Amount, and Note columns to preview and import historical
          expenses.
        </p>
        <p className="expense-import-notice">
          Receipts cannot be imported. To add a receipt, find the expense in your history and use
          the edit option.
        </p>

        <form onSubmit={(event) => void onPreview(event)}>
          <label className="expense-import-file-label" htmlFor="expense-import-file">
            Select CSV file
          </label>
          <input
            id="expense-import-file"
            className="expense-import-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={onSelectFile}
          />
          {selectedFile ? <p className="expense-import-selected-file">Selected: {selectedFile.name}</p> : null}
          <div className="expense-import-actions">
            <button type="submit" disabled={isPreviewing}>
              {isPreviewing ? 'Previewing…' : 'Preview Import'}
            </button>
          </div>
        </form>

        {errorMessage ? (
          <p role="alert" className="expense-import-error">
            {errorMessage}
          </p>
        ) : null}

        {preview ? (
          <section className="expense-import-preview" aria-label="Expense import preview">
            <h2>Preview</h2>
            <p>Total rows: {preview.totalRows}</p>
            <p>Valid rows: {preview.validRows}</p>
            <p>Invalid rows: {preview.invalidRows}</p>
            <p>Duplicate rows: {preview.duplicateCount}</p>

            {preview.errors.length > 0 ? (
              <ul className="expense-import-errors">
                {preview.errors.map((error) => (
                  <li key={`${error.rowNumber}-${error.field}-${error.message}`}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}

            {preview.duplicates.length > 0 ? (
              <section className="expense-import-duplicates">
                <label className="expense-import-override-all">
                  <input
                    type="checkbox"
                    checked={overrideAllDuplicates}
                    onChange={(event) => setOverrideAllDuplicates(event.target.checked)}
                  />
                  Override All Duplicates
                </label>
                <ul>
                  {preview.duplicates.map((duplicate) => (
                    <li key={duplicate.rowNumber} className="expense-import-duplicate-item">
                      <p>
                        Row {duplicate.rowNumber}: {duplicate.expenseDate} · ${duplicate.amount.toFixed(2)}
                      </p>
                      <label>
                        <input
                          type="radio"
                          name={`duplicate-${duplicate.rowNumber}`}
                          checked={duplicateChoices[duplicate.rowNumber] !== 'replace-with-import'}
                          onChange={() => setDuplicateResolution(duplicate.rowNumber, 'keep-existing')}
                        />
                        Keep Existing
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`duplicate-${duplicate.rowNumber}`}
                          checked={duplicateChoices[duplicate.rowNumber] === 'replace-with-import'}
                          onChange={() => setDuplicateResolution(duplicate.rowNumber, 'replace-with-import')}
                        />
                        Replace with Import
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="expense-import-actions">
              <button type="button" onClick={() => void onConfirm()} disabled={!preview.canConfirmImport || isConfirming}>
                {isConfirming ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>
          </section>
        ) : null}

        {summary ? (
          <section className="expense-import-summary">
            <h2>Import complete</h2>
            <p>Imported rows: {summary.importedRows}</p>
            <p>Skipped rows: {summary.skippedRows}</p>
            <p>Failed rows: {summary.failedRows}</p>
            <Link to="/expenses/history">Back to Expense History</Link>
          </section>
        ) : null}
      </section>
    </main>
  )
}