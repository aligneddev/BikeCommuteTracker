import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_missing_required_column_date", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_missing_required_column_date", "CSV file is missing the required 'Date' column");

  await recorder.step("Set authenticated session and missing-Date preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "missing_date_column" });

  await recorder.step("Open expense import page and upload CSV.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "missing-date.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Amount,Note\n12.50,Tire sealant\n"),
  });

  await recorder.step("Preview headers validation.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("Valid rows: 0")).toBeVisible();
  await expect(page.getByText("Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 1: Required column missing: Date.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeDisabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_missing_required_column_date");
  await recorder.save(testInfo);
});
