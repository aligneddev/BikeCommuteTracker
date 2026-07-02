import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../ui/chart'
import type { DashboardMileagePoint, DashboardSavingsPoint } from '../../services/dashboard-api'

interface DashboardChartSectionProps {
  mileageByMonth: DashboardMileagePoint[]
  savingsByMonth: DashboardSavingsPoint[]
  /** Optional label rendered instead of the default "Rolling 12 months" copy (e.g. "Calendar year 2025"). */
  seriesLabel?: string
}

const mileageConfig: ChartConfig = {
  miles: {
    label: 'Miles',
    color: '#1d4ed8',
  },
}

const savingsConfig: ChartConfig = {
  mileageRateSavings: {
    label: 'Mileage rate',
    color: '#0f766e',
  },
  fuelCostAvoided: {
    label: 'Fuel cost avoided',
    color: '#ca8a04',
  },
}

function formatCurrency(value: number | string | null | undefined): string {
  if (typeof value !== 'number') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function DashboardChartSection({
  mileageByMonth,
  savingsByMonth,
  seriesLabel = 'Rolling 12 months',
}: DashboardChartSectionProps) {
  return (
    <section className="dashboard-chart-grid" aria-label="Dashboard charts">
      <article className="dashboard-chart-card">
        <div className="dashboard-chart-card-header">
          <div>
            <p className="dashboard-chart-overline">Trend</p>
            <h2>Miles by Month</h2>
          </div>
          <p>{seriesLabel}</p>
        </div>

        <ChartContainer config={mileageConfig} height={260} ariaLabel="Mileage by month chart">
          <AreaChart data={mileageByMonth} margin={{ left: 8, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="dashboardMilesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d7e3f1" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent config={mileageConfig} />} />
            <Area
              type="monotone"
              dataKey="miles"
              stroke="#1d4ed8"
              fill="url(#dashboardMilesFill)"
              strokeWidth={3}
            />
          </AreaChart>
        </ChartContainer>
      </article>

      <article className="dashboard-chart-card">
        <div className="dashboard-chart-card-header">
          <div>
            <p className="dashboard-chart-overline">Savings</p>
            <h2>Savings by Month</h2>
          </div>
          <p>{seriesLabel}</p>
        </div>

        <ChartContainer config={savingsConfig} height={260} ariaLabel="Savings by month chart">
          <BarChart data={savingsByMonth} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid stroke="#d7e3f1" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              content={
                <ChartTooltipContent config={savingsConfig} valueFormatter={formatCurrency} />
              }
            />
            <ChartLegend content={<ChartLegendContent config={savingsConfig} />} />
            <Bar dataKey="mileageRateSavings" fill="#0f766e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="fuelCostAvoided" fill="#ca8a04" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </article>
    </section>
  )
}