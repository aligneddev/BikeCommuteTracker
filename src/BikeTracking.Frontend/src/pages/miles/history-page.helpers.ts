/**
 * Utility functions for mileage formatting and display across summary cards and history totals.
 */

/**
 * Format a numeric miles value to a display string with consistent precision and suffix.
 * @param miles The numeric miles value (can be 0 or negative, though negatives are unexpected)
 * @param decimalPlaces Number of decimal places to show (default 1)
 * @returns Formatted miles string (e.g., "42.5 mi")
 */
export function formatMiles(miles: number, decimalPlaces: number = 1): string {
  if (!Number.isFinite(miles)) {
    return "0 mi";
  }

  const rounded =
    Math.round(miles * Math.pow(10, decimalPlaces)) /
    Math.pow(10, decimalPlaces);
  return `${rounded.toFixed(decimalPlaces)} mi`;
}

/**
 * Format a ride count as a display string.
 * @param count The number of rides
 * @returns Formatted ride count string (e.g., "1 ride" or "5 rides")
 */
export function formatRideCount(count: number): string {
  if (count === 1) {
    return "1 ride";
  }
  return `${count} rides`;
}

/**
 * Get a descriptive label for a period type (thisMonth, thisYear, allTime, filtered).
 * @param period The period string from MileageSummary
 * @returns Human-readable label for the period
 */
export function getPeriodLabel(
  period: "thisMonth" | "thisYear" | "allTime" | "filtered",
): string {
  const labels: Record<typeof period, string> = {
    thisMonth: "This Month",
    thisYear: "This Year",
    allTime: "All Time",
    filtered: "Filtered",
  };

  return labels[period] || "Unknown";
}

/**
 * Get an emoji or icon indicator for a period type to use in summary cards.
 * @param period The period string from MileageSummary
 * @returns Emoji or icon string suitable for display
 */
export function getPeriodIcon(
  period: "thisMonth" | "thisYear" | "allTime" | "filtered",
): string {
  const icons: Record<typeof period, string> = {
    thisMonth: "📅", // Calendar icon for current month
    thisYear: "📈", // Chart icon for year
    allTime: "🏆", // Trophy icon for all-time
    filtered: "🔍", // Magnifying glass for filtered
  };

  return icons[period] || "📍";
}

/**
 * Format a summary card subtitle combining miles and ride count.
 * @param miles The miles value
 * @param rideCount The ride count
 * @returns Formatted subtitle string (e.g., "42.5 mi • 5 rides")
 */
export function formatSummarySubtitle(
  miles: number,
  rideCount: number,
): string {
  const milesStr = formatMiles(miles, 1);
  const countStr = formatRideCount(rideCount);
  return `${milesStr} • ${countStr}`;
}

/**
 * Parse ISO date string to a display-friendly format.
 * @param isoDateString ISO date-time string (e.g., "2025-03-26T10:30:00")
 * @returns Formatted date string (e.g., "Mar 26, 2025")
 */
export function formatRideDate(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown date";
  }
}

/**
 * Parse ISO date string to a time-only display string.
 * @param isoDateString ISO date-time string
 * @returns Formatted time string (e.g., "10:30 AM")
 */
export function formatRideTime(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    if (Number.isNaN(date.getTime())) {
      return "Unknown time";
    }

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      meridiem: "short",
    });
  } catch {
    return "Unknown time";
  }
}

/**
 * Format duration in minutes to a display string.
 * @param minutes The duration in minutes (can be null/undefined)
 * @returns Formatted duration string (e.g., "45 min") or empty string if not provided
 */
export function formatRideDuration(minutes: number | undefined): string {
  if (minutes === undefined || minutes === null || !Number.isFinite(minutes)) {
    return "";
  }

  if (minutes === 1) {
    return "1 min";
  }

  return `${minutes} min`;
}

/**
 * Format temperature to a display string.
 * @param temperature The temperature value in Fahrenheit (can be null/undefined)
 * @returns Formatted temperature string (e.g., "72°F") or empty string if not provided
 */
export function formatTemperature(temperature: number | undefined): string {
  if (
    temperature === undefined ||
    temperature === null ||
    !Number.isFinite(temperature)
  ) {
    return "";
  }

  return `${Math.round(temperature)}°F`;
}
