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
  await expect(page).toHaveURL("/miles");
}

export async function createAndLoginUser(
  page: Page,
  userName: string,
  pin: string,
): Promise<void> {
  await signupUser(page, userName, pin);
  await loginUser(page, userName, pin);
}
