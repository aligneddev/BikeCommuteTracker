import {
  type BrowserFamily,
  type InstallationState,
  type LaunchContext,
  type PlatformType,
} from "./pwa-types";

const EDGE_TOKEN = /(Edg|Edge)\//i;
const CHROME_TOKEN = /Chrome\//i;

function nowIso(): string {
  return new Date().toISOString();
}

export function detectPlatform(): PlatformType {
  const userAgentDataPlatform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform?.toLowerCase();
  const platform = (
    userAgentDataPlatform ??
    navigator.platform ??
    ""
  ).toLowerCase();
  return platform.includes("win") ? "windows" : "non_windows";
}

export function detectBrowserFamily(): BrowserFamily {
  const userAgent = navigator.userAgent;
  if (EDGE_TOKEN.test(userAgent)) {
    return "edge";
  }

  if (CHROME_TOKEN.test(userAgent)) {
    return "chrome";
  }

  return "other";
}

export function isStandaloneLaunch(): boolean {
  const browserStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return browserStandalone || navigator.standalone === true;
}

export function createLaunchContext(appVersion: string): LaunchContext {
  return {
    mode: isStandaloneLaunch() ? "installed_window" : "browser_tab",
    isOnline: navigator.onLine,
    platform: detectPlatform(),
    browserFamily: detectBrowserFamily(),
    appVersion,
  };
}

export function evaluateInstallSupport(): InstallationState {
  const platform = detectPlatform();
  const browserFamily = detectBrowserFamily();

  if (platform !== "windows") {
    return {
      isInstallSupported: false,
      installPromptAvailable: false,
      status: "unavailable",
      reasonCode: "unsupported_os",
      lastTransitionAtUtc: nowIso(),
    };
  }

  if (browserFamily !== "chrome" && browserFamily !== "edge") {
    return {
      isInstallSupported: false,
      installPromptAvailable: false,
      status: "unavailable",
      reasonCode: "unsupported_browser",
      lastTransitionAtUtc: nowIso(),
    };
  }

  return {
    isInstallSupported: true,
    installPromptAvailable: false,
    status: "available",
    lastTransitionAtUtc: nowIso(),
  };
}
