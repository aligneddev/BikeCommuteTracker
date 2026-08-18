import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
  mockRideHistoryExport,
} from "../../helpers/mock-api.js";

const execFileAsync = promisify(execFile);

test("Export Ride History with no rides generates ZIP with header-only CSV", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_ride_history_no_data_generates_zip_with_header_only_csv",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session, settings page, and empty ride history export mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockRideHistoryExport(page, {
      entries: {
        "2024.csv": "RideDate,Distance,StartLocation,Notes,CreatedAtUtc\n",
      },
      fileName: "ride-history-export.zip",
    });
  });

  await recorder.step("Open the Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Export Ride History" })).toBeVisible();
  });

  let download;

  await recorder.step("Click Export Ride History and wait for the ZIP download", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Ride History" }).click(),
    ]);
    await expect(download.suggestedFilename()).toBe("ride-history-export.zip");
  });

  await recorder.step("Extract the ZIP and validate the single header-only CSV", async () => {
    const zipPath = await download.path();
    const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "ride-export-empty-"));
    await execFileAsync("python3", ["-c", "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zipPath, extractDir]);

    const files = await fs.readdir(extractDir);
    await expect(files).toHaveLength(1);
    await expect(files[0]).toBe("2024.csv");

    const csvText = await fs.readFile(path.join(extractDir, "2024.csv"), "utf-8");
    await expect(csvText.trimEnd()).toBe("RideDate,Distance,StartLocation,Notes,CreatedAtUtc");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_ride_history_no_data_generates_zip_with_header_only_csv");
  await recorder.save(testInfo);
});
