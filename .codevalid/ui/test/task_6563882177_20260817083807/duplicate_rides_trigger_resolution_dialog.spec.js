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

test("Duplicate ride entries trigger the DuplicateResolutionDialog for user review", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "duplicate_rides_trigger_resolution_dialog",
    testTitle: "Duplicate ride entries trigger the DuplicateResolutionDialog for user review",
  });

  await recorder.step("Register authenticated session and duplicate preview scenario");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "duplicate_requires_resolution" });

  await recorder.step("Open Import Rides page and upload duplicate CSV");
  await page.goto("/rides/import");
  const csvPath = await createCsvFile(
    "duplicates.csv",
    "date,miles,notes\n2026-08-01,12.0,Duplicate commute\n"
  );
  await page.locator('#csv-upload-input').setInputFiles(csvPath);
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Start import and verify duplicate resolution dialog opens");
  await page.getByRole("button", { name: "Start Import" }).click();

  await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toBeVisible();
  await expect(page.getByText(/duplicate row requires a decision before import can start/i)).toBeVisible();
  await expect(page.getByText(/Incoming ride:/)).toBeVisible();
  await expect(page.getByText(/Existing ride #/)).toBeVisible();
  await expect(page.getByText("Override all duplicates")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Import" })).toBeDisabled();

  await recorder.step("Verify duplicate controls are interactive");
  await page.getByLabel(/Row 2 keep existing/i).check();
  await expect(page.getByRole("button", { name: "Start Import" })).toBeEnabled();
  await page.getByText("Override all duplicates").click();
  await expect(page.getByRole("button", { name: "Start Import" })).toBeEnabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:duplicate_rides_trigger_resolution_dialog");
  await recorder.save(testInfo);
});
