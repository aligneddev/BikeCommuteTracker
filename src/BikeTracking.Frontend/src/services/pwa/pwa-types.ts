export type InstallStatus =
  | "unavailable"
  | "available"
  | "prompting"
  | "installed"
  | "failed";

export type InstallReasonCode =
  | "unsupported_os"
  | "unsupported_browser"
  | "prompt_dismissed"
  | "policy_blocked"
  | "unknown_error";

export interface InstallationState {
  isInstallSupported: boolean;
  installPromptAvailable: boolean;
  status: InstallStatus;
  reasonCode?: InstallReasonCode;
  lastTransitionAtUtc: string;
}

export type LaunchMode = "browser_tab" | "installed_window";
export type PlatformType = "windows" | "non_windows";
export type BrowserFamily = "chrome" | "edge" | "other";

export interface LaunchContext {
  mode: LaunchMode;
  isOnline: boolean;
  platform: PlatformType;
  browserFamily: BrowserFamily;
  appVersion: string;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "applied"
  | "failed";

export interface UpdateState {
  status: UpdateStatus;
  targetVersion?: string;
  lastCheckedAtUtc?: string;
  failureReason?: string;
}

export interface SessionState {
  isAuthenticated: boolean;
  lastActivityAtUtc?: string;
  expiresAtUtc?: string;
  expiredByInactivity: boolean;
}
