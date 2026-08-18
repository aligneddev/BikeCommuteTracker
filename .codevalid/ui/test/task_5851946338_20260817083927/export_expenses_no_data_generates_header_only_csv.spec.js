import fs from "fs/promises";
import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockSettingsPageData,
  mockExpensesExport,
} from "../../helpers/mock-api.js";

test("Export Expenses with no expenses generates header-only CSV", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "export_expenses_no_data_generates_header_only_csv",
    testTitle: testInfo.title,
  });

  const csvContent = "Date,Amount,Notes,CreatedAtUtc\n";

  await recorder.step("Arrange authenticated session, settings page, and empty expense export mocks", async () => {
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

  await recorder.step("Click Export Expenses and wait for the download", async () => {
    [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export Expenses" }).click(),
    ]);
    await expect(download.suggestedFilename()).toBe("expenses-export.csv");
  });

  await recorder.step("Read and validate the header-only CSV", async () => {
    const filePath = await download.path();
    const fileText = await fs.readFile(filePath, "utf-8");
    const trimmed = fileText.trimEnd();
    const rows = trimmed.split("\n");

    await expect(trimmed).toBe("Date,Amount,Notes,CreatedAtUtc");
    await expect(rows).toHaveLength(1);
    await expect(rows[0]).toBe("Date,Amount,Notes,CreatedAtUtc");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:export_expenses_no_data_generates_header_only_csv");
  await recorder.save(testInfo);
});
