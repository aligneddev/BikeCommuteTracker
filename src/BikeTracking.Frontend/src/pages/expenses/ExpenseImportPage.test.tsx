import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { ExpenseImportPage } from './ExpenseImportPage'

vi.mock('../../services/expense-import-api', () => ({
  previewExpenseImport: vi.fn(),
  confirmExpenseImport: vi.fn(),
  getExpenseImportStatus: vi.fn(),
  deleteExpenseImport: vi.fn(),
}))

import * as expenseImportApi from '../../services/expense-import-api'

const mockPreviewExpenseImport = vi.mocked(expenseImportApi.previewExpenseImport)

describe('ExpenseImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPreviewExpenseImport.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        jobId: 44,
        fileName: 'expenses.csv',
        totalRows: 3,
        validRows: 2,
        invalidRows: 1,
        duplicateCount: 0,
        errors: [{ rowNumber: 2, field: 'Amount', message: 'Amount must be greater than zero.' }],
        duplicates: [],
        canConfirmImport: true,
      },
    })
  })

  it('renders upload controls and receipt exclusion notice', () => {
    render(
      <BrowserRouter>
        <ExpenseImportPage />
      </BrowserRouter>,
    )

    expect(screen.getByRole('heading', { name: /import expenses/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/select csv file/i)).toBeInTheDocument()
    expect(screen.getByText(/receipts cannot be imported/i)).toBeInTheDocument()
  })

  it('shows preview counts and row validation errors after preview', async () => {
    render(
      <BrowserRouter>
        <ExpenseImportPage />
      </BrowserRouter>,
    )

    const file = new File(['Date,Amount,Note\n2026-04-01,12.50,Coffee'], 'expenses.csv', {
      type: 'text/csv',
    })

    fireEvent.change(screen.getByLabelText(/select csv file/i), {
      target: { files: [file] },
    })

    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    await waitFor(() => {
      expect(screen.getByText(/total rows: 3/i)).toBeInTheDocument()
      expect(screen.getByText(/valid rows: 2/i)).toBeInTheDocument()
      expect(screen.getByText(/invalid rows: 1/i)).toBeInTheDocument()
      expect(screen.getByText(/row 2/i)).toBeInTheDocument()
      expect(screen.getByText(/amount must be greater than zero/i)).toBeInTheDocument()
    })
  })
})