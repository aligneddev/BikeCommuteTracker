import { expect, type Page } from "@playwright/test";

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
    const logoutButton = document.querySelector(
      ".header-logout-btn",
    ) as HTMLButtonElement | null;
    logoutButton?.click();
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
