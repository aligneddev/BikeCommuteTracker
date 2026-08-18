import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  mockSampleCsvDownload,
} from "../../helpers/mock-api.js";

test("Download Sample CSV returns file with correct columns and legend", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "download_sample_csv_returns_correct_format",
    testTitle: "Download Sample CSV returns file with correct columns and legend",
  });

  await recorder.step("Arrange authenticated import page and sample CSV download mock", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await mockSampleCsvDownload(page);
  });

  let download;
  await recorder.step("Open the import rides page", async () => {
    await page.goto("/rides/import");
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
    await expect(page.getByText("No file selected.")).toBeVisible();
  });

  await recorder.step("Click Download sample CSV and wait for download", async () => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download sample CSV" }).click();
    download = await downloadPromise;
  });

  await recorder.step("Read downloaded CSV and verify columns, legend, and sample rows", async () => {
    expect(download.suggestedFilename()).toBe("ride-import-sample.csv");
    const filePath = await download.path();
    const csvText = await fs.readFile(filePath, "utf-8");

    expect(csvText).toContain("Difficulty: 1-5");
    expect(csvText).toContain("PrimaryTravelDirection/Direction: valid values are N, NE, E, SE, S, SW, W, NW or North, Northeast, East, Southeast, South, Southwest, West, Northwest");
    expect(csvText).toContain("Notes: max 500 characters");
    expect(csvText).toContain("Difficulty");
    expect(csvText).toContain("PrimaryTravelDirection");
    expect(csvText).toContain("Notes");
    expect(csvText).toContain("Morning commute");
    expect(csvText.split("\n")[0].trim().startsWith("#")).toBeTruthy();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:download_sample_csv_returns_correct_format");
  await recorder.save(testInfo);
});
