import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupDuplicateNameFlow,
} from "../../helpers/mock-api.js";

test("signup_duplicate_normalized_name", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("signup_duplicate_normalized_name", "Signup fails when normalized name already exists");

  await recorder.step("clear session and register duplicate-name signup mock", async () => {
    await setupUnauthenticatedSession(page);
    await mockSignupDuplicateNameFlow(page, {
      duplicateMessage: "Name already exists",
    });
  });

  await recorder.step("open signup page", async () => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  await recorder.step("enter duplicate normalized name and pin", async () => {
    await page.locator("#signup-name").fill("JOHNDOE");
    await page.locator("#signup-pin").fill("5678");
  });

  await recorder.step("submit signup", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("verify duplicate-name error and no redirect", async () => {
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("Name already exists")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  await recorder.step("verify only rejection state was recorded", async () => {
    const signupState = await page.evaluate(() => window.__codevalidMockState?.signup);
    expect(signupState.requestCount).toBe(1);
    expect(signupState.createdUser).toBeNull();
    expect(signupState.eventEmitted).toBe(false);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_duplicate_normalized_name");
  await recorder.save(testInfo);
});
