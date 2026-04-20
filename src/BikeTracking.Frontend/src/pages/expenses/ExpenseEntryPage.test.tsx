import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ExpenseEntryPage } from './ExpenseEntryPage'

vi.mock('../../services/expenses-api', () => ({
  recordExpense: vi.fn(),
}))

import * as expensesApi from '../../services/expenses-api'

const mockRecordExpense = vi.mocked(expensesApi.recordExpense)

describe('ExpenseEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders expense entry form fields', () => {
    render(
      <BrowserRouter>
        <ExpenseEntryPage />
      </BrowserRouter>
    )

    expect(screen.getByLabelText(/expense date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/note/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/receipt/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /record expense/i })
    ).toBeInTheDocument()
  })

  it('shows validation errors for missing date and non-positive amount', async () => {
    render(
      <BrowserRouter>
        <ExpenseEntryPage />
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: '0' },
    })

    fireEvent.click(screen.getByRole('button', { name: /record expense/i }))

    await waitFor(() => {
      expect(screen.getByText(/expense date is required/i)).toBeInTheDocument()
      expect(screen.getByText(/amount must be greater than zero/i)).toBeInTheDocument()
    })

    expect(mockRecordExpense).not.toHaveBeenCalled()
  })

  it('submits valid form data via recordExpense', async () => {
    mockRecordExpense.mockResolvedValue({
      ok: true,
      value: {
        expenseId: 12,
        riderId: 1,
        savedAtUtc: '2026-04-17T12:00:00Z',
        receiptAttached: false,
      },
    })

    render(
      <BrowserRouter>
        <ExpenseEntryPage />
      </BrowserRouter>
    )

    fireEvent.change(screen.getByLabelText(/expense date/i), {
      target: { value: '2026-04-17' },
    })
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: '23.45' },
    })
    fireEvent.change(screen.getByLabelText(/note/i), {
      target: { value: 'Chain lube and cleaner' },
    })

    fireEvent.click(screen.getByRole('button', { name: /record expense/i }))

    await waitFor(() => {
      expect(mockRecordExpense).toHaveBeenCalledTimes(1)
    })

    const firstCall = mockRecordExpense.mock.calls[0]
    expect(firstCall).toBeDefined()
    expect(firstCall[0]).toBeInstanceOf(FormData)
  })
})
