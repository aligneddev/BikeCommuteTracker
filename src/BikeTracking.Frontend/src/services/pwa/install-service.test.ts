import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInstallService,
  type BeforeInstallPromptEvent,
} from "./install-service";

function setNavigatorValue(key: string, value: unknown): void {
  Object.defineProperty(globalThis.navigator, key, {
    configurable: true,
    value,
  });
}

function createBeforeInstallPromptEvent(
  outcome: "accepted" | "dismissed",
): BeforeInstallPromptEvent {
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("install-service", () => {
  it("promotes prompt availability after beforeinstallprompt event", async () => {
    setNavigatorValue("platform", "Win32");
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const service = createInstallService();
    const event = createBeforeInstallPromptEvent("accepted");
    window.dispatchEvent(event);

    expect(service.getState().installPromptAvailable).toBe(true);

    const didInstall = await service.promptInstall();
    expect(didInstall).toBe(true);
    expect(service.getState().status).toBe("installed");

    service.dispose();
  });

  it("marks prompt dismissal as failure reason", async () => {
    setNavigatorValue("platform", "Win32");
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    );

    const service = createInstallService();
    window.dispatchEvent(createBeforeInstallPromptEvent("dismissed"));

    const didInstall = await service.promptInstall();
    expect(didInstall).toBe(false);
    expect(service.getState().status).toBe("failed");
    expect(service.getState().reasonCode).toBe("prompt_dismissed");

    service.dispose();
  });
});
