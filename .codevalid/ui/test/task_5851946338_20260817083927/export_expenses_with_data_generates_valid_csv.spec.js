import fs from "fs/promises";
import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
  mockExpensesExport,
} from "../../helpers/mock-api.js";

test("Export Expenses generates valid CSV with expense data", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_expenses_with_data_generates_valid_csv",
    testTitle: testInfo.title,
  });

  const csvContent = [
    "Date,Amount,Notes,CreatedAtUtc",
    '2024-06-15,24.5,"Oil change",2024-06-15T12:00:00.000Z',
    '2024-06-16,10,,2024-06-16T12:30:00.000Z',
  ].join("\n");

  await recorder.step("Arrange authenticated session, settings page, and expense export mocks", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockExpensesExport(page, {
      body: csvContent,
      fileName: "expenses-export.csv",
    });
  });

  await recorder.step("Open the Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Export Expenses" })).toBeVisible();
  });

  let download;
  let fileText;

  await recorder.step("Click Export Expenses and wait for the download", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Expenses" }).click(),
    ]);
    await expect(download.suggestedFilename()).toBe("expenses-export.csv");
  });

  await recorder.step("Read and validate the downloaded CSV contents", async () => {
    const filePath = await download.path();
    fileText = await fs.readFile(filePath, "utf-8");

    const rows = fileText.split("\n");
    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toBe("Date,Amount,Notes,CreatedAtUtc");
    await expect(rows[1]).toBe('2024-06-15,24.5,"Oil change",2024-06-15T12:00:00.000Z');
    await expect(rows[2]).toBe("2024-06-16,10,,2024-06-16T12:30:00.000Z");
    await expect(fileText).not.toContain("Total");
    await expect(fileText).not.toContain("Subtotal");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_expenses_with_data_generates_valid_csv");
  await recorder.save(testInfo);
});
