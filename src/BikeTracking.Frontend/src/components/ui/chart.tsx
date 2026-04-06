import * as React from 'react'
import {
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'

type ChartSeriesConfig = {
  label: string
  color?: string
}

export type ChartConfig = Record<string, ChartSeriesConfig>

type CSSVariableStyle = React.CSSProperties & Record<`--chart-${string}`, string>

interface ChartContainerProps {
  config: ChartConfig
  children: React.ReactElement
  className?: string
  height?: number
  ariaLabel?: string
}

interface ChartTooltipPayload {
  dataKey?: string | number
  name?: string
  value?: number | string | null
  color?: string
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string | number
  config: ChartConfig
  hideLabel?: boolean
  valueFormatter?: (value: number | string | null | undefined) => React.ReactNode
}

interface ChartLegendPayload {
  dataKey?: string | number
  color?: string
  value?: string
}

interface ChartLegendContentProps {
  payload?: ChartLegendPayload[]
  config: ChartConfig
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter((value) => Boolean(value)).join(' ')
}

function buildChartStyle(config: ChartConfig): CSSVariableStyle {
  const style = {} as CSSVariableStyle

  for (const [key, value] of Object.entries(config)) {
    if (value.color) {
      style[`--chart-${key}`] = value.color
    }
  }

  return style
}

function getSeriesLabel(
  config: ChartConfig,
  key: string | number | undefined,
  fallback: string | undefined
): string {
  if (typeof key === 'string' && config[key]) {
    return config[key].label
  }

  return fallback ?? (typeof key === 'string' ? key : 'Series')
}

function getSeriesColor(
  config: ChartConfig,
  key: string | number | undefined,
  fallback: string | undefined
): string {
  if (typeof key === 'string' && config[key]?.color) {
    return config[key].color ?? fallback ?? '#3b82f6'
  }

  return fallback ?? '#3b82f6'
}

export function ChartContainer({
  config,
  children,
  className,
  height = 320,
  ariaLabel = 'Chart',
}: ChartContainerProps) {
  return (
    <div
      className={joinClassNames('chart-container', className)}
      style={{
        ...buildChartStyle(config),
        width: '100%',
        height: `${height}px`,
      }}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartTooltip(props: React.ComponentProps<typeof RechartsTooltip>) {
  return <RechartsTooltip {...props} />
}

export function ChartLegend(props: React.ComponentProps<typeof RechartsLegend>) {
  return <RechartsLegend {...props} />
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  hideLabel = false,
  valueFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '0.5rem',
        minWidth: '12rem',
        border: '1px solid #d4dbe5',
        borderRadius: '0.75rem',
        background: '#ffffff',
        padding: '0.75rem',
        boxShadow: '0 10px 30px rgb(15 23 42 / 12%)',
      }}
    >
      {hideLabel ? null : (
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#152238' }}>
          {label}
        </div>
      )}
      <div style={{ display: 'grid', gap: '0.375rem' }}>
        {payload.map((item) => {
          const seriesLabel = getSeriesLabel(config, item.dataKey, item.name)
          const color = getSeriesColor(config, item.dataKey, item.color)

          return (
            <div
              key={`${seriesLabel}-${item.dataKey ?? 'unknown'}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: '#475569',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '999px',
                  background: color,
                }}
              />
              <span>{seriesLabel}</span>
              <span style={{ fontWeight: 600, color: '#152238' }}>
                {valueFormatter ? valueFormatter(item.value) : item.value ?? '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ChartLegendContent({ payload, config }: ChartLegendContentProps) {
  if (!payload || payload.length === 0) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem 1rem',
        justifyContent: 'center',
        paddingTop: '0.5rem',
      }}
    >
      {payload.map((item) => {
        const label = getSeriesLabel(config, item.dataKey, item.value)
        const color = getSeriesColor(config, item.dataKey, item.color)

        return (
          <div
            key={`${label}-${item.dataKey ?? 'unknown'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: '#475569',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '999px',
                background: color,
              }}
            />
            <span>{label}</span>
          </div>
        )
      })}
    </div>
  )
}