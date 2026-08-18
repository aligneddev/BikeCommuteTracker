import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockBrowserAccessibleApp,
  mockUnsupportedPwaEnvironment,
  mockRecordRideScenario,
} from "../../helpers/mock-api.js";

test("Core functionality remains fully accessible even when PWA installation is unavailable", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "core_features_functional_without_pwa",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed authenticated browser-mode state, unsupported PWA install state, and ride APIs.");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockBrowserAccessibleApp(page);
  await mockUnsupportedPwaEnvironment(page, { reasonCode: "unsupported_os" });
  await mockRecordRideScenario(page);

  await recorder.step("Verify settings page still works and shows unsupported install guidance.");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByText("Installation is not available on this operating system in v1. Continue using browser mode.")
  ).toBeVisible();

  await recorder.step("Navigate to ride recording and submit a ride successfully.");
  await page.goto("/rides/record");
  await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  await page.locator("#miles").fill("12.4");
  await page.locator("#rideMinutes").fill("48");
  await page.getByRole("button", { name: "Record Ride" }).click();
  await expect(page.getByText(/Ride recorded successfully/)).toBeVisible();

  await recorder.step("Navigate to dashboard and import page to confirm core flows remain accessible.");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:core_features_functional_without_pwa");
  await recorder.save(testInfo);
});
