/**
 * Formats a total number of riding minutes as whole hours and minutes,
 * e.g. 2535 → "42h 15m" and 62550 → "1,042h 30m". Never decimal hours.
 */
export function formatHoursMinutes(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60).toLocaleString("en-US")}h ${totalMinutes % 60}m`;
}
