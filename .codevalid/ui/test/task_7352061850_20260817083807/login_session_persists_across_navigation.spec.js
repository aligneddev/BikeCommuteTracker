import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSuccessfulSigninFlow,
  mockProtectedAppShellRoutes,
} from "../../helpers/mock-api.js";

test("Authenticated session is preserved across protected page navigation", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("login_session_persists_across_navigation", "Authenticated session is preserved across protected page navigation");

  await recorder.step("set up successful auth and protected api mocks", async () => {
    await setupUnauthenticatedSession(page);
    await mockSuccessfulSigninFlow(page);
    await mockProtectedAppShellRoutes(page);
  });

  await recorder.step("log in successfully", async () => {
    await page.goto("/login");
    await page.locator("#login-name").fill("Alice");
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Welcome, Alice!")).toBeVisible();
  });

  await recorder.step("navigate among protected pages without reauthentication", async () => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.goto("/dashboard/advanced");
    await expect(page).toHaveURL(/\/dashboard\/advanced$/);
    await expect(page.getByRole("heading", { name: "Savings Breakdown" })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Welcome, Alice!")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_session_persists_across_navigation");
  await recorder.save(testInfo);
});
