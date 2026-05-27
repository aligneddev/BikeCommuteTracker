import { describe, expect, it } from "vitest";
import { getConnectivityStatus } from "./launch-context";

describe("launch-context connectivity", () => {
  it("blocks ride operations when installed mode is offline", () => {
    const status = getConnectivityStatus({
      mode: "installed_window",
      isOnline: false,
      platform: "windows",
      browserFamily: "chrome",
      appVersion: "test",
    });

    expect(status.isConnectivityRequired).toBe(true);
    expect(status.isBlocked).toBe(true);
  });

  it("does not block ride operations in browser tab when offline", () => {
    const status = getConnectivityStatus({
      mode: "browser_tab",
      isOnline: false,
      platform: "windows",
      browserFamily: "chrome",
      appVersion: "test",
    });

    expect(status.isConnectivityRequired).toBe(false);
    expect(status.isBlocked).toBe(false);
  });
});
