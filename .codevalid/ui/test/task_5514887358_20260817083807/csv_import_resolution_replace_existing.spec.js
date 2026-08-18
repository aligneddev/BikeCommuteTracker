import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseImportApis,
} from "../../helpers/mock-api.js";
import {
  duplicatePreviewResponse,
  replaceDuplicateSummaryResponse,
} from "../../mock/mock-data.js";

test("User resolves duplicate by selecting 'Replace with Import' and updates existing expense", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "csv_import_resolution_replace_existing",
    testTitle: testInfo.title,
  });

  await recorder.step("seed preview and confirm responses", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseImportApis(page, {
      previewResponse: duplicatePreviewResponse,
      confirmResponse: replaceDuplicateSummaryResponse,
    });
  });

  await recorder.step("open import page and preview duplicate file", async () => {
    await page.goto("/expenses/import");
    await page.locator("#expense-import-file").setInputFiles({
      name: "expenses.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Amount,Note\n2024-06-15,20.50,Flat tire\n"),
    });
    await page.getByRole("button", { name: "Preview Import" }).click();
  });

  await recorder.step("choose replace and confirm import", async () => {
    await page.getByLabel("Replace with Import").check();
    await page.getByRole("button", { name: "Confirm Import" }).click();
  });

  await recorder.step("assert import summary", async () => {
    await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
    await expect(page.getByText("Imported rows: 1")).toBeVisible();
    await expect(page.getByText("Skipped rows: 0")).toBeVisible();
    await expect(page.getByText("Failed rows: 0")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_resolution_replace_existing");
  await recorder.save(testInfo);
});
