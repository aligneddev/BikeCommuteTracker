import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAuthenticatedSession,
  setupImportSampleCsvScenario,
} from "../../helpers/mock-api.js";

test("Download Sample CSV contains correct headers, sample rows, and legend", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("download_sample_csv_correct_structure", "Download Sample CSV contains correct headers, sample rows, and legend");

  await recorder.step("Seed authenticated session and sample CSV mock");
  await setupAuthenticatedSession(page);
  await setupImportSampleCsvScenario(page);

  const downloadDir = await fs.mkdtemp(path.join(os.tmpdir(), "codevalid-sample-csv-"));

  await recorder.step("Open Import Rides page");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();

  await recorder.step("Click Download sample CSV and capture download");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample CSV" }).click();
  const download = await downloadPromise;
  const targetPath = path.join(downloadDir, await download.suggestedFilename());
  await download.saveAs(targetPath);

  await recorder.step("Read downloaded CSV and verify structure");
  const csv = await fs.readFile(targetPath, "utf8");
  expect(csv).toContain("Date,Miles,Difficulty,PrimaryTravelDirection");
  expect(csv).toContain("2023-10-01,10.5,3,NE");
  expect(csv).toContain("# Difficulty: 1-5; Direction: N, NE, E, SE, S, SW, W, NW or full names like North, Northeast");

  console.log("CODEVALID_TEST_ASSERTION_OK:download_sample_csv_correct_structure");
  await recorder.save(testInfo);
});
