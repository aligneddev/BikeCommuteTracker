import type { MileageSummary } from '../../services/ridesService'
import { formatMiles, formatRideCount } from '../../pages/miles/history-page.helpers'
import './mileage-summary-card.css'

interface MileageSummaryCardProps {
  title: string
  summary: MileageSummary
}

function indicatorClassForPeriod(period: MileageSummary['period']): string {
  switch (period) {
    case 'thisMonth':
      return 'mileage-summary-indicator-this-month'
    case 'thisYear':
      return 'mileage-summary-indicator-this-year'
    case 'allTime':
      return 'mileage-summary-indicator-all-time'
    default:
      return 'mileage-summary-indicator-filtered'
  }
}

export function MileageSummaryCard({ title, summary }: MileageSummaryCardProps) {
  return (
    <article className="mileage-summary-card" aria-label={`${title} summary`}>
      <div className="mileage-summary-header">
        <span
          className={`mileage-summary-indicator ${indicatorClassForPeriod(summary.period)}`}
          aria-hidden="true"
        />
        <h2>{title}</h2>
      </div>
      <p className="mileage-summary-miles">{formatMiles(summary.miles)}</p>
      <p className="mileage-summary-count">{formatRideCount(summary.rideCount)}</p>
    </article>
  )
}
