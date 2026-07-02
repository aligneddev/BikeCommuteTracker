interface MonthlyYearSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function MonthlyYearSelector({ value, onChange, disabled = false }: MonthlyYearSelectorProps) {
  return (
    <label>
      Start year
      <input
        type="number"
        min={2000}
        max={2100}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
