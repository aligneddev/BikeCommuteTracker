import { useEffect, useState } from 'react'
import {
  getAvailableYears,
  getYearStatsDashboard,
  type YearStatsDashboardResponse,
} from '../../services/dashboard-api'
import { YearSelector } from '../../components/dashboard/year-selector'
import { DashboardChartSection } from '../../components/dashboard/dashboard-chart-section'
import { DifficultyAnalyticsSection } from '../advanced-dashboard/DifficultyAnalyticsSection'
import type { AdvancedDashboardDifficultySection } from '../../services/advanced-dashboard-api'
import './year-stats-dashboard-page.css'

function pickDefaultYear(years: number[]): number {
  const currentYear = new Date().getFullYear()
  if (years.includes(currentYear)) {
    return currentYear
  }

  return years.length > 0 ? Math.max(...years) : currentYear
}

function adaptDifficultySection(
  data: YearStatsDashboardResponse
): AdvancedDashboardDifficultySection {
  return {
    isEmpty: !data.difficulty.hasData && !data.windResistance.hasData,
    overallAverageDifficulty: data.difficulty.overallAverageDifficulty,
    difficultyByMonth: data.difficulty.byMonth.map((point) => ({
      monthNumber: Number(point.monthKey.slice(5, 7)),
      monthName: point.label,
      averageDifficulty: point.averageDifficulty,
      rideCount: 0,
    })),
    mostDifficultMonths: data.difficulty.mostDifficultMonths.map((point) => ({
      monthNumber: Number(point.monthKey.slice(5, 7)),
      monthName: point.label,
      averageDifficulty: point.averageDifficulty,
      rideCount: 0,
    })),
    windResistanceDistribution: data.windResistance.bins.map((bin, index) => ({
      rating: index,
      rideCount: bin.count,
      label: bin.label,
      isAssisted: bin.label.includes('tailwind'),
    })),
  }
}

export function YearStatsDashboardPage() {
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [data, setData] = useState<YearStatsDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadYears(): Promise<void> {
      try {
        const response = await getAvailableYears()
        if (isMounted) {
          setYears(response.years)
          setSelectedYear(pickDefaultYear(response.years))
        }
      } catch {
        if (isMounted) {
          setError('Could not load available years.')
          setLoading(false)
        }
      }
    }

    void loadYears()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (selectedYear === null) {
      return
    }

    let isMounted = true

    async function loadYearStats(): Promise<void> {
      setLoading(true)
      try {
        const response = await getYearStatsDashboard(selectedYear as number)
        if (isMounted) {
          setData(response)
          setError('')
        }
      } catch {
        if (isMounted) {
          setError('Could not load year stats dashboard data.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadYearStats()

    return () => {
      isMounted = false
    }
  }, [selectedYear])

  return (
    <main className="year-stats-dashboard-page">
      <section className="year-stats-dashboard-hero">
        <div>
          <p className="year-stats-dashboard-kicker">Year stats</p>
          <h1>Pick a year, see the whole story.</h1>
          <p className="year-stats-dashboard-intro">
            Mileage, savings, and ride difficulty for exactly the calendar year you choose.
          </p>
        </div>

        {years.length > 0 && selectedYear !== null ? (
          <YearSelector
            years={years}
            selectedYear={selectedYear}
            onChange={(year) => setSelectedYear(year)}
          />
        ) : null}
      </section>

      {error ? (
        <p className="year-stats-dashboard-banner" role="alert">
          {error}
        </p>
      ) : null}

      {data && !data.hasDataForYear ? (
        <p
          className="year-stats-dashboard-empty-state"
          role="status"
          aria-live="polite"
        >
          No ride data for {data.year}.
        </p>
      ) : null}

      {data && data.hasDataForYear ? (
        <>
          <DashboardChartSection
            mileageByMonth={data.mileageByMonth}
            savingsByMonth={data.savingsByMonth}
            seriesLabel={`Calendar year ${data.year}`}
          />

          <DifficultyAnalyticsSection section={adaptDifficultySection(data)} />
        </>
      ) : null}

      {loading ? <p className="year-stats-dashboard-loading">Loading year stats…</p> : null}
    </main>
  )
}
