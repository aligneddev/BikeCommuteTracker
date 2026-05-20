import { createUpdateService } from "./update-service";

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");

    registration.addEventListener("updatefound", () => {
      const updater = createUpdateService();
      void updater.checkForUpdates();
    });
  } catch {
    // Registration failure should not block app startup.
  }
}
