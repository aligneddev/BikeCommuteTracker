interface MonthlyImportSummaryPanelProps {
  monthsProcessed: number
  ridesCreated: number
  ridesReplaced: number
  ridesSkipped: number
  rowsRejected: number
}

export function MonthlyImportSummaryPanel({
  monthsProcessed,
  ridesCreated,
  ridesReplaced,
  ridesSkipped,
  rowsRejected,
}: MonthlyImportSummaryPanelProps) {
  return (
    <section aria-label="Monthly import summary">
      <h2>Monthly import summary</h2>
      <p>Months processed: {monthsProcessed}</p>
      <p>Rides created: {ridesCreated}</p>
      <p>Rides replaced: {ridesReplaced}</p>
      <p>Rides skipped: {ridesSkipped}</p>
      <p>Rows rejected: {rowsRejected}</p>
    </section>
  )
}
