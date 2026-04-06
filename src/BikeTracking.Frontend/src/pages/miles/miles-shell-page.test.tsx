import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { MilesShellPage } from './miles-shell-page'

describe('MilesShellPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects from miles route to dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/miles']}>
        <Routes>
          <Route path="/miles" element={<MilesShellPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument()
  })

  it('replaces browser history when redirecting to dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/miles']}>
        <Routes>
          <Route path="/miles" element={<MilesShellPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument()
  })

  it('does not render legacy miles placeholder content', () => {
    render(
      <MemoryRouter initialEntries={['/miles']}>
        <Routes>
          <Route path="/miles" element={<MilesShellPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByLabelText(/miles content placeholder/i)).not.toBeInTheDocument()
  })
})
