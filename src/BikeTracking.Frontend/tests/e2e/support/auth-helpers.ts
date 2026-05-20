import { expect, type Page } from "@playwright/test";

interface PwaEnvironmentOptions {
  platform?: string;
  userAgent?: string;
  isOnline?: boolean;
  installedMode?: boolean;
}

export function uniqueUser(prefix: string): string {
  const suffix = crypto.getRandomValues(new Uint32Array(1))[0];
  return `${prefix}-${Date.now()}-${suffix}`;
}

export async function signupUser(
  page: Page,
  userName: string,
  pin: string,
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/login");
}

export async function loginUser(
  page: Page,
  userName: string,
  pin: string,
): Promise<void> {
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
}

export async function createAndLoginUser(
  page: Page,
  userName: string,
  pin: string,
): Promise<void> {
  await signupUser(page, userName, pin);
  await loginUser(page, userName, pin);
}

export async function logoutUser(page: Page, userName: string): Promise<void> {
  await page.getByRole("button", { name: userName }).click();
  await page.evaluate(() => {
    const runtime = globalThis as {
      document?: { querySelector: (selector: string) => unknown };
    };
    const logoutButton = runtime.document?.querySelector(
      ".header-logout-btn",
    ) as { click?: () => void } | null;
    logoutButton?.click?.();
  });
  await expect(page).toHaveURL("/login");
}

export async function saveUserLocation(
  page: Page,
  latitude: string,
  longitude: string,
): Promise<void> {
  await page.goto("/settings");
  await page.locator("#latitude").fill(latitude);
  await page.locator("#longitude").fill(longitude);
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText(/settings saved successfully/i)).toBeVisible();
}

export async function setNetworkOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
}

export async function setNetworkOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
}

export async function applyPwaEnvironment(
  page: Page,
  options: PwaEnvironmentOptions,
): Promise<void> {
  const {
    platform = "Win32",
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    isOnline = true,
    installedMode = false,
  } = options;

  await page.addInitScript(
    ({ platformValue, userAgentValue, onlineValue, installedModeValue }) => {
      const runtime = globalThis as unknown as {
        navigator: Record<string, unknown>;
        matchMedia?: (query: string) => unknown;
      };

      Object.defineProperty(runtime.navigator, "platform", {
        configurable: true,
        value: platformValue,
      });

      Object.defineProperty(runtime.navigator, "userAgent", {
        configurable: true,
        value: userAgentValue,
      });

      Object.defineProperty(runtime.navigator, "onLine", {
        configurable: true,
        get: () => onlineValue,
      });

      const originalMatchMedia = runtime.matchMedia?.bind(runtime) as
        | ((query: string) => unknown)
        | undefined;

      runtime.matchMedia = (query: string): unknown => {
        if (query === "(display-mode: standalone)") {
          return {
            matches: installedModeValue,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => true,
          };
        }

        return originalMatchMedia ? originalMatchMedia(query) : null;
      };
    },
    {
      platformValue: platform,
      userAgentValue: userAgent,
      onlineValue: isOnline,
      installedModeValue: installedMode,
    },
  );
}
