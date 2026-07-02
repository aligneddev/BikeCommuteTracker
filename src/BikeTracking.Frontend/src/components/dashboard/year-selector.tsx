interface YearSelectorProps {
  years: number[]
  selectedYear: number
  onChange: (year: number) => void
}

/**
 * Presentational, accessible year selector. Renders one native <select> option per
 * entry in `years`. Functions correctly even with a single-entry list (e.g. a rider
 * with rides recorded in only one calendar year).
 */
export function YearSelector({ years, selectedYear, onChange }: YearSelectorProps) {
  return (
    <div className="year-selector">
      <label htmlFor="year-selector-input" className="year-selector-label">
        Year
      </label>
      <select
        id="year-selector-input"
        className="year-selector-input"
        value={selectedYear}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}
