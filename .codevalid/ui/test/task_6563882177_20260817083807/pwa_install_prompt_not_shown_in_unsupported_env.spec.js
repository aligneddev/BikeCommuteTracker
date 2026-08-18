import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockBrowserAccessibleApp,
  mockUnsupportedPwaEnvironment,
} from "../../helpers/mock-api.js";

test("PWA install prompt is suppressed when environment does not support it", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "pwa_install_prompt_not_shown_in_unsupported_env",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed an authenticated session and force unsupported PWA install state.");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockBrowserAccessibleApp(page);
  await mockUnsupportedPwaEnvironment(page, { reasonCode: "unsupported_browser" });

  await recorder.step("Open settings and observe install controls.");
  await page.goto("/settings");

  await recorder.step("Verify unsupported guidance is shown instead of an install button or prompt UI.");
  await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  await expect(
    page.getByText("Installation is not available in this browser in v1. Use current Chrome or Edge on Windows, or continue using browser mode.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Install on this computer" })).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:pwa_install_prompt_not_shown_in_unsupported_env");
  await recorder.save(testInfo);
});
