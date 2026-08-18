import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_parsing_currency_symbols", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_parsing_currency_symbols", "CSV amount contains currency symbols and thousands separators");

  await recorder.step("Set authenticated session and currency parsing preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "currency_symbols" });

  await recorder.step("Upload CSV containing currency symbols.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "currency.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,$1,250.00,Wheelset\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify parsed row appears as valid and import can proceed.");
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByText("Total rows: 1")).toBeVisible();
  await expect(page.getByText("Valid rows: 1")).toBeVisible();
  await expect(page.getByText("Invalid rows: 0")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Import" })).toBeEnabled();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_parsing_currency_symbols");
  await recorder.save(testInfo);
});
