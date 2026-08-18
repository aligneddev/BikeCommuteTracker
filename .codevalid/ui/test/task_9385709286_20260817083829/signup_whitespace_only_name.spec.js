import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  trackSignupRequests,
} from "../../helpers/mock-api.js";

test("signup_whitespace_only_name", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_whitespace_only_name", "Signup fails when name field contains only whitespace");

  await recorder.step("clear session and watch for unexpected signup requests", async () => {
    await setupUnauthenticatedSession(page);
    await trackSignupRequests(page);
  });

  await recorder.step("open signup page", async () => {
    await page.goto("/signup");
  });

  await recorder.step("enter whitespace-only name and pin", async () => {
    await page.locator("#signup-name").fill("   ");
    await page.locator("#signup-pin").fill("5678");
  });

  await recorder.step("submit signup", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("verify trimmed-empty validation and no API request", async () => {
    await expect(page.getByText("Name is required.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
    const signupState = await page.evaluate(() => window.__codevalidMockState?.signup);
    expect(signupState.requestCount).toBe(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_whitespace_only_name");
  await recorder.save(testInfo);
});
