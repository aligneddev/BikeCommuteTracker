import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupUnauthenticatedSession,
  mockApiHealthNetworkCutoffAfterInitialSuccess,
} from "../../helpers/mock-api.js";

test("Error state displayed when network connection is blocked during polling", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "api_startup_network_failure_simulated",
    testTitle: testInfo.title,
  });

  await recorder.step("Install mocked clock and configure health endpoint to succeed once then fail");
  await page.clock.install();
  await setupUnauthenticatedSession(page);
  await mockApiHealthNetworkCutoffAfterInitialSuccess(page, { initialSuccessCount: 1 });

  await recorder.step("Open the application and verify the initial connecting state");
  await page.goto("/");
  await expect(page.getByText("Connecting…")).toBeVisible();

  await recorder.step("Advance through repeated failed checks after connectivity loss");
  await page.clock.fastForward(10050);

  await recorder.step("Verify timeout fallback error with retry action is shown");
  await expect(page.getByText("Connecting…")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect to BikeTracking API" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:api_startup_network_failure_simulated");
  await recorder.save(testInfo);
});
