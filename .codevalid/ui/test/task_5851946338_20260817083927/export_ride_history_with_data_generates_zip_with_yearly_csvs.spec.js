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

test("Export Ride History generates ZIP with yearly CSV files", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_ride_history_with_data_generates_zip_with_yearly_csvs",
    testTitle: testInfo.title,
  });

  const zipEntries = {
    "2023.csv": [
      "RideDate,Distance,StartLocation,Notes,CreatedAtUtc",
      '2023-05-01,12.5,"Office","Sunny morning",2023-05-01T12:00:00.000Z',
    ].join("\n"),
    "2024.csv": [
      "RideDate,Distance,StartLocation,Notes,CreatedAtUtc",
      '2024-01-10,8.2,"Home","Cold ride",2024-01-10T12:00:00.000Z',
      '2024-07-04,20,"Trailhead","Holiday ride",2024-07-04T12:00:00.000Z',
    ].join("\n"),
  };

  await recorder.step("Arrange authenticated session, settings page, and ride history export mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockRideHistoryExport(page, {
      entries: zipEntries,
      fileName: "ride-history-export.zip",
    });
  });

  await recorder.step("Open the Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Export Ride History" })).toBeVisible();
  });

  let download;
  let extractDir;

  await recorder.step("Click Export Ride History and wait for the ZIP download", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Ride History" }).click(),
    ]);
    await expect(download.suggestedFilename()).toBe("ride-history-export.zip");
  });

  await recorder.step("Extract the downloaded ZIP and validate yearly CSV files", async () => {
    const zipPath = await download.path();
    extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "ride-export-"));
    await execFileAsync("python3", ["-c", "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zipPath, extractDir]);

    const files = (await fs.readdir(extractDir)).sort();
    await expect(files).toEqual(["2023.csv", "2024.csv"]);

    const csv2023 = await fs.readFile(path.join(extractDir, "2023.csv"), "utf-8");
    const csv2024 = await fs.readFile(path.join(extractDir, "2024.csv"), "utf-8");

    await expect(csv2023).toContain("RideDate,Distance,StartLocation,Notes,CreatedAtUtc");
    await expect(csv2023).toContain('2023-05-01,12.5,"Office","Sunny morning",2023-05-01T12:00:00.000Z');
    await expect(csv2024).toContain('2024-01-10,8.2,"Home","Cold ride",2024-01-10T12:00:00.000Z');
    await expect(csv2024).toContain('2024-07-04,20,"Trailhead","Holiday ride",2024-07-04T12:00:00.000Z');
    await expect(csv2023).not.toContain("Total");
    await expect(csv2024).not.toContain("Subtotal");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_ride_history_with_data_generates_zip_with_yearly_csvs");
  await recorder.save(testInfo);
});
