import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSuccessfulSigninFlow,
  mockProtectedAppShellRoutes,
} from "../../helpers/mock-api.js";

test("Successful login with valid name and PIN redirects to dashboard", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_success_valid_credentials", "Successful login with valid name and PIN redirects to dashboard");

  await recorder.step("clear session and register login/dashboard/settings mocks", async () => {
    await setupUnauthenticatedSession(page);
    await mockSuccessfulSigninFlow(page);
    await mockProtectedAppShellRoutes(page);
  });

  await recorder.step("open login page", async () => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  await recorder.step("submit valid credentials", async () => {
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
  });

  await recorder.step("verify redirect and persisted session across protected navigation", async () => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Welcome, Alice!")).toBeVisible();

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.goto("/dashboard/advanced");
    await expect(page).toHaveURL(/\/dashboard\/advanced$/);
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_success_valid_credentials");
  await recorder.save(testInfo);
});
