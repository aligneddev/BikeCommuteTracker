import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
} from "../../helpers/mock-api.js";

test("Export Ride History button is visible and labeled clearly", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_ride_history_button_visible",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and settings mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
  });

  await recorder.step("Load the Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible();
  });

  await recorder.step("Locate the Export Ride History control", async () => {
    await expect(page.getByRole("button", { name: "Export Ride History" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Ride History" })).toBeEnabled();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_ride_history_button_visible");
  await recorder.save(testInfo);
});
