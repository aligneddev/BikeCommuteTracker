import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_missing_required_column_amount", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_missing_required_column_amount", "CSV file is missing the required 'Amount' column");

  await recorder.step("Set authenticated session and missing-Amount preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "missing_amount_column" });

  await recorder.step("Open expense import page and upload CSV.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "missing-amount.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Note\n05/01/2024,Tire sealant\n"),
  });

  await recorder.step("Preview headers validation.");
  await page.getByRole("button", { name: "Preview Import" }).click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("Valid rows: 0")).toBeVisible();
  await expect(page.getByText("Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 1: Required column missing: Amount.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeDisabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_missing_required_column_amount");
  await recorder.save(testInfo);
});
