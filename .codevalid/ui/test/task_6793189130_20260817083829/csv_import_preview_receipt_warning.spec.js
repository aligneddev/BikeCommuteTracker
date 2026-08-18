import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupBikeTrackingAuthenticatedSession,
  setupExpenseImportScenario,
} from "../../helpers/mock-api.js";

test("csv_import_preview_receipt_warning", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder("csv_import_preview_receipt_warning", "Preview displays clear message that receipts cannot be imported");

  await recorder.step("Set authenticated session and valid preview mock.");
  await setupBikeTrackingAuthenticatedSession(page);
  await setupExpenseImportScenario(page, { scenario: "preview_receipt_warning" });

  await recorder.step("Open import page and preview a valid file.");
  await page.goto("/expenses/import");
  await page.locator("#expense-import-file").setInputFiles({
    name: "valid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Amount,Note\n05/01/2024,12.50,Tube\n"),
  });
  await page.getByRole("button", { name: "Preview Import" }).click();

  await recorder.step("Verify receipts warning remains visible on preview.");
  await expect(
    page.getByText("Receipts cannot be imported. To add a receipt, find the expense in your history and use the edit option.")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_preview_receipt_warning");
  await recorder.save(testInfo);
});
