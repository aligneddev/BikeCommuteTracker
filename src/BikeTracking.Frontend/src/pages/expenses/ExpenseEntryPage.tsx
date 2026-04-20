import { useState } from 'react'
import { recordExpense } from '../../services/expenses-api'
import './ExpenseEntryPage.css'

const MAX_NOTE_LENGTH = 500
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024
const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ALLOWED_RECEIPT_FORMATS_MESSAGE =
  'Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.'

export function ExpenseEntryPage() {
  const [expenseDate, setExpenseDate] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [receipt, setReceipt] = useState<File | null>(null)

  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [receiptError, setReceiptError] = useState<string>('')
  const [receiptWarning, setReceiptWarning] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const validate = (): boolean => {
    const validationErrors: string[] = []

    if (!expenseDate) {
      validationErrors.push('Expense date is required')
    }

    const parsedAmount = Number.parseFloat(amount)
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      validationErrors.push('Amount must be greater than zero')
    }

    if (note.length > MAX_NOTE_LENGTH) {
      validationErrors.push('Note must be 500 characters or fewer')
    }

    setErrorMessages(validationErrors)
    return validationErrors.length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessages([])
    setReceiptWarning('')
    setSuccessMessage('')

    if (!validate()) {
      return
    }

    const formData = new FormData()
    formData.append('expenseDate', expenseDate)
    formData.append('amount', amount)

    if (note.trim().length > 0) {
      formData.append('notes', note.trim())
    }

    if (receipt) {
      formData.append('receipt', receipt)
    }

    setIsSubmitting(true)
    try {
      const result = await recordExpense(formData)
      if (!result.ok) {
        setErrorMessages([result.error?.message ?? 'Failed to record expense'])
        return
      }

      if (result.data?.receiptError) {
        setReceiptWarning(result.data.receiptError)
      }
      setSuccessMessage('Expense recorded successfully')
    } catch (error) {
      setErrorMessages([
        error instanceof Error ? error.message : 'Failed to record expense',
      ])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="expense-entry-page">
      <h1 className="expense-entry-title">Record Expense</h1>
      <form
        className="expense-entry-form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Expense entry form"
      >
        <div className="expense-entry-field">
          <label htmlFor="expense-date">Expense Date</label>
          <input
            id="expense-date"
            name="expenseDate"
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            required
          />
        </div>

        <div className="expense-entry-field">
          <label htmlFor="expense-amount">Amount</label>
          <input
            id="expense-amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div className="expense-entry-field">
          <label htmlFor="expense-note">Note</label>
          <textarea
            id="expense-note"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_NOTE_LENGTH}
          />
        </div>

        <div className="expense-entry-field">
          <label htmlFor="expense-receipt">Receipt</label>
          <input
            id="expense-receipt"
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-describedby={receiptError ? 'receipt-error' : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              if (file) {
                if (
                  !ALLOWED_RECEIPT_TYPES.includes(file.type) ||
                  file.size > MAX_RECEIPT_BYTES
                ) {
                  setReceiptError(ALLOWED_RECEIPT_FORMATS_MESSAGE)
                  setReceipt(null)
                  event.target.value = ''
                  return
                }
              }
              setReceiptError('')
              setReceipt(file)
            }}
          />
          {receiptError ? (
            <p
              id="receipt-error"
              className="expense-entry-error"
              role="alert"
              aria-live="assertive"
            >
              {receiptError}
            </p>
          ) : null}
        </div>

        <button
          className="expense-entry-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Recording Expense...' : 'Record Expense'}
        </button>
      </form>

      {errorMessages.map((message) => (
        <p key={message} className="expense-entry-error" role="alert" aria-live="assertive">
          {message}
        </p>
      ))}
      {receiptWarning ? (
        <p className="expense-entry-warning" role="status" aria-live="polite">
          {receiptWarning}
        </p>
      ) : null}
      {successMessage ? (
        <p className="expense-entry-success" role="status" aria-live="polite">
          {successMessage}
        </p>
      ) : null}
    </main>
  )
}
