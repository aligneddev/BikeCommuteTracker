import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ExpenseHistoryPage } from './ExpenseHistoryPage'

vi.mock('../../services/expenses-api', () => ({
  getExpenseHistory: vi.fn(),
  editExpense: vi.fn(),
  deleteExpense: vi.fn(),
  downloadExpenseReceipt: vi.fn(),
  uploadReceipt: vi.fn(),
  deleteReceipt: vi.fn(),
  getExpenseReceiptUrl: vi.fn((expenseId: number) => `http://localhost:5436/api/expenses/${expenseId}/receipt?userId=1`),
}))

import * as expensesApi from '../../services/expenses-api'

const mockGetExpenseHistory = vi.mocked(expensesApi.getExpenseHistory)
const mockDownloadExpenseReceipt = vi.mocked(expensesApi.downloadExpenseReceipt)

const SAMPLE_EXPENSE = {
  expenseId: 1,
  expenseDate: '2026-04-17',
  amount: 23.45,
  notes: 'Chain lube',
  hasReceipt: true,
  version: 1,
  createdAtUtc: '2026-04-17T10:00:00Z',
}

const EMPTY_RESPONSE = {
  ok: true as const,
  status: 200,
  data: { expenses: [], totalAmount: 0, expenseCount: 0, generatedAtUtc: '2026-04-17T10:00:00Z' },
}

const ONE_EXPENSE_RESPONSE = {
  ok: true as const,
  status: 200,
  data: {
    expenses: [SAMPLE_EXPENSE],
    totalAmount: 23.45,
    expenseCount: 1,
    generatedAtUtc: '2026-04-17T10:00:00Z',
  },
}

describe('ExpenseHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExpenseHistory.mockResolvedValue(EMPTY_RESPONSE)
    mockDownloadExpenseReceipt.mockResolvedValue({
      ok: true,
      status: 200,
      data: { fileName: 'expense-1-receipt.jpg' },
    })
  })

  it('renders list rows from expense history', async () => {
    render(
      <BrowserRouter>
        <ExpenseHistoryPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('table', { name: /expense history table/i })).toBeInTheDocument()
      expect(screen.getByText(/expense history/i)).toBeInTheDocument()
    })
  })

  it('applies date range filter', async () => {
    render(
      <BrowserRouter>
        <ExpenseHistoryPage />
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText(/^From$/i), {
      target: { value: '2026-04-01' },
    })
    fireEvent.change(screen.getByLabelText(/^To$/i), {
      target: { value: '2026-04-30' },
    })
    fireEvent.click(screen.getByRole('button', { name: /apply filter/i }))

    await waitFor(() => {
      expect(screen.getByText(/filtered total/i)).toBeInTheDocument()
    })
  })

  it('supports inline edit and delete actions', async () => {
    mockGetExpenseHistory.mockResolvedValue(ONE_EXPENSE_RESPONSE)

    render(
      <BrowserRouter>
        <ExpenseHistoryPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit expense/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete expense/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /edit expense/i }))

    const notesInput = screen.getByLabelText(/edit notes/i)
    expect(notesInput.tagName).toBe('TEXTAREA')
    expect(notesInput).toHaveClass('expense-history-edit-notes')
  })

  it('renders receipt view and download links when a receipt exists', async () => {
    mockGetExpenseHistory.mockResolvedValue(ONE_EXPENSE_RESPONSE)

    render(
      <BrowserRouter>
        <ExpenseHistoryPage />
      </BrowserRouter>
    )

    const viewLink = await screen.findByRole('link', { name: /view receipt/i })
    const downloadLink = await screen.findByRole('button', { name: /download receipt/i })

    expect(viewLink).toHaveAttribute(
      'href',
      'http://localhost:5436/api/expenses/1/receipt?userId=1',
    )
    expect(downloadLink.tagName).toBe('BUTTON')

    fireEvent.click(downloadLink)

    expect(mockDownloadExpenseReceipt).toHaveBeenCalledWith(1)
  })
})
