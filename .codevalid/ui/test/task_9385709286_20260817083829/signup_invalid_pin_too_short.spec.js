import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  trackSignupRequests,
} from "../../helpers/mock-api.js";

test("signup_invalid_pin_too_short", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_invalid_pin_too_short", "Signup fails when PIN is less than 4 characters");

  await recorder.step("clear session and watch for unexpected signup requests", async () => {
    await setupUnauthenticatedSession(page);
    await trackSignupRequests(page);
  });

  await recorder.step("open signup page", async () => {
    await page.goto("/signup");
  });

  await recorder.step("enter name and too-short pin", async () => {
    await page.locator("#signup-name").fill("Alice");
    await page.locator("#signup-pin").fill("123");
  });

  await recorder.step("submit signup", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("verify client-side validation and no API request", async () => {
    await expect(page.getByText("PIN must be numeric and 4 to 8 digits long.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
    const signupState = await page.evaluate(() => window.__codevalidMockState?.signup);
    expect(signupState.requestCount).toBe(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_invalid_pin_too_short");
  await recorder.save(testInfo);
});
