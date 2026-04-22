import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdvancedSuggestionsPanel } from './AdvancedSuggestionsPanel'
import type { AdvancedDashboardSuggestion } from '../../services/advanced-dashboard-api'

function buildSuggestions(
  overrides: Partial<AdvancedDashboardSuggestion>[] = []
): AdvancedDashboardSuggestion[] {
  const defaults: AdvancedDashboardSuggestion[] = [
    {
      suggestionKey: 'consistency',
      title: 'Great Consistency!',
      description: "You've biked 3 times this week!",
      isEnabled: false,
    },
    {
      suggestionKey: 'milestone',
      title: 'Savings Milestone',
      description: "You've saved over $50!",
      isEnabled: false,
    },
    {
      suggestionKey: 'comeback',
      title: 'Comeback Ride',
      description: "It's been 10 days — hop back on!",
      isEnabled: false,
    },
  ]

  return defaults.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }))
}

describe('AdvancedSuggestionsPanel', () => {
  it('AdvancedSuggestionsPanel_WithEnabledSuggestions_ShowsCards', () => {
    const suggestions = buildSuggestions([{ isEnabled: true }, { isEnabled: true }])

    render(<AdvancedSuggestionsPanel suggestions={suggestions} />)

    expect(screen.getByText(/great consistency/i)).toBeInTheDocument()
    expect(screen.getByText(/savings milestone/i)).toBeInTheDocument()
  })

  it('AdvancedSuggestionsPanel_DisabledSuggestion_NotRendered', () => {
    const suggestions = buildSuggestions([
      { isEnabled: true },
      { isEnabled: false },
      { isEnabled: false },
    ])

    render(<AdvancedSuggestionsPanel suggestions={suggestions} />)

    expect(screen.getByText(/great consistency/i)).toBeInTheDocument()
    expect(screen.queryByText(/savings milestone/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/comeback ride/i)).not.toBeInTheDocument()
  })

  it('renders nothing when all suggestions are disabled', () => {
    const suggestions = buildSuggestions()

    const { container } = render(<AdvancedSuggestionsPanel suggestions={suggestions} />)

    expect(container.firstChild).toBeNull()
  })
})
