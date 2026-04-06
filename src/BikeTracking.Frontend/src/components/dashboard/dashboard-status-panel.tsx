import type { DashboardMissingData, DashboardMetricSuggestion } from '../../services/dashboard-api'

interface DashboardStatusPanelProps {
  missingData: DashboardMissingData
  suggestions: DashboardMetricSuggestion[]
  hasRides: boolean
}

function buildMissingDataMessages(missingData: DashboardMissingData): string[] {
  const messages: string[] = []

  if (missingData.ridesMissingSavingsSnapshot > 0) {
    messages.push(`${missingData.ridesMissingSavingsSnapshot} rides are missing savings snapshots.`)
  }

  if (missingData.ridesMissingGasPrice > 0) {
    messages.push(`${missingData.ridesMissingGasPrice} rides are missing gas prices.`)
  }

  if (missingData.ridesMissingTemperature > 0) {
    messages.push(`${missingData.ridesMissingTemperature} rides are missing temperatures.`)
  }

  if (missingData.ridesMissingDuration > 0) {
    messages.push(`${missingData.ridesMissingDuration} rides are missing ride durations.`)
  }

  return messages
}

export function DashboardStatusPanel({
  missingData,
  suggestions,
  hasRides,
}: DashboardStatusPanelProps) {
  const missingDataMessages = buildMissingDataMessages(missingData)
  const pendingSuggestions = suggestions.filter((suggestion) => !suggestion.isEnabled)

  if (!hasRides && missingDataMessages.length === 0 && pendingSuggestions.length === 0) {
    return null
  }

  return (
    <section className="dashboard-status-grid" aria-label="Dashboard notes">
      {!hasRides ? (
        <article className="dashboard-status-card dashboard-status-card-empty">
          <p className="dashboard-status-eyebrow">Ready for your first ride</p>
          <h2>No ride history yet</h2>
          <p>
            Record a commute to start building your dashboard totals, averages, and monthly trends.
          </p>
        </article>
      ) : null}

      {missingDataMessages.length > 0 ? (
        <article className="dashboard-status-card">
          <p className="dashboard-status-eyebrow">Partial data</p>
          <h2>Some metrics are still filling in</h2>
          <ul>
            {missingDataMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </article>
      ) : null}

      {pendingSuggestions.length > 0 ? (
        <article className="dashboard-status-card">
          <p className="dashboard-status-eyebrow">Suggestions</p>
          <h2>More metrics are available</h2>
          <ul>
            {pendingSuggestions.map((suggestion) => (
              <li key={suggestion.metricKey}>
                <strong>{suggestion.title}:</strong> {suggestion.description}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  )
}