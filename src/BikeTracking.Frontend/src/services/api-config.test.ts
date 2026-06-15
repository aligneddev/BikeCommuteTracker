import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiBaseUrl } from "./api-config";

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    // Clear any previous Tauri injection
    delete (window as { __BIKE_API_URL__?: string }).__BIKE_API_URL__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as { __BIKE_API_URL__?: string }).__BIKE_API_URL__;
  });

  it("returns window.__BIKE_API_URL__ when set (Tauri runtime injection)", () => {
    (window as { __BIKE_API_URL__?: string }).__BIKE_API_URL__ =
      "http://localhost:5079";

    expect(getApiBaseUrl()).toBe("http://localhost:5079");
  });

  it("strips trailing slash from window.__BIKE_API_URL__", () => {
    (window as { __BIKE_API_URL__?: string }).__BIKE_API_URL__ =
      "http://localhost:5079/";

    expect(getApiBaseUrl()).toBe("http://localhost:5079");
  });

  it("window.__BIKE_API_URL__ takes priority over VITE_API_BASE_URL", () => {
    (window as { __BIKE_API_URL__?: string }).__BIKE_API_URL__ =
      "http://localhost:5079";
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:9999");

    expect(getApiBaseUrl()).toBe("http://localhost:5079");
  });

  it("falls back to VITE_API_BASE_URL when window.__BIKE_API_URL__ absent", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:9999");

    expect(getApiBaseUrl()).toBe("http://localhost:9999");
  });

  it("falls back to localhost:5436 when neither override is set", () => {
    // No window.__BIKE_API_URL__ (cleared in beforeEach), no VITE_API_BASE_URL (not defined in test env)
    expect(getApiBaseUrl()).toBe("http://localhost:5436");
  });

  it("supports custom host from Tauri app.conf.json (non-localhost)", () => {
    (window as { __BIKE_API_URL__?: string }).__BIKE_API_URL__ =
      "http://192.168.1.10:5079";

    expect(getApiBaseUrl()).toBe("http://192.168.1.10:5079");
  });
});
