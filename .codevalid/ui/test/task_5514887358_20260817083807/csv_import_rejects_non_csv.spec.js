import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockExpenseImportApis,
} from "../../helpers/mock-api.js";

test("CSV import rejects non-.csv files and displays error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "csv_import_rejects_non_csv",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated import page dependencies", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockExpenseImportApis(page);
  });

  await recorder.step("open import page", async () => {
    await page.goto("/expenses/import");
  });

  await recorder.step("select non csv file", async () => {
    await page.locator("#expense-import-file").setInputFiles({
      name: "expenses.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("fake-xlsx"),
    });
  });

  await recorder.step("assert validation error", async () => {
    await expect(page.getByText("Please upload a .csv file.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Import Expenses" })).toBeVisible();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:csv_import_rejects_non_csv");
  await recorder.save(testInfo);
});
