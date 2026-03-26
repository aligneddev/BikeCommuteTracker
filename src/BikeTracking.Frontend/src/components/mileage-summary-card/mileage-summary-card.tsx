import type { MileageSummary } from '../../services/ridesService'
import { formatMiles, formatRideCount } from '../../pages/miles/history-page.helpers'
import './mileage-summary-card.css'

interface MileageSummaryCardProps {
  title: string
  summary: MileageSummary
}

export function MileageSummaryCard({ title, summary }: MileageSummaryCardProps) {
  return (
    <article className="mileage-summary-card" aria-label={`${title} summary`}>
      <div className="mileage-summary-card__header">
        <span
          className={`mileage-summary-card__indicator mileage-summary-card__indicator--${summary.period}`}
          aria-hidden="true"
        />
        <h2>{title}</h2>
      </div>
      <p className="mileage-summary-card__miles">{formatMiles(summary.miles)}</p>
      <p className="mileage-summary-card__count">{formatRideCount(summary.rideCount)}</p>
    </article>
  )
}
