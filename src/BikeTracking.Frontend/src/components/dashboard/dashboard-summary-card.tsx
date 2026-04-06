import type { ReactNode } from 'react'

interface DashboardSummaryCardProps {
  title: string
  value: string
  detail: string
  accentClassName: string
  eyebrow?: string
  children?: ReactNode
}

export function DashboardSummaryCard({
  title,
  value,
  detail,
  accentClassName,
  eyebrow,
  children,
}: DashboardSummaryCardProps) {
  return (
    <article className="dashboard-summary-card">
      <div className="dashboard-summary-card-header">
        <span className={`dashboard-summary-card-accent ${accentClassName}`} aria-hidden="true" />
        <div>
          {eyebrow ? <p className="dashboard-summary-card-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
      </div>

      <p className="dashboard-summary-card-value">{value}</p>
      <p className="dashboard-summary-card-detail">{detail}</p>
      {children ? <div className="dashboard-summary-card-extra">{children}</div> : null}
    </article>
  )
}