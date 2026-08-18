import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockCoreFeatureRoutes,
} from "../../helpers/mock-api.js";
import { setupRideImportScenario } from "../../helpers/ride-import-mock-api.js";

async function createCsvFile(name, content) {
  const filePath = path.join(os.tmpdir(), `${Date.now()}-${name}`);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("Import progress panel displays real-time progress during ride import", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_progress_shown_during_processing",
    testTitle: "Import progress panel displays real-time progress during ride import",
  });

  await recorder.step("Register authenticated session and processing import scenario");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "processing_after_start" });

  await recorder.step("Open Import Rides page");
  await page.goto("/rides/import");

  const csvPath = await createCsvFile(
    "progress-rides.csv",
    "date,miles,notes\n2026-08-01,10.0,Commute\n2026-08-02,9.5,Return\n"
  );

  await recorder.step("Upload CSV and preview import");
  await page.locator('#csv-upload-input').setInputFiles(csvPath);
  await page.getByRole("button", { name: "Preview Import" }).click();

  await expect(page.getByRole("heading", { name: "Preview Summary" })).toBeVisible();

  await recorder.step("Start import and verify progress panel contents");
  await page.getByRole("button", { name: "Start Import" }).click();

  await expect(page.getByRole("heading", { name: "Import Progress" })).toBeVisible();
  await expect(page.getByText("Status: processing")).toBeVisible();
  await expect(page.getByText("Complete: 50%")).toBeVisible();
  await expect(page.getByText(/ETA:/)).toBeVisible();
  await expect(page.getByText("Imported: 1")).toBeVisible();
  await expect(page.getByText("Skipped: 0")).toBeVisible();
  await expect(page.getByText("Failed: 0")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel Import" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:import_progress_shown_during_processing");
  await recorder.save(testInfo);
});
