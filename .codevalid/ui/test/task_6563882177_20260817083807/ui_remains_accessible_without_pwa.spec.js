import { test, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  mockUnsupportedPwaEnvironment,
  mockCoreFeatureRoutes,
} from "../../helpers/mock-api.js";
import { setupRideImportScenario } from "../../helpers/ride-import-mock-api.js";

async function createCsvFile(name, content) {
  const filePath = path.join(os.tmpdir(), `${Date.now()}-${name}`);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

test("PWA-unavailable environment does not block or degrade UI functionality on ImportRidesPage", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "ui_remains_accessible_without_pwa",
    testTitle: "PWA-unavailable environment does not block or degrade UI functionality on ImportRidesPage",
  });

  await recorder.step("Set browser session and unsupported PWA environment");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockUnsupportedPwaEnvironment(page, { reasonCode: "safari_not_supported" });
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "duplicate_requires_resolution" });

  await recorder.step("Navigate to import page and verify the page remains usable");
  await page.goto("/rides/import");
  await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Import" })).toBeEnabled();
  await expect(page.getByText(/PWA installation is not supported/i)).toHaveCount(0);

  const csvPath = await createCsvFile(
    "browser-mode.csv",
    "date,miles,notes\n2026-08-01,12.0,Duplicate commute\n"
  );

  await recorder.step("Upload a file and start the import workflow in browser mode");
  await page.locator('#csv-upload-input').setInputFiles(csvPath);
  await expect(page.getByText("Selected file: browser-mode.csv")).toBeVisible();
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("heading", { name: "Preview Summary" })).toBeVisible();
  await page.getByRole("button", { name: "Start Import" }).click();

  await recorder.step("Verify duplicate resolution still functions normally without PWA support");
  await expect(page.getByRole("heading", { name: "Resolve duplicates" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByText("Override all duplicates").click();
  await expect(page.getByRole("button", { name: "Start Import" })).toBeEnabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:ui_remains_accessible_without_pwa");
  await recorder.save(testInfo);
});
