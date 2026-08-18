import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
  mockExpensesExport,
} from "../../helpers/mock-api.js";

test("Export Expenses results in a downloadable CSV file with correct filename", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_expenses_file_downloads_in_correct_format",
    testTitle: testInfo.title,
  });

  await recorder.step("Arrange authenticated session and expense export download mock", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockExpensesExport(page, {
      body: "Date,Amount,Notes,CreatedAtUtc\n2024-06-15,24.5,Oil change,2024-06-15T12:00:00.000Z\n",
      fileName: "expenses-export.csv",
    });
  });

  await recorder.step("Open Settings page", async () => {
    await page.goto("/settings");
  });

  await recorder.step("Trigger export and verify downloaded filename format", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Expenses" }).click(),
    ]);

    await expect(download.suggestedFilename()).toBe("expenses-export.csv");
    await expect(download.suggestedFilename().endsWith(".csv")).toBeTruthy();
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_expenses_file_downloads_in_correct_format");
  await recorder.save(testInfo);
});
