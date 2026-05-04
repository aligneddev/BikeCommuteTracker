import { test, expect, type Page } from "@playwright/test";
import {
  loginUser,
  logoutUser,
  signupUser,
  uniqueUser,
} from "./support/auth-helpers";

/**
 * T014 - E2E Smoke Test: User Login
 *
 * Covers:
 *  1. `/` redirects to `/login`
 *  2. Unauthenticated `/miles` redirects to `/login`
 *  3. Incorrect credentials show an error and stay on `/login`
 *  4. Successful login redirects to `/dashboard`
 *  5. Logout from `/dashboard` returns to `/login`
 *
 * The Playwright config starts API + Vite when needed.
 *
 * Spec refs: US1 AC1–AC4, US2 AC1–AC2, US3 AC1–AC2
 */

const TEST_PIN = "87654321";

async function createUserViaSignup(
  page: Page,
  userName: string,
  pin: string,
): Promise<void> {
  await signupUser(page, userName, pin);
  await expect(page.getByLabel("Name")).toHaveValue(userName);
}

test.describe("003-user-login smoke tests", () => {
  test("root / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated /miles redirects to /login", async ({ page }) => {
    await page.goto("/miles");
    await expect(page).toHaveURL("/login");
  });

  test("wrong PIN shows error and stays on /login", async ({ page }) => {
    const userName = uniqueUser("e2e-wrong-pin");
    await createUserViaSignup(page, userName, TEST_PIN);

    await page.getByLabel("Name").fill(userName);
    await page.getByLabel("PIN").fill("00000000");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Name or PIN is incorrect.")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("successful login redirects to /dashboard", async ({ page }) => {
    const userName = uniqueUser("e2e-login-ok");
    await createUserViaSignup(page, userName, TEST_PIN);

    await loginUser(page, userName, TEST_PIN);
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: /your riding story/i }),
    ).toBeVisible();
  });

  test("logout from /dashboard returns to /login", async ({ page }) => {
    const userName = uniqueUser("e2e-logout");
    await createUserViaSignup(page, userName, TEST_PIN);

    await loginUser(page, userName, TEST_PIN);

    // Logout
    await logoutUser(page, userName);
  });

  test("signup page has link to /login", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  });

  test("login page has link to /signup", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: /create an account/i }),
    ).toBeVisible();
  });

  test("successful signup navigates to /login and prefills name", async ({
    page,
  }) => {
    const newUser = uniqueUser("e2e-signup");
    await createUserViaSignup(page, newUser, TEST_PIN);
  });
});
