import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_invalid_amount_zero", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_invalid_amount_zero", "CSV contains a row with zero amount");

  await recorder.step("Set authenticated session and zero amount preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "zero_amount" });

  await recorder.step("Upload CSV with zero amount.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "zero.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,0.00,Free?\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify validation message and disabled confirmation.");
  await expect(page.getByText("Total rows: 1")).toBeVisible();
  await expect(page.getByText("Valid rows: 0")).toBeVisible();
  await expect(page.getByText("Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 2: Amount must be greater than zero.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeDisabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_invalid_amount_zero");
  await recorder.save(testInfo);
});
