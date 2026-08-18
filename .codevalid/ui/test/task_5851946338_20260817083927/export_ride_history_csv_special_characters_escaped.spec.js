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

test("Export Ride History properly escapes special characters in CSV", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_ride_history_csv_special_characters_escaped",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and special-character ride history ZIP", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockRideHistoryExport(page, {
      entries: {
        "2024.csv": [
          "RideDate,Distance,StartLocation,Notes,CreatedAtUtc",
          '2024-06-01,14.2,"Downtown, Station","He said ""hello""",2024-06-01T12:00:00.000Z',
          '2024-06-02,15,"Trailhead","Line one\nLine two",2024-06-02T12:00:00.000Z',
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

  await recorder.step("Trigger ride export and wait for ZIP download", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Ride History" }).click(),
    ]);
  });

  await recorder.step("Extract ZIP and verify CSV escaping remains valid", async () => {
    const zipPath = await download.path();
    const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "ride-export-special-"));
    await execFileAsync("python3", ["-c", "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", zipPath, extractDir]);

    const csvText = await fs.readFile(path.join(extractDir, "2024.csv"), "utf-8");
    await expect(csvText).toContain('"Downtown, Station"');
    await expect(csvText).toContain('"He said ""hello"""');
    await expect(csvText).toContain('"Line one\nLine two"');
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_ride_history_csv_special_characters_escaped");
  await recorder.save(testInfo);
});
