import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupImportPageSession,
  mockImportPageShell,
  setupRideImportScenario,
} from "../../helpers/mock-api.js";

test("Import CSV that omits one or more optional columns", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "import_csv_missing_optional_columns",
    testTitle: "Import CSV that omits one or more optional columns",
  });

  await recorder.step("Arrange scenario with missing optional columns accepted", async () => {
    await setupImportPageSession(page);
    await mockImportPageShell(page);
    await setupRideImportScenario(page, {
      scenario: "missing_optional_columns",
    });
  });

  await recorder.step("Open import page", async () => {
    await page.goto("/rides/import");
    await expect(page.getByRole("heading", { name: "Import Rides" })).toBeVisible();
  });

  await recorder.step("Upload CSV missing optional columns", async () => {
    await page.locator("#csv-upload-input").setInputFiles({
      name: "missing-optional-columns.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Miles\n2026-07-01,10.2\n2026-07-02,9.8\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("Start import and verify success", async () => {
    await expect(page.getByText("Total rows: 2 | Valid rows: 2 | Invalid rows: 0")).toBeVisible();
    await page.getByRole("button", { name: "Start Import" }).click();
    await expect(page.getByRole("heading", { name: "Import Complete" })).toBeVisible();
    await expect(page.getByText("2 rides were imported successfully.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:import_csv_missing_optional_columns");
  await recorder.save(testInfo);
});
