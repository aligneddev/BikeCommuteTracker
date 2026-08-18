import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_parsing_trailing_iso_currency", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_parsing_trailing_iso_currency", "CSV amount contains trailing ISO currency code (USD)");

  await recorder.step("Set authenticated session and trailing ISO preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "trailing_iso_currency" });

  await recorder.step("Upload CSV containing trailing ISO code.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "iso.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,1250 USD,Wheelset\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify parsed amount is treated as valid.");
  await expect(page.getByText("Total rows: 1")).toBeVisible();
  await expect(page.getByText("Valid rows: 1")).toBeVisible();
  await expect(page.getByText("Invalid rows: 0")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeEnabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_parsing_trailing_iso_currency");
  await recorder.save(testInfo);
});
