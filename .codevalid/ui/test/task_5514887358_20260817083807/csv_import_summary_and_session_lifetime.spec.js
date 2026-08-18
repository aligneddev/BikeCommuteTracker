import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseImportApis,
} from "../../helpers/mock-api.js";
import {
  duplicatePreviewResponse,
  keepExistingSummaryResponse,
} from "../../mock/mock-data.js";

test("CSV import shows summary and deletes job records after exiting page", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "csv_import_summary_and_session_lifetime",
    testTitle: testInfo.title,
  });

  await recorder.step("seed import preview confirm and cleanup endpoints", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseImportApis(page, {
      previewResponse: duplicatePreviewResponse,
      confirmResponse: keepExistingSummaryResponse,
    });
  });

  await recorder.step("run import to summary page", async () => {
    await page.goto("/expenses/import");
    await page.locator("#expense-import-file").setInputFiles({
      name: "expenses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Amount,Note\n2024-06-15,15.00,\n2024-06-16,20.00,Tube\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
    await page.getByRole("button", { name: "Confirm Import" }).click();
  });

  await recorder.step("assert summary then leave and start fresh import", async () => {
    await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
    await expect(page.getByText("Imported rows: 1")).toBeVisible();
    await expect(page.getByText("Skipped rows: 1")).toBeVisible();
    await expect(page.getByText("Failed rows: 0")).toBeVisible();
    await page.getByRole("link", { name: "Back to Expense History" }).click();
    await expect(page).toHaveURL(/\/expenses\/history$/);
    await page.goto("/expenses/import");
    await expect(page.getByRole("heading", { name: "Import Expenses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preview" })).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_summary_and_session_lifetime");
  await recorder.save(testInfo);
});
