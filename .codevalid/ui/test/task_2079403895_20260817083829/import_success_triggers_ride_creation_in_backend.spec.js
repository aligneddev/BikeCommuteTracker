import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
  mockPostImportDashboardAndHistory,
} from "../../helpers/mock-api.js";

test("Successfully imported rows persist with correct internal field mappings", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_success_triggers_ride_creation_in_backend",
    testTitle: "Successfully imported rows persist with correct internal field mappings",
  });

  await recorder.step("Arrange successful import plus downstream history/dashboard mocks", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "post_import_mapping_success",
    });
    await mockPostImportDashboardAndHistory(page);
  });

  await recorder.step("Import CSV with full direction name, difficulty, and notes", async () => {
    await page.goto("/rides/import");
    await page.locator("#csv-upload-input").setInputFiles({
      name: "post-import-mapping.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles,Difficulty,PrimaryTravelDirection,Notes\n2026-08-15,14.2,3,Southeast,Ride was great.\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
    await expect(page.getByText("Total rows: 1 | Valid rows: 1 | Invalid rows: 0")).toBeVisible();
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
  });

  await recorder.step("Navigate to dashboard after import completes", async () => {
    await page.getByRole("link", { name: "Go To Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your riding story, one screen." })).toBeVisible();
    await expect(page.getByText("Direction: SE")).toBeVisible();
    await expect(page.getByText("Difficulty: 3")).toBeVisible();
    await expect(page.getByText("Ride was great.")).toBeVisible();
  });

  await recorder.step("Navigate to ride history and verify normalized persisted values", async () => {
    await page.goto("/rides/history");
    await expect(page.getByRole("heading", { name: "Ride History" })).toBeVisible();
    await expect(page.getByText("Direction: SE")).toBeVisible();
    await expect(page.getByText("Difficulty: 3")).toBeVisible();
    await expect(page.getByText("Ride was great.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_success_triggers_ride_creation_in_backend");
  await recorder.save(testInfo);
});
