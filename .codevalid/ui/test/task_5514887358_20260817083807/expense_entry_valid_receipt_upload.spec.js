import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Valid receipt file is accepted and stored", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_valid_receipt_upload",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and expense api", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page, { receiptAttached: true });
  });

  await recorder.step("open page and fill valid values", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("20.00");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(2048, 4),
    });
  });

  await recorder.step("submit and assert success", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toHaveCount(0);
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_valid_receipt_upload");
  await recorder.save(testInfo);
});
