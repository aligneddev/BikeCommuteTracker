import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockBrowserAccessibleApp,
  mockUnsupportedPwaEnvironment,
} from "../../helpers/mock-api.js";

test("System detects unsupported PWA environment and displays clear guidance", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "pwa_unsupported_environment_detection",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed an authenticated session and force unsupported-browser PWA state.");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockBrowserAccessibleApp(page);
  await mockUnsupportedPwaEnvironment(page, { reasonCode: "unsupported_browser" });

  await recorder.step("Open Settings where install guidance is shown.");
  await page.goto("/settings");

  await recorder.step("Verify unsupported install guidance is displayed and browser mode remains usable.");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  await expect(
    page.getByText("Installation is not available in this browser in v1. Use current Chrome or Edge on Windows, or continue using browser mode.")
  ).toBeVisible();
  await expect(page.getByText(/Current mode: Browser tab/)).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:pwa_unsupported_environment_detection");
  await recorder.save(testInfo);
});
