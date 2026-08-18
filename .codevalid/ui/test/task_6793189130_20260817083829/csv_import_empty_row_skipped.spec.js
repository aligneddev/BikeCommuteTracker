import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_empty_row_skipped", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_empty_row_skipped", "CSV contains empty rows that are automatically skipped");

  await recorder.step("Set authenticated session and empty-row-skipping preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "empty_rows_skipped" });

  await recorder.step("Upload CSV with blank lines.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "blank-lines.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,12.50,One\n\n05/02/2024,8.25,Two\n   \n05/03/2024,20.00,Three\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify only non-empty rows are counted.");
  await expect(page.getByText("Total rows: 3")).toBeVisible();
  await expect(page.getByText("Valid rows: 3")).toBeVisible();
  await expect(page.getByText("Invalid rows: 0")).toBeVisible();
  await expect(page.getByText("Duplicate rows: 0")).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_empty_row_skipped");
  await recorder.save(testInfo);
});
