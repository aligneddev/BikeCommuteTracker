import type { AdvancedSavingsWindow } from '../../services/advanced-dashboard-api'

interface SavingsWindowsTableProps {
  weekly: AdvancedSavingsWindow
  monthly: AdvancedSavingsWindow
  yearly: AdvancedSavingsWindow
  allTime: AdvancedSavingsWindow
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatGallons(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(2)} gal`
}

function formatMiles(value: number): string {
  return `${value.toFixed(1)} mi`
}

const WINDOW_LABELS: Record<string, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  yearly: 'This Year',
  allTime: 'All Time',
}

interface WindowRowProps {
  window: AdvancedSavingsWindow
}

function WindowRow({ window: w }: WindowRowProps) {
  return (
    <tr className="savings-windows-row">
      <td className="savings-windows-cell savings-windows-period">
        {WINDOW_LABELS[w.period] ?? w.period}
      </td>
      <td className="savings-windows-cell">{w.rideCount}</td>
      <td className="savings-windows-cell">{formatMiles(w.totalMiles)}</td>
      <td className="savings-windows-cell">{formatGallons(w.gallonsSaved)}</td>
      <td className="savings-windows-cell">
        {formatCurrency(w.fuelCostAvoided)}
        {w.fuelCostEstimated && w.fuelCostAvoided !== null ? (
          <span className="savings-windows-estimated-badge" title="Based on nearest known gas price">
            Est.
          </span>
        ) : null}
      </td>
      <td className="savings-windows-cell">{formatCurrency(w.mileageRateSavings)}</td>
      <td className="savings-windows-cell savings-windows-combined">
        {formatCurrency(w.combinedSavings)}
      </td>
    </tr>
  )
}

export function SavingsWindowsTable({
  weekly,
  monthly,
  yearly,
  allTime,
}: SavingsWindowsTableProps) {
  return (
    <div className="savings-windows-table-wrap">
      <table className="savings-windows-table">
        <thead>
          <tr>
            <th className="savings-windows-cell savings-windows-header">Period</th>
            <th className="savings-windows-cell savings-windows-header">Rides</th>
            <th className="savings-windows-cell savings-windows-header">Miles</th>
            <th className="savings-windows-cell savings-windows-header">Gallons Saved</th>
            <th className="savings-windows-cell savings-windows-header">Fuel Cost Avoided</th>
            <th className="savings-windows-cell savings-windows-header">Mileage Rate</th>
            <th className="savings-windows-cell savings-windows-header">Combined Savings</th>
          </tr>
        </thead>
        <tbody>
          <WindowRow window={weekly} />
          <WindowRow window={monthly} />
          <WindowRow window={yearly} />
          <WindowRow window={allTime} />
        </tbody>
      </table>
    </div>
  )
}
