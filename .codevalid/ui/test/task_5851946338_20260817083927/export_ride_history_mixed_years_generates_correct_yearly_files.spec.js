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

test("Export Ride History with rides across multiple years generates separate CSVs per year", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_ride_history_mixed_years_generates_correct_yearly_files",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and multi-year ride history ZIP export", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockRideHistoryExport(page, {
      entries: {
        "2023.csv": [
          "RideDate,Distance,StartLocation,Notes,CreatedAtUtc",
          '2023-03-10,5.1,"Home","2023 only",2023-03-10T12:00:00.000Z',
        ].join("\n"),
        "2024.csv": [
          "RideDate,Distance,StartLocation,Notes,CreatedAtUtc",
          '2024-08-11,7.8,"Office","2024 only",2024-08-11T12:00:00.000Z',
        ].join("\n"),
      },
      fileName: "ride-history-export.zip",
    });
  });

  await recorder.step("Open Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Export Ride History" })).toBeVisible();
  });

  let download;

  await recorder.step("Trigger export and wait for ZIP", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Ride History" }).click(),
    ]);
  });

  await recorder.step("Extract ZIP and verify rides stay in their correct year files", async () => {
    const zipPath = await download.path();
    const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "ride-export-years-"));
    await execFileAsync("python3", ["-c", "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zipPath, extractDir]);

    const files = (await fs.readdir(extractDir)).sort();
    await expect(files).toEqual(["2023.csv", "2024.csv"]);

    const csv2023 = await fs.readFile(path.join(extractDir, "2023.csv"), "utf-8");
    const csv2024 = await fs.readFile(path.join(extractDir, "2024.csv"), "utf-8");

    await expect(csv2023).toContain("2023-03-10");
    await expect(csv2023).not.toContain("2024-08-11");
    await expect(csv2024).toContain("2024-08-11");
    await expect(csv2024).not.toContain("2023-03-10");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_ride_history_mixed_years_generates_correct_yearly_files");
  await recorder.save(testInfo);
});
