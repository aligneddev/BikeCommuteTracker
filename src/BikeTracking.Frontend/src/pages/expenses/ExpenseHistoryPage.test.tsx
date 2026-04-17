import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ExpenseHistoryPage } from './ExpenseHistoryPage'

vi.mock('../../services/expenses-api', () => ({
  getExpenseHistory: vi.fn(),
  editExpense: vi.fn(),
  deleteExpense: vi.fn(),
  uploadReceipt: vi.fn(),
  deleteReceipt: vi.fn(),
}))

describe('ExpenseHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    render(
      <BrowserRouter>
        <ExpenseHistoryPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit expense/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete expense/i })).toBeInTheDocument()
    })
  })
})
