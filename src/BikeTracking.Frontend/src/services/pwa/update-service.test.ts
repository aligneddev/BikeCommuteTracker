import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUpdateService } from "./update-service";

describe("update-service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves to failed state when service worker is unsupported", async () => {
    const originalServiceWorker = navigator.serviceWorker;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

    const service = createUpdateService();
    await service.checkForUpdates();

    expect(service.getState().status).toBe("failed");
    expect(service.getState().failureReason).toBeTypeOf("string");

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalServiceWorker,
    });
  });

  it("emits checking then idle when no registration exists", async () => {
    const getRegistration = vi.fn(async () => null);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration,
      },
    });

    const service = createUpdateService();
    const states: string[] = [];
    const unsubscribe = service.subscribe((state) => {
      states.push(state.status);
    });

    await service.checkForUpdates();
    unsubscribe();

    expect(states).toEqual(["idle", "checking", "idle"]);
  });

  it("emits checking, downloading, ready, applied when waiting worker exists", async () => {
    const registration = {
      waiting: { postMessage: vi.fn() },
      update: vi.fn(async () => undefined),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => registration),
      },
    });

    const service = createUpdateService();
    const states: string[] = [];
    const unsubscribe = service.subscribe((state) => {
      states.push(state.status);
    });

    await service.checkForUpdates();
    unsubscribe();

    expect(states).toEqual([
      "idle",
      "checking",
      "downloading",
      "ready",
      "applied",
    ]);
  });

  it("emits failed when update check throws", async () => {
    const registration = {
      waiting: null,
      update: vi.fn(async () => {
        throw new Error("boom");
      }),
    };

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => registration),
      },
    });

    const service = createUpdateService();
    await service.checkForUpdates();

    expect(service.getState().status).toBe("failed");
    expect(service.getState().failureReason).toContain("failed");
  });
});
