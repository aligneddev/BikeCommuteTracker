import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Receipt exceeding 5 MB is rejected with clear error", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_receipt_too_large",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open page and upload oversized receipt", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("18.50");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "large.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(6 * 1024 * 1024, 7),
    });
  });

  await recorder.step("assert oversized receipt error", async () => {
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-15");
    await expect(page.locator('[name="amount"]')).toHaveValue("18.50");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_receipt_too_large");
  await recorder.save(testInfo);
});
