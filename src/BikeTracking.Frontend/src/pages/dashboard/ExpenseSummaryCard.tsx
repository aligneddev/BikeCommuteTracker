import { DashboardSummaryCard } from '../../components/dashboard/dashboard-summary-card'
import type { DashboardExpenseSummary } from '../../services/dashboard-api'
import './ExpenseSummaryCard.css'

interface ExpenseSummaryCardProps {
  expenseSummary: DashboardExpenseSummary
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function getNetState(netExpenses: number | null): 'neutral' | 'savings' | 'expense' {
  if (netExpenses === null) {
    return 'neutral'
  }

  return netExpenses < 0 ? 'savings' : 'expense'
}

export function ExpenseSummaryCard({ expenseSummary }: ExpenseSummaryCardProps) {
  const netState = getNetState(expenseSummary.netExpenses)
  const netLabel = netState === 'savings' ? 'Net Savings' : 'Net Expenses'

  return (
    <DashboardSummaryCard
      title="Expense Summary"
      eyebrow="Budget"
      value={formatCurrency(expenseSummary.netExpenses ?? expenseSummary.totalManualExpenses)}
      detail={`${expenseSummary.oilChangeIntervalCount} oil change intervals avoided`}
      accentClassName="dashboard-summary-card-accent-expenses"
    >
      <div className="expense-summary-card-details">
        <div className="expense-summary-card-row">
          <span>Total Expenses</span>
          <span>{formatCurrency(expenseSummary.totalManualExpenses)}</span>
        </div>
        <div className="expense-summary-card-row">
          <span>Oil Change Savings</span>
          <span>{formatCurrency(expenseSummary.oilChangeSavings)}</span>
        </div>
        <div
          className={`expense-summary-card-row expense-summary-card-row-net expense-summary-card-row-net-${netState}`}
        >
          <span>{netLabel}</span>
          <span>{formatCurrency(expenseSummary.netExpenses)}</span>
        </div>
      </div>
    </DashboardSummaryCard>
  )
}