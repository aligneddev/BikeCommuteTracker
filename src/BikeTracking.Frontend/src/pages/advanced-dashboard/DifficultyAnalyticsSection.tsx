import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../components/ui/chart'
import type {
  AdvancedDashboardDifficultySection,
  DifficultyByMonth,
  WindResistanceBin,
} from '../../services/advanced-dashboard-api'

interface DifficultyAnalyticsSectionProps {
  section: AdvancedDashboardDifficultySection
}

const difficultyMonthConfig: ChartConfig = {
  averageDifficulty: {
    label: 'Avg Difficulty',
    color: '#7c3aed',
  },
}

const windResistanceConfig: ChartConfig = {
  rideCount: {
    label: 'Rides',
    color: '#0f766e',
  },
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Very Hard',
}

export function DifficultyAnalyticsSection({ section }: DifficultyAnalyticsSectionProps) {
  if (section.isEmpty) {
    return (
      <div className="difficulty-empty-state">
        <p>Record rides with travel direction to see difficulty trends.</p>
      </div>
    )
  }

  const monthChartData = section.difficultyByMonth.map((m: DifficultyByMonth) => ({
    label: m.monthName.slice(0, 3),
    averageDifficulty: m.averageDifficulty,
    rideCount: m.rideCount,
  }))

  const windChartData = section.windResistanceDistribution.map((b: WindResistanceBin) => ({
    label: b.rating > 0 ? `+${b.rating}` : b.rating.toString(),
    rideCount: b.rideCount,
    isAssisted: b.isAssisted,
    fullLabel: b.label,
  }))

  return (
    <section className="difficulty-analytics" aria-label="Ride difficulty analytics">
      <h2 className="advanced-dashboard-section-heading">Ride Difficulty</h2>

      {section.overallAverageDifficulty != null ? (
        <div className="difficulty-overall-average">
          <span className="difficulty-average-value">{section.overallAverageDifficulty.toFixed(1)}</span>
          <span className="difficulty-average-label">
            / 5 overall average
            {section.overallAverageDifficulty != null
              ? ` (${DIFFICULTY_LABELS[Math.round(section.overallAverageDifficulty)] ?? ''})`
              : ''}
          </span>
        </div>
      ) : null}

      {monthChartData.length > 0 ? (
        <article className="difficulty-chart-card">
          <h3>Average Difficulty by Month</h3>
          <ChartContainer config={difficultyMonthConfig} height={220} ariaLabel="Average difficulty by month chart">
            <BarChart data={monthChartData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid stroke="#d7e3f1" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent config={difficultyMonthConfig} />} />
              <Bar dataKey="averageDifficulty" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </article>
      ) : null}

      {section.mostDifficultMonths.length > 0 ? (
        <article className="difficulty-ranking-card">
          <h3>Most Difficult Months</h3>
          <ol className="difficulty-month-ranking">
            {section.mostDifficultMonths.map((m: DifficultyByMonth) => (
              <li key={m.monthNumber} className="difficulty-month-row">
                <span className="difficulty-month-name">{m.monthName}</span>
                <span className="difficulty-month-avg"> {m.averageDifficulty.toFixed(1)}</span>
                <span className="difficulty-month-count"> ({m.rideCount} ride{m.rideCount !== 1 ? 's' : ''})</span>
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      <article className="difficulty-chart-card">
        <h3>Wind Resistance Distribution</h3>
        <p className="difficulty-chart-legend">
          <span className="difficulty-legend-tailwind">■ Tailwind (assisted)</span>
          <span className="difficulty-legend-headwind">■ Headwind</span>
        </p>
        <ChartContainer config={windResistanceConfig} height={220} ariaLabel="Wind resistance distribution chart">
          <BarChart data={windChartData} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid stroke="#d7e3f1" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent config={windResistanceConfig} />} />
            <Bar dataKey="rideCount" radius={[6, 6, 0, 0]}>
              {windChartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isAssisted ? '#0d9488' : '#dc2626'}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </article>
    </section>
  )
}
