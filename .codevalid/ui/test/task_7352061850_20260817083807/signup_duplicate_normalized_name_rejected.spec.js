import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockSignupDuplicateName,
} from "../../helpers/mock-api.js";

test("signup_duplicate_normalized_name_rejected", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "signup_duplicate_normalized_name_rejected",
    testTitle: "Signup with duplicate normalized name is rejected with clear message",
  });

  await setupUnauthenticatedSession(page);
  await mockSignupDuplicateName(page, { message: "name already exists" });

  await recorder.step("Open signup page", async () => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/signup$/);
  });

  await recorder.step("Enter duplicate normalized name and valid PIN", async () => {
    await page.locator("#signup-name").fill("ALEX");
    await page.locator("#signup-pin").fill("5678");
  });

  await recorder.step("Submit signup form", async () => {
    await page.getByRole("button", { name: "Create account" }).click();
  });

  await recorder.step("Verify duplicate-name error and retained form values", async () => {
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("name already exists")).toBeVisible();
    await expect(page.locator("#signup-name")).toHaveValue("ALEX");
    await expect(page.locator("#signup-pin")).toHaveValue("5678");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:signup_duplicate_normalized_name_rejected");
  await recorder.save(testInfo);
});
