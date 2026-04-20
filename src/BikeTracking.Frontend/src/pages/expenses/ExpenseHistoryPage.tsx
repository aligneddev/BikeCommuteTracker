import { useEffect, useState } from 'react'
import type { ExpenseHistoryRow } from '../../services/expenses-api'
import {
  deleteExpense,
  downloadExpenseReceipt,
  editExpense,
  getExpenseReceiptUrl,
  getExpenseHistory,
} from '../../services/expenses-api'
import { formatCurrency, formatExpenseDate } from './expense-page.helpers'
import './ExpenseHistoryPage.css'

export function ExpenseHistoryPage() {
  const [expenses, setExpenses] = useState<ExpenseHistoryRow[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [filteredTotal, setFilteredTotal] = useState<number>(0)
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')
  const [filterApplied, setFilterApplied] = useState<boolean>(false)

  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null)
  const [editDate, setEditDate] = useState<string>('')
  const [editAmount, setEditAmount] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')

  const [errorMessage, setErrorMessage] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')

  const loadHistory = async (startDate?: string, endDate?: string) => {
    const result = await getExpenseHistory(startDate, endDate)
    if (result?.ok && result.data) {
      setExpenses(result.data.expenses)
      setTotalAmount(result.data.totalAmount)
      setFilteredTotal(result.data.totalAmount)
    } else {
      setExpenses([])
      setTotalAmount(0)
      setFilteredTotal(0)
    }
  }

  useEffect(() => {
    const init = async () => {
      const result = await getExpenseHistory()
      if (result?.ok && result.data) {
        setExpenses(result.data.expenses)
        setTotalAmount(result.data.totalAmount)
        setFilteredTotal(result.data.totalAmount)
      }
    }
    init()
  }, [])

  const handleApplyFilter = () => {
    setFilterApplied(true)
    loadHistory(filterFrom || undefined, filterTo || undefined)
  }

  const handleStartEdit = (expense: ExpenseHistoryRow) => {
    setEditingExpenseId(expense.expenseId)
    setEditDate(expense.expenseDate.slice(0, 10))
    setEditAmount(String(expense.amount))
    setEditNotes(expense.notes ?? '')
    setErrorMessage('')
  }

  const handleCancelEdit = () => {
    setEditingExpenseId(null)
    setErrorMessage('')
  }

  const handleSaveEdit = async (expense: ExpenseHistoryRow) => {
    const parsedAmount = Number.parseFloat(editAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Amount must be greater than zero')
      return
    }

    const result = await editExpense(expense.expenseId, {
      expenseDate: editDate,
      amount: parsedAmount,
      notes: editNotes.trim() || undefined,
      expectedVersion: expense.version,
    })

    if (result.ok) {
      setEditingExpenseId(null)
      setSuccessMessage('Expense updated')
      await loadHistory(filterFrom || undefined, filterTo || undefined)
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setErrorMessage(result.error?.message ?? 'Failed to update expense')
    }
  }

  const handleDelete = async (expense: ExpenseHistoryRow) => {
    const result = await deleteExpense(expense.expenseId)
    if (result.ok) {
      await loadHistory(filterFrom || undefined, filterTo || undefined)
      setSuccessMessage('Expense deleted')
      setTimeout(() => setSuccessMessage(''), 3000)
    } else {
      setErrorMessage(result.error?.message ?? 'Failed to delete expense')
    }
  }

  const handleDownloadReceipt = async (expense: ExpenseHistoryRow) => {
    const result = await downloadExpenseReceipt(expense.expenseId)
    if (!result.ok) {
      setErrorMessage(result.error?.message ?? 'Failed to download receipt')
    }
  }

  return (
    <main className="expense-history-page">
      <h1 className="expense-history-title">Expense History</h1>

      <div className="expense-history-filters" role="group" aria-label="Expense history filters">
        <label htmlFor="expense-filter-from">From</label>
        <input
          id="expense-filter-from"
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
        />
        <label htmlFor="expense-filter-to">To</label>
        <input
          id="expense-filter-to"
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
        />
        <button type="button" onClick={handleApplyFilter}>
          Apply Filter
        </button>
      </div>

      <p className="expense-history-total" id="expense-history-total" role="status" aria-live="polite">
        {filterApplied ? (
          <>Filtered total: {formatCurrency(filteredTotal)}</>
        ) : (
          <>Total: {formatCurrency(totalAmount)}</>
        )}
      </p>

      {errorMessage ? <p role="alert" aria-live="assertive" className="expense-history-error">{errorMessage}</p> : null}
      {successMessage ? <p role="status" aria-live="polite" className="expense-history-success">{successMessage}</p> : null}

      <div className="expense-history-table-wrap">
        <table className="expense-history-table" aria-label="Expense history table" aria-describedby="expense-history-total">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Amount</th>
              <th scope="col">Notes</th>
              <th scope="col">Receipt</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.expenseId}>
                <td>
                  {editingExpenseId === expense.expenseId ? (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      aria-label="Edit date"
                    />
                  ) : (
                    formatExpenseDate(expense.expenseDate)
                  )}
                </td>
                <td>
                  {editingExpenseId === expense.expenseId ? (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      aria-label="Edit amount"
                    />
                  ) : (
                    formatCurrency(expense.amount)
                  )}
                </td>
                <td>
                  {editingExpenseId === expense.expenseId ? (
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      aria-label="Edit notes"
                      className="expense-history-edit-notes"
                      maxLength={500}
                    />
                  ) : (
                    expense.notes ?? ''
                  )}
                </td>
                <td>
                  {expense.hasReceipt ? (
                    <div className="expense-history-receipt-links">
                      <a
                        href={getExpenseReceiptUrl(expense.expenseId)}
                        target="_blank"
                        rel="noreferrer"
                        className="expense-history-receipt-link"
                      >
                        View receipt
                      </a>
                      <button
                        type="button"
                        className="expense-history-receipt-link"
                        onClick={() => handleDownloadReceipt(expense)}
                      >
                        Download receipt
                      </button>
                    </div>
                  ) : (
                    'No'
                  )}
                </td>
                <td className="expense-history-actions">
                  {editingExpenseId === expense.expenseId ? (
                    <>
                      <button type="button" onClick={() => handleSaveEdit(expense)}>
                        Save
                      </button>
                      <button type="button" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label="Edit expense"
                        onClick={() => handleStartEdit(expense)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label="Delete expense"
                        onClick={() => handleDelete(expense)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expenses.length === 0 ? (
        <p className="expense-history-empty">No expenses found.</p>
      ) : null}
    </main>
  )
}
