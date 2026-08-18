import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockRecordExpenseSuccess,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Receipt attachment fails gracefully on non-fatal storage errors", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_receipt_attachment_storage_error",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and success response with receipt warning", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page, {
      receiptError: "Receipt attachment failed. Expense saved without receipt.",
      receiptAttached: false,
    });
  });

  await recorder.step("open entry page and submit valid form with valid receipt", async () => {
    await page.goto("/expenses/entry");
    await page.locator('[name="expenseDate"]').fill("2024-06-10");
    await page.locator('[name="amount"]').fill("15.50");
    await page.locator('[name="note"]').fill("Fixed derailleur");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "receipt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(1024, 2),
    });
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert success and non-blocking receipt failure message", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.getByText("Receipt attachment failed. Expense saved without receipt.")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-10");
    await expect(page.locator('[name="amount"]')).toHaveValue("15.50");
    await expect(page.locator('[name="note"]')).toHaveValue("Fixed derailleur");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_receipt_attachment_storage_error");
  await recorder.save(testInfo);
});
