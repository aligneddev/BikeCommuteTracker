import { createLaunchContext } from "./environment-support";
import { type LaunchContext } from "./pwa-types";

type OnlineStateListener = (isOnline: boolean) => void;

export interface ConnectivityStatus {
  isConnectivityRequired: boolean;
  isBlocked: boolean;
}

export function getLaunchContext(appVersion: string): LaunchContext {
  return createLaunchContext(appVersion);
}

export function getConnectivityStatus(
  launchContext: LaunchContext,
): ConnectivityStatus {
  const isConnectivityRequired = launchContext.mode === "installed_window";
  return {
    isConnectivityRequired,
    isBlocked: isConnectivityRequired && !launchContext.isOnline,
  };
}

export function readOnlineState(): boolean {
  return navigator.onLine;
}

export function subscribeNetworkState(
  listener: OnlineStateListener,
): () => void {
  const handleOnline = (): void => {
    listener(true);
  };

  const handleOffline = (): void => {
    listener(false);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  listener(readOnlineState());

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
