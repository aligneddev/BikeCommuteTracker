import { BrowserRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('DashboardPage', () => {
  it('renders the baseline dashboard cards and charts', async () => {
    const module = await import('./dashboard-page')
    const DashboardPage = module.DashboardPage

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    )

    expect(screen.getByText(/current month/i)).toBeInTheDocument()
    expect(screen.getByText(/year to date/i)).toBeInTheDocument()
    expect(screen.getByText(/all time/i)).toBeInTheDocument()
  })
})