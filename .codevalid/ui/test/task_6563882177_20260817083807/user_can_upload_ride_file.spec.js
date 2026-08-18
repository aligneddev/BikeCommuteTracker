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

test("User can select and upload a ride file for import", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "user_can_upload_ride_file",
    testTitle: "User can select and upload a ride file for import",
  });

  await recorder.step("Set authenticated session and idle import mocks");
  await setupBikeTrackingAuthenticatedSession(page);
  await mockCoreFeatureRoutes(page);
  await setupRideImportScenario(page, { scenario: "idle" });

  await recorder.step("Navigate to Import Rides page");
  await page.goto("/rides/import");

  const csvPath = await createCsvFile(
    "rides.csv",
    "date,miles,notes\n2026-08-01,12.5,Morning commute\n"
  );

  await recorder.step("Select a valid CSV ride file from the local filesystem");
  await page.locator('#csv-upload-input').setInputFiles(csvPath);

  await recorder.step("Assert selected filename is shown and preview action remains available");
  await expect(page.getByText("Selected file: rides.csv")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview Import" })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  console.log("CODEVALID_TEST_ASSERTION_OK:user_can_upload_ride_file");
  await recorder.save(testInfo);
});
