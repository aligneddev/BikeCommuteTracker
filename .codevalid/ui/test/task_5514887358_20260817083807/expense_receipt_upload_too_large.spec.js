import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockRecordExpenseSuccess,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Expense receipt upload blocks files over 5 MB", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_receipt_upload_too_large",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and expense create api", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open entry page", async () => {
    await page.goto("/expenses/entry");
  });

  await recorder.step("fill fields and upload oversized receipt", async () => {
    await page.locator('[name="expenseDate"]').fill("2024-06-10");
    await page.locator('[name="amount"]').fill("10.00");
    await page.locator('[name="note"]').fill("Bike repair");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "large_receipt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(6 * 1024 * 1024, 1),
    });
  });

  await recorder.step("assert error and preserved entered data", async () => {
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-10");
    await expect(page.locator('[name="amount"]')).toHaveValue("10.00");
    await expect(page.locator('[name="note"]')).toHaveValue("Bike repair");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_receipt_upload_too_large");
  await recorder.save(testInfo);
});
