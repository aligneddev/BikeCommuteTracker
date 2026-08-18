import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockBrowserAccessibleApp,
  mockCoreFeatureRoutes,
} from "../../helpers/mock-api.js";

test("All core features are fully accessible without installation via supported browser", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "in_browser_usage_all_features_accessible",
    testTitle: testInfo.title,
  });

  await recorder.step("Seed an authenticated BikeTracking session and register browser-mode API mocks.");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockBrowserAccessibleApp(page);
  await mockCoreFeatureRoutes(page);

  await recorder.step("Open the dashboard directly to verify browser-only access works.");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();

  await recorder.step("Navigate to record ride page and verify the form is available.");
  await page.goto("/rides/record");
  await expect(page.getByRole("heading", { name: "Record a Ride" })).toBeVisible();
  await expect(page.locator("#miles")).toBeVisible();

  await recorder.step("Navigate to settings and verify install and export areas are available in browser mode.");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();
  await expect(page.getByPlaceholder("Enter EIA API key to enable gas price lookup")).toBeVisible();
  await expect(page.getByPlaceholder("Optional — leave blank to use free tier")).toBeVisible();

  await recorder.step("Navigate to import rides and confirm the import flow remains accessible.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:in_browser_usage_all_features_accessible");
  await recorder.save(testInfo);
});
