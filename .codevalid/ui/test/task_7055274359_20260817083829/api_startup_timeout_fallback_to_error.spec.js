import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthAlwaysFails,
} from "../../helpers/mock-api.js";

test("Error state with Retry button appears after 10 seconds of failed health checks", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_timeout_fallback_to_error",
    testTitle: testInfo.title,
  });

  await recorder.step("Install mocked clock, unauthenticated session, and failing health responses");
  await page.clock.install();
  await setupUnauthenticatedSession(page);
  await mockApiHealthAlwaysFails(page);

  await recorder.step("Open the application");
  await page.goto("/");

  await recorder.step("Advance mocked time through the 10-second polling window");
  await expect(page.getByText("Connecting…")).toBeVisible();
  await page.clock.fastForward(10050);

  await recorder.step("Verify error state and retry action are displayed");
  await expect(page.getByText("Connecting…")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();
  await expect(page.getByText(/The app was unable to start the local API after 10 seconds\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeEnabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_timeout_fallback_to_error");
  await recorder.save(testInfo);
});
