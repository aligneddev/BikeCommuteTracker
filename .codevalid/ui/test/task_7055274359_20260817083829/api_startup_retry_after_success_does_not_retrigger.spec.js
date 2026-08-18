import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthBecomesReadyAfterDelay,
} from "../../helpers/mock-api.js";

test("Retry button is not shown if API becomes healthy before timeout", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_retry_after_success_does_not_retrigger",
    testTitle: testInfo.title,
  });

  await recorder.step("Set up unauthenticated session and health success before timeout");
  await setupUnauthenticatedSession(page);
  await mockApiHealthBecomesReadyAfterDelay(page, { delayMs: 3000 });

  await recorder.step("Open the application");
  await page.goto("/");

  await recorder.step("Verify spinner appears initially");
  await expect(page.getByText("Connecting…")).toBeVisible();

  await recorder.step("Wait for login page to render before timeout");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Connecting…")).not.toBeVisible();

  await recorder.step("Confirm retry action never appears after successful readiness");
  await page.waitForTimeout(6500);
  await expect(page.getByRole("button", { name: "Retry" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_retry_after_success_does_not_retrigger");
  await recorder.save(testInfo);
});
