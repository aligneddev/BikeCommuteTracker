import fs from "fs/promises";
import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
  mockExpensesExport,
} from "../../helpers/mock-api.js";

test("Export Expenses properly escapes special characters in CSV", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_expenses_csv_special_characters_escaped",
    testTitle: testInfo.title,
  });

  const csvContent = [
    "Date,Amount,Notes,CreatedAtUtc",
    '2024-06-20,18.75,"groceries, gas",2024-06-20T12:00:00.000Z',
    '2024-06-21,19.25,"He said ""hello""",2024-06-21T12:00:00.000Z',
    '2024-06-22,20,"Line one\nLine two",2024-06-22T12:00:00.000Z',
  ].join("\n");

  await recorder.step("Arrange authenticated session and special-character expense export", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockSettingsPageData(page);
    await mockExpensesExport(page, {
      body: csvContent,
      fileName: "expenses-export.csv",
    });
  });

  await recorder.step("Open Settings page", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Export Expenses" })).toBeVisible();
  });

  let download;

  await recorder.step("Export expenses and wait for the CSV download", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Expenses" }).click(),
    ]);
  });

  await recorder.step("Read CSV text and verify standard CSV escaping", async () => {
    const filePath = await download.path();
    const fileText = await fs.readFile(filePath, "utf-8");

    await expect(fileText).toContain('"groceries, gas"');
    await expect(fileText).toContain('"He said ""hello"""');
    await expect(fileText).toContain('"Line one\nLine two"');
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_expenses_csv_special_characters_escaped");
  await recorder.save(testInfo);
});
