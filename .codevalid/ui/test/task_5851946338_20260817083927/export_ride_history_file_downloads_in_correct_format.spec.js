import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
  mockRideHistoryExport,
} from "../../helpers/mock-api.js";

test("Export Ride History results in a downloadable ZIP file with correct filename", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_ride_history_file_downloads_in_correct_format",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and ride history export download mock", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockRideHistoryExport(page, {
      entries: {
        "2024.csv": "RideDate,Distance,StartLocation,Notes,CreatedAtUtc\n2024-01-01,10,Home,,2024-01-01T12:00:00.000Z\n",
      },
      fileName: "ride-history-export.zip",
    });
  });

  await recorder.step("Open Settings page", async () => {
    await page.goto("/settings");
  });

  await recorder.step("Trigger export and verify downloaded ZIP filename format", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Ride History" }).click(),
    ]);

    await expect(download.suggestedFilename()).toBe("ride-history-export.zip");
    await expect(download.suggestedFilename().endsWith(".zip")).toBeTruthy();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_ride_history_file_downloads_in_correct_format");
  await recorder.save(testInfo);
});
