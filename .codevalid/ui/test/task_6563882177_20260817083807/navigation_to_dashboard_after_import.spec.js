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

test("After successful import, user can navigate to dashboard", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "navigation_to_dashboard_after_import",
    testTitle: "After successful import, user can navigate to dashboard",
  });

  await recorder.step("Set authenticated session and completed import scenario");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "complete_after_start" });

  await recorder.step("Navigate to import page and complete a successful import flow");
  await page.goto("/rides/import");
  const csvPath = await createCsvFile(
    "complete.csv",
    "date,miles,notes\n2026-08-01,10.0,Commute\n"
  );
  await page.locator('#csv-upload-input').setInputFiles(csvPath);
  await page.getByRole("button", { name: "Preview Import" }).click();
  await page.getByRole("button", { name: "Start Import" }).click();

  await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go To Dashboard" })).toBeVisible();

  await recorder.step("Click Go To Dashboard and assert dashboard renders without errors");
  await page.getByRole("link", { name: "Go To Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:navigation_to_dashboard_after_import");
  await recorder.save(testInfo);
});
