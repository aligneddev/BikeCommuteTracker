import { createInstallService, type InstallService } from "./install-service";
import { getLaunchContext, subscribeNetworkState } from "./launch-context";
import { createUpdateService, type UpdateService } from "./update-service";
import {
  type InstallationState,
  type LaunchContext,
  type UpdateState,
} from "./pwa-types";

interface PwaSnapshot {
  launchContext: LaunchContext;
  installationState: InstallationState;
  updateState: UpdateState;
}

type SnapshotListener = (snapshot: PwaSnapshot) => void;

const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";
let installService: InstallService | null = null;
let updateService: UpdateService | null = null;
let unsubscribeNetwork: (() => void) | null = null;

const listeners = new Set<SnapshotListener>();

let snapshot: PwaSnapshot | null = null;

function ensureSnapshot(): PwaSnapshot {
  if (snapshot) {
    return snapshot;
  }

  const launchContext = getLaunchContext(APP_VERSION);
  installService = createInstallService();
  updateService = createUpdateService();

  snapshot = {
    launchContext,
    installationState: installService.getState(),
    updateState: updateService.getState(),
  };

  installService.subscribe((state) => {
    if (!snapshot) return;
    snapshot = { ...snapshot, installationState: state };
    listeners.forEach((listener) => listener(snapshot as PwaSnapshot));
  });

  updateService.subscribe((state) => {
    if (!snapshot) return;
    snapshot = { ...snapshot, updateState: state };
    listeners.forEach((listener) => listener(snapshot as PwaSnapshot));
  });

  unsubscribeNetwork = subscribeNetworkState((isOnline) => {
    if (!snapshot) return;
    snapshot = {
      ...snapshot,
      launchContext: {
        ...snapshot.launchContext,
        isOnline,
      },
    };
    listeners.forEach((listener) => listener(snapshot as PwaSnapshot));
  });

  return snapshot;
}

export function initializePwaBootstrap(): void {
  const current = ensureSnapshot();

  if (!current.launchContext.isOnline) {
    return;
  }

  void updateService?.checkForUpdates();
}

export function subscribePwaSnapshot(listener: SnapshotListener): () => void {
  const current = ensureSnapshot();
  listeners.add(listener);
  listener(current);

  return () => {
    listeners.delete(listener);
  };
}

export function getPwaSnapshot(): PwaSnapshot {
  return ensureSnapshot();
}

export async function promptPwaInstall(): Promise<boolean> {
  ensureSnapshot();
  return installService?.promptInstall() ?? false;
}

export function disposePwaBootstrap(): void {
  installService?.dispose();
  installService = null;
  updateService = null;
  unsubscribeNetwork?.();
  unsubscribeNetwork = null;
  snapshot = null;
  listeners.clear();
}
