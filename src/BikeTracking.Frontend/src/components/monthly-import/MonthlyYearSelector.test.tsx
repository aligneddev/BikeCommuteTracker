import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyYearSelector } from './MonthlyYearSelector'

describe('MonthlyYearSelector', () => {
  it('renders a number input', () => {
    render(<MonthlyYearSelector value="" onChange={vi.fn()} />)

    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('calls onChange with the entered value', () => {
    const onChange = vi.fn()
    render(<MonthlyYearSelector value="" onChange={onChange} />)

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2025' } })

    expect(onChange).toHaveBeenLastCalledWith('2025')
  })

  it('is disabled when disabled prop is true', () => {
    render(<MonthlyYearSelector value="2025" onChange={vi.fn()} disabled />)

    expect(screen.getByRole('spinbutton')).toBeDisabled()
  })

  it('reflects the min and max year range', () => {
    render(<MonthlyYearSelector value="2025" onChange={vi.fn()} />)

    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('min', '2000')
    expect(input).toHaveAttribute('max', '2100')
  })
})
