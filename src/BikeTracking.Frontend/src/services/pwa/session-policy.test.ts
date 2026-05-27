import { describe, expect, it } from "vitest";
import {
  SESSION_INACTIVITY_WINDOW_MS,
  computeExpiryFromActivity,
  isInactivityExpired,
  makeActivityTimestamp,
} from "./session-policy";

describe("session-policy", () => {
  it("computes expiry exactly seven days after last activity", () => {
    const lastActivity = "2026-05-01T10:00:00.000Z";

    expect(computeExpiryFromActivity(lastActivity)).toBe(
      "2026-05-08T10:00:00.000Z",
    );
  });

  it("does not expire exactly at the seven-day boundary", () => {
    const lastActivity = "2026-05-01T10:00:00.000Z";
    const nowAtBoundary = new Date(
      new Date(lastActivity).getTime() + SESSION_INACTIVITY_WINDOW_MS,
    );

    expect(isInactivityExpired(lastActivity, nowAtBoundary)).toBe(false);
  });

  it("expires after more than seven days of inactivity", () => {
    const lastActivity = "2026-05-01T10:00:00.000Z";
    const nowAfterBoundary = new Date(
      new Date(lastActivity).getTime() + SESSION_INACTIVITY_WINDOW_MS + 1,
    );

    expect(isInactivityExpired(lastActivity, nowAfterBoundary)).toBe(true);
  });

  it("creates ISO timestamps for persisted activity", () => {
    const stamp = makeActivityTimestamp(new Date("2026-05-20T12:34:56.000Z"));

    expect(stamp).toBe("2026-05-20T12:34:56.000Z");
  });
});
