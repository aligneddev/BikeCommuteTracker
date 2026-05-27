const INACTIVITY_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SESSION_INACTIVITY_WINDOW_MS = INACTIVITY_WINDOW_DAYS * MS_PER_DAY;

export function computeExpiryFromActivity(lastActivityUtcIso: string): string {
  const lastActivity = new Date(lastActivityUtcIso);
  return new Date(
    lastActivity.getTime() + SESSION_INACTIVITY_WINDOW_MS,
  ).toISOString();
}

export function isInactivityExpired(
  lastActivityUtcIso: string,
  now: Date = new Date(),
): boolean {
  const lastActivityMs = new Date(lastActivityUtcIso).getTime();
  return now.getTime() - lastActivityMs > SESSION_INACTIVITY_WINDOW_MS;
}

export function makeActivityTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}
