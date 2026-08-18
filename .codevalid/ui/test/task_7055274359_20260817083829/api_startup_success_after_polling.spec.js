import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthBecomesReadyAfterDelay,
} from "../../helpers/mock-api.js";

test("Application proceeds to login when API becomes healthy", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_success_after_polling",
    testTitle: testInfo.title,
  });

  await recorder.step("Set up unauthenticated session and delayed health success");
  await setupUnauthenticatedSession(page);
  await mockApiHealthBecomesReadyAfterDelay(page, { delayMs: 3000 });

  await recorder.step("Open the application");
  await page.goto("/");

  await recorder.step("Verify connecting state appears before API is ready");
  await expect(page.getByText("Connecting…")).toBeVisible();

  await recorder.step("Wait for health polling to succeed and login page to appear");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Connecting…")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).not.toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_success_after_polling");
  await recorder.save(testInfo);
});
