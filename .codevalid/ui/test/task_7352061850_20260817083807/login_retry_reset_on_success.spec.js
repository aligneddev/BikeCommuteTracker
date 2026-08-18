import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockRetryResetScenario,
  mockDashboardBootstrap,
} from "../../helpers/mock-api.js";

test("login_retry_reset_on_success", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "login_retry_reset_on_success",
    testTitle: "Progressive retry delay resets after successful login",
  });

  await setupUnauthenticatedSession(page);
  await mockRetryResetScenario(page);
  await mockDashboardBootstrap(page);

  await recorder.step("Open login page and fail three times to reach delayed state", async () => {
    await page.goto("/login");
    await page.locator("#login-name").fill("alex");
    for (const seconds of [2, 8, 30]) {
      await page.locator("#login-pin").fill("9999");
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText(`Too many attempts. Try again in ${seconds} seconds.`)).toBeVisible();
    }
  });

  await recorder.step("Log in successfully with correct credentials", async () => {
    await page.locator("#login-pin").fill("1234");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await recorder.step("Clear session and verify next failure starts over without progressive delay carryover", async () => {
    await page.evaluate(() => {
      window.sessionStorage.removeItem("bike_tracking_auth_session");
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    });
    await page.goto("/login");
    await page.locator("#login-name").fill("alex");
    await page.locator("#login-pin").fill("0000");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Too many attempts. Try again in 2 seconds.")).toHaveCount(0);
    await expect(page.getByText("Name or PIN is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:login_retry_reset_on_success");
  await recorder.save(testInfo);
});
