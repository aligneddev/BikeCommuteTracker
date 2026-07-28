import { getApiBaseUrl } from "./api-config";

const SESSION_KEY = "bike_tracking_auth_session";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return headers;
    }

    const parsed = JSON.parse(raw) as { userId?: number };
    if (typeof parsed.userId === "number" && parsed.userId > 0) {
      headers["X-User-Id"] = parsed.userId.toString();
    }
  } catch {
    // Ignore malformed session payloads and continue unauthenticated.
  }

  return headers;
}

/**
 * Downloads all expense records for the authenticated rider as a UTF-8 CSV file.
 * Mirrors the existing `downloadExpenseReceipt` blob-download pattern.
 */
export async function fetchExpensesCsv(): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/exports/expenses`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Expense export failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = "expenses-export.csv";
  document.body.append(link);
  link.click();
  link.remove();

  // Revoke the object URL after a short delay to allow the download to start.
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 100);
}

/**
 * Downloads all ride records for the authenticated rider as a ZIP archive
 * containing one CSV per calendar year.
 * Mirrors the existing `downloadExpenseReceipt` blob-download pattern.
 */
export async function fetchRideHistoryZip(): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/exports/rides`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Ride history export failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = "ride-history-export.zip";
  document.body.append(link);
  link.click();
  link.remove();

  // Revoke the object URL after a short delay to allow the download to start.
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 100);
}
