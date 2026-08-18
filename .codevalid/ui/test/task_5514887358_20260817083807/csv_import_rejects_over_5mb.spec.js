import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseImportApis,
} from "../../helpers/mock-api.js";

test("CSV import rejects files over 5MB", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "csv_import_rejects_over_5mb",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated import page dependencies", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseImportApis(page);
  });

  await recorder.step("open import page and select oversized csv", async () => {
    await page.goto("/expenses/import");
    await page.locator("#expense-import-file").setInputFiles({
      name: "large_expenses.csv",
      mimeType: "text/csv",
      buffer: Buffer.alloc(6 * 1024 * 1024, 7),
    });
  });

  await recorder.step("assert file size validation error", async () => {
    await expect(page.getByText("CSV file must be 5 MB or smaller.")).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_rejects_over_5mb");
  await recorder.save(testInfo);
});
