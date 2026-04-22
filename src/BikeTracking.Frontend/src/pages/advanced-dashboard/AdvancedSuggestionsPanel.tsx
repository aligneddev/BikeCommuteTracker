import type { AdvancedDashboardSuggestion } from '../../services/advanced-dashboard-api'

interface AdvancedSuggestionsPanelProps {
  suggestions: AdvancedDashboardSuggestion[]
}

/**
 * Renders suggestion cards for each enabled suggestion.
 * Returns null when all suggestions are disabled (nothing to show).
 */
export function AdvancedSuggestionsPanel({ suggestions }: AdvancedSuggestionsPanelProps) {
  const enabled = suggestions.filter((s) => s.isEnabled)

  if (enabled.length === 0) return null

  return (
    <section className="advanced-suggestions-panel" aria-label="Personalized suggestions">
      <h2 className="advanced-suggestions-heading">Suggestions</h2>
      <ul className="advanced-suggestions-list">
        {enabled.map((suggestion) => (
          <li key={suggestion.suggestionKey} className="advanced-suggestion-card">
            <p className="advanced-suggestion-title">{suggestion.title}</p>
            <p className="advanced-suggestion-description">{suggestion.description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
