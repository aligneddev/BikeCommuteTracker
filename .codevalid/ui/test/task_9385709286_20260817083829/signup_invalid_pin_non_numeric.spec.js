import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  trackSignupRequests,
} from "../../helpers/mock-api.js";

test("signup_invalid_pin_non_numeric", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_invalid_pin_non_numeric", "Signup fails when PIN contains non-numeric characters");

  await recorder.step("clear session and watch for unexpected signup requests", async () => {
    await setupUnauthenticatedSession(page);
    await trackSignupRequests(page);
  });

  await recorder.step("open signup page", async () => {
    await page.goto("/signup");
  });

  await recorder.step("enter name and non-numeric pin", async () => {
    await page.locator("#signup-name").fill("Charlie");
    await page.locator("#signup-pin").fill("abc123");
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

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_invalid_pin_non_numeric");
  await recorder.save(testInfo);
});
