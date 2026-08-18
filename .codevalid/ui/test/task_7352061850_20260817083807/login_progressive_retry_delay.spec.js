import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockIdentifyThrottleSequence,
} from "../../helpers/mock-api.js";

test("login_progressive_retry_delay", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "login_progressive_retry_delay",
    testTitle: "Progressive retry delay increases after consecutive failed logins",
  });

  await setupUnauthenticatedSession(page);
  await mockIdentifyThrottleSequence(page, { retryAfterSeconds: [1, 2, 8, 30] });

  await recorder.step("Open login page and enter rider name", async () => {
    await page.goto("/login");
    await page.locator("#login-name").fill("alex");
  });

  for (const [index, seconds] of [1, 2, 8, 30].entries()) {
    await recorder.step(`Submit failed login attempt ${index + 1}`, async () => {
      await page.locator("#login-pin").fill("9999");
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page.getByText(`Too many attempts. Try again in ${seconds} seconds.`)).toBeVisible();
      await expect(page.locator("#login-name")).toHaveValue("alex");
      await expect(page.locator("#login-pin")).toHaveValue("9999");
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  console.log("CODEVALID_TEST_ASSERTION_OK:login_progressive_retry_delay");
  await recorder.save(testInfo);
});
