import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('YearSelector', () => {
  it('renders one option per entry in years prop', async () => {
    const { YearSelector } = await import('./year-selector')

    render(<YearSelector years={[2025, 2024, 2023]} selectedYear={2025} onChange={() => {}} />)

    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('renders selectedYear as the selected option', async () => {
    const { YearSelector } = await import('./year-selector')

    render(<YearSelector years={[2025, 2024, 2023]} selectedYear={2024} onChange={() => {}} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('2024')
  })

  it('calls onChange with the numeric year when a new option is chosen', async () => {
    const handleChange = vi.fn()
    const { YearSelector } = await import('./year-selector')

    render(<YearSelector years={[2025, 2024, 2023]} selectedYear={2025} onChange={handleChange} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '2023' } })

    expect(handleChange).toHaveBeenCalledWith(2023)
  })

  it('renders correctly with a single-year list', async () => {
    const { YearSelector } = await import('./year-selector')

    render(<YearSelector years={[2025]} selectedYear={2025} onChange={() => {}} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(select.value).toBe('2025')
  })
})
