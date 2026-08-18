import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseImportApis,
} from "../../helpers/mock-api.js";
import { duplicatePreviewResponse } from "../../mock/mock-data.js";

test("CSV import identifies duplicate expenses and presents per-row resolution", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "csv_import_handles_duplicate_expenses_per_row",
    testTitle: testInfo.title,
  });

  await recorder.step("seed import preview response with duplicate conflict", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseImportApis(page, {
      previewResponse: duplicatePreviewResponse,
    });
  });

  await recorder.step("open import page and upload csv", async () => {
    await page.goto("/expenses/import");
    await page.locator("#expense-import-file").setInputFiles({
      name: "expenses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Amount,Note\n2024-06-15,15.00,\n2024-06-16,20.00,Tube\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("assert preview counts and duplicate resolution options", async () => {
    await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
    await expect(page.getByText("Total rows: 2")).toBeVisible();
    await expect(page.getByText("Valid rows: 2")).toBeVisible();
    await expect(page.getByText("Duplicate rows: 1")).toBeVisible();
    await expect(page.getByText("Row 1: 2024-06-15 · $15.00")).toBeVisible();
    await expect(page.getByLabel("Keep Existing")).toBeVisible();
    await expect(page.getByLabel("Replace with Import")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_handles_duplicate_expenses_per_row");
  await recorder.save(testInfo);
});
