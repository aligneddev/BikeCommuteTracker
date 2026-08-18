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

test("User can cancel the import process at any stage and return to import screen", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "user_can_cancel_import_mid_flow",
    testTitle: "User can cancel the import process at any stage and return to import screen",
  });

  await recorder.step("Prepare authenticated import scenario that can be cancelled from duplicate dialog");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "duplicate_requires_resolution" });

  await recorder.step("Open page, upload file, preview, and open duplicate resolution dialog");
  await page.goto("/rides/import");
  const csvPath = await createCsvFile(
    "cancel-flow.csv",
    "date,miles,notes\n2026-08-01,12.0,Duplicate commute\n"
  );
  await page.locator('#csv-upload-input').setInputFiles(csvPath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await page.getByRole("button", { name: "Start Import" }).click();
  await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toBeVisible();

  await recorder.step("Cancel duplicate resolution and verify import state resets");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toHaveCount(0);
  await expect(page.getByText("No file selected.")).toBeVisible();
  await expect(page.getByText("Start an import to see progress and cancellation controls.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import Progress" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview Import" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:user_can_cancel_import_mid_flow");
  await recorder.save(testInfo);
});
