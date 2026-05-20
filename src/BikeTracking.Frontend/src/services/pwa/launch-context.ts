import { createLaunchContext } from "./environment-support";
import { type LaunchContext } from "./pwa-types";

type OnlineStateListener = (isOnline: boolean) => void;

export function getLaunchContext(appVersion: string): LaunchContext {
  return createLaunchContext(appVersion);
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

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
