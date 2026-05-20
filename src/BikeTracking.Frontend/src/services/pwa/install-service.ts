import { evaluateInstallSupport } from "./environment-support";
import { type InstallationState } from "./pwa-types";

interface InstallChoiceResult {
  outcome: "accepted" | "dismissed";
  platform: string;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoiceResult>;
}

type InstallStateListener = (state: InstallationState) => void;

function nowIso(): string {
  return new Date().toISOString();
}

export interface InstallService {
  getState: () => InstallationState;
  subscribe: (listener: InstallStateListener) => () => void;
  promptInstall: () => Promise<boolean>;
  dispose: () => void;
}

export function createInstallService(): InstallService {
  let state = evaluateInstallSupport();
  let deferredPromptEvent: BeforeInstallPromptEvent | null = null;
  const listeners = new Set<InstallStateListener>();

  function emit(nextState: InstallationState): void {
    state = nextState;
    listeners.forEach((listener) => listener(state));
  }

  function onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    deferredPromptEvent = event as BeforeInstallPromptEvent;

    emit({
      ...state,
      installPromptAvailable: true,
      status: "available",
      reasonCode: undefined,
      lastTransitionAtUtc: nowIso(),
    });
  }

  function onAppInstalled(): void {
    deferredPromptEvent = null;
    emit({
      ...state,
      installPromptAvailable: false,
      status: "installed",
      reasonCode: undefined,
      lastTransitionAtUtc: nowIso(),
    });
  }

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  return {
    getState: () => state,
    subscribe: (listener: InstallStateListener) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    promptInstall: async () => {
      if (!deferredPromptEvent) {
        emit({
          ...state,
          status: "failed",
          reasonCode: "policy_blocked",
          lastTransitionAtUtc: nowIso(),
        });
        return false;
      }

      emit({
        ...state,
        status: "prompting",
        lastTransitionAtUtc: nowIso(),
      });

      try {
        await deferredPromptEvent.prompt();
        const choice = await deferredPromptEvent.userChoice;

        if (choice.outcome === "accepted") {
          emit({
            ...state,
            installPromptAvailable: false,
            status: "installed",
            reasonCode: undefined,
            lastTransitionAtUtc: nowIso(),
          });
          deferredPromptEvent = null;
          return true;
        }

        emit({
          ...state,
          status: "failed",
          reasonCode: "prompt_dismissed",
          lastTransitionAtUtc: nowIso(),
        });
        return false;
      } catch {
        emit({
          ...state,
          status: "failed",
          reasonCode: "unknown_error",
          lastTransitionAtUtc: nowIso(),
        });
        return false;
      }
    },
    dispose: () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      listeners.clear();
    },
  };
}
