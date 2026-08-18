import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_invalid_date_format", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_invalid_date_format", "CSV contains date in unsupported format (DD-MMM-YYYY)");

  await recorder.step("Set authenticated session and invalid date preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "invalid_date_format" });

  await recorder.step("Upload CSV with unsupported date format.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "invalid-date.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n10-May-2024,45.00,Unsupported\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify row is rejected.");
  await expect(page.getByText("Invalid rows: 1")).toBeVisible();
  await expect(page.getByText("Row 2: Date format not recognized. Use MM/DD/YYYY or YYYY-MM-DD.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeDisabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_invalid_date_format");
  await recorder.save(testInfo);
});
