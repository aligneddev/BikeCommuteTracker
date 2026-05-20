import { type UpdateState } from "./pwa-types";

type UpdateListener = (state: UpdateState) => void;

function nowIso(): string {
  return new Date().toISOString();
}

function createState(
  status: UpdateState["status"],
  extras?: Partial<UpdateState>,
): UpdateState {
  return {
    status,
    lastCheckedAtUtc: nowIso(),
    ...extras,
  };
}

export interface UpdateService {
  getState: () => UpdateState;
  subscribe: (listener: UpdateListener) => () => void;
  checkForUpdates: () => Promise<void>;
}

export function createUpdateService(): UpdateService {
  let state: UpdateState = createState("idle");
  const listeners = new Set<UpdateListener>();

  function emit(nextState: UpdateState): void {
    state = nextState;
    listeners.forEach((listener) => listener(nextState));
  }

  return {
    getState: () => state,
    subscribe: (listener: UpdateListener) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    checkForUpdates: async () => {
      if (!("serviceWorker" in navigator)) {
        emit(
          createState("failed", {
            failureReason: "Service worker unsupported",
          }),
        );
        return;
      }

      emit(createState("checking"));

      try {
        const registration = await navigator.serviceWorker.getRegistration();

        if (!registration) {
          emit(createState("idle"));
          return;
        }

        emit(createState("downloading"));
        await registration.update();

        if (registration.waiting) {
          emit(createState("ready", { targetVersion: "latest" }));
          emit(createState("applied", { targetVersion: "latest" }));
          return;
        }

        emit(createState("applied", { targetVersion: "latest" }));
      } catch {
        emit(createState("failed", { failureReason: "Update check failed" }));
      }
    },
  };
}
