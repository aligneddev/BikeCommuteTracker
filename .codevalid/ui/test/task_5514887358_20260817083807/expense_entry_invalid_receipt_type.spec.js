import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Invalid receipt file type is rejected with error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_invalid_receipt_type",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and attempt invalid receipt upload", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("18.50");
    await page.locator('[name="note"]').fill("Floor pump");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plain text"),
    });
  });

  await recorder.step("assert invalid type error and preserved text fields", async () => {
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-15");
    await expect(page.locator('[name="amount"]')).toHaveValue("18.50");
    await expect(page.locator('[name="note"]')).toHaveValue("Floor pump");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_invalid_receipt_type");
  await recorder.save(testInfo);
});
