import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import CSV with blank values in optional fields", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_blank_optional_fields",
    testTitle: "Import CSV with blank values in optional fields",
  });

  await recorder.step("Arrange blank optional fields scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "blank_optional_fields",
    });
  });

  await recorder.step("Navigate to import page and upload CSV", async () => {
    await page.goto("/rides/import");
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
    await page.locator("#csv-upload-input").setInputFiles({
      name: "blank-optionals.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles,Difficulty,PrimaryTravelDirection,Notes\n2026-08-10,7.0,,,\n2026-08-11,7.5,,,\n"),
    });
  });

  await recorder.step("Preview then start import", async () => {
    await page.getByRole("button", { name: "Preview Import" }).click();
    await expect(page.getByText("Total rows: 2 | Valid rows: 2 | Invalid rows: 0")).toBeVisible();
    await page.getByRole("button", { name: "Start Import" }).click();
  });

  await recorder.step("Verify all rows imported successfully", async () => {
    await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
    await expect(page.getByText("2 rides were imported successfully.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_blank_optional_fields");
  await recorder.save(testInfo);
});
