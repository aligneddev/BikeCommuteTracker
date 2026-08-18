import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import { setupAuthenticatedSession, setupHealthyStartupGuard } from "../../helpers/mock-api.js";

test("download_sample_csv", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "download_sample_csv",
    testTitle: "User can download sample CSV with legend and supported columns",
  });

  await setupHealthyStartupGuard(page);
  await setupAuthenticatedSession(page);

  const sampleCsv = [
    "# Valid Difficulty: 1–5. Accepted Directions: N, NE, E, SE, S, SW, W, NW or full names. Notes ≤ 500 chars.",
    "Date,Miles,Minutes,Temperature,WindSpeed,PrimaryTravelDirection,Difficulty,Notes",
    '2024-05-01T08:00:00,12.4,38,64,7,NE,3,"Morning commute"',
  ].join("\n");

  await page.route("**/api/rides/csv-sample", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/csv",
      body: sampleCsv,
    });
  });

  await recorder.step("Navigate to Import Rides as an authenticated user.");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Download the sample CSV.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("ride-import-sample.csv");

  await recorder.step("Open the downloaded file contents and validate the legend and sample row.");
  const fileText = await download.path().then(async (filePath) => {
    const fs = await import("node:fs/promises");
    return fs.readFile(filePath, "utf8");
  });

  expect(fileText).toContain("# Valid Difficulty: 1–5. Accepted Directions: N, NE, E, SE, S, SW, W, NW or full names. Notes ≤ 500 chars.");
  expect(fileText).toContain("Date,Miles,Minutes,Temperature,WindSpeed,PrimaryTravelDirection,Difficulty,Notes");
  expect(fileText).toContain('2024-05-01T08:00:00,12.4,38,64,7,NE,3,"Morning commute"');

  console.log("CODEVALID_TEST_ASSERTION_OK:download_sample_csv");
  await recorder.save(testInfo);
});
