import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import CSV with all optional fields correctly filled", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_valid_csv_with_all_fields",
    testTitle: "Import CSV with all optional fields correctly filled",
  });

  await recorder.step("Arrange authenticated session and valid import scenario", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "valid_all_fields",
    });
  });

  await recorder.step("Open import page", async () => {
    await page.goto("/rides/import");
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  });

  await recorder.step("Upload valid CSV file", async () => {
    await page.locator("#csv-upload-input").setInputFiles({
      name: "valid-all-fields.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles,Difficulty,PrimaryTravelDirection,Notes\n2026-08-01,12.5,3,North,Morning ride\n2026-08-02,8.1,5,SE,Strong headwind but manageable\n"),
    });
    await expect(page.getByText("Selected file: valid-all-fields.csv")).toBeVisible();
  });

  await recorder.step("Preview and start import", async () => {
    await page.getByRole("button", { name: "Preview Import" }).click();
    await expect(page.getByText("Total rows: 2 | Valid rows: 2 | Invalid rows: 0")).toBeVisible();
    await page.getByRole("button", { name: "Start Import" }).click();
  });

  await recorder.step("Verify successful import completion", async () => {
    await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
    await expect(page.getByText("2 rides were imported successfully.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go To Dashboard" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_valid_csv_with_all_fields");
  await recorder.save(testInfo);
});
