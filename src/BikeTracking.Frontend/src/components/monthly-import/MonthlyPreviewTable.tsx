import type { MonthlyImportMonthRow } from '../../services/monthly-import-api'

interface MonthlyPreviewTableProps {
  rows: readonly MonthlyImportMonthRow[]
  headerDetectionWarning: boolean
}

export function MonthlyPreviewTable({ rows, headerDetectionWarning }: MonthlyPreviewTableProps) {
  if (rows.length === 0) {
    return <p>No month rows found.</p>
  }

  const validRowCount = rows.filter((row) => row.isValid).length
  const invalidRowCount = rows.length - validRowCount

  return (
    <section>
      {headerDetectionWarning ? (
        <p role="alert">Column mapping was detected automatically. Please confirm the columns.</p>
      ) : null}
      <p>
        Valid rows: {validRowCount} / Invalid rows: {invalidRowCount}
      </p>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Year</th>
            <th>Miles</th>
            <th>Days</th>
            <th>Generated rides</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowNumber}>
              <td>{row.rawMonth ?? 'Unknown'}</td>
              <td>{row.year ?? '—'}</td>
              <td>{row.totalMiles ?? '—'}</td>
              <td>{row.days ?? '—'}</td>
              <td>
                {row.generatedRides.length}
                {row.generatedRides.length > 0 ? (
                  <ul>
                    {row.generatedRides.map((ride) => (
                      <li key={ride.rideIndex}>
                        {ride.date}: {ride.miles} mi
                        {ride.isDuplicate ? (
                          <span role="status"> (duplicate)</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </td>
              <td>{row.errors.map((error) => error.message).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
