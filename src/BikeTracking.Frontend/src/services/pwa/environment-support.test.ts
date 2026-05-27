import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectBrowserFamily,
  detectPlatform,
  evaluateInstallSupport,
} from "./environment-support";

function setNavigatorValue(key: string, value: unknown): void {
  Object.defineProperty(globalThis.navigator, key, {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("environment-support", () => {
  it("detects supported Windows + Edge environment", () => {
    setNavigatorValue("platform", "Win32");
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    );

    expect(detectPlatform()).toBe("windows");
    expect(detectBrowserFamily()).toBe("edge");

    const state = evaluateInstallSupport();
    expect(state.isInstallSupported).toBe(true);
    expect(state.status).toBe("available");
  });

  it("marks non-Windows environments as unsupported", () => {
    setNavigatorValue("platform", "Linux x86_64");
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const state = evaluateInstallSupport();
    expect(state.isInstallSupported).toBe(false);
    expect(state.reasonCode).toBe("unsupported_os");
    expect(state.status).toBe("unavailable");
  });
});
