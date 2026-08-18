import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockRecordExpenseSuccess,
  mockCommonAppRoutes,
} from "../../helpers/mock-api.js";

test("Expense receipt upload blocks unsupported file types", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_receipt_upload_invalid_type",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and record expense api", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page);
  });

  await recorder.step("open expense entry page", async () => {
    await page.goto("/expenses/entry");
  });

  await recorder.step("fill preserved fields and upload invalid receipt type", async () => {
    await page.locator('[name="expenseDate"]').fill("2024-06-10");
    await page.locator('[name="amount"]').fill("10.00");
    await page.locator('[name="note"]').fill("Bike repair");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plain text"),
    });
  });

  await recorder.step("assert clear validation error and preserved form fields", async () => {
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toBeVisible();
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-10");
    await expect(page.locator('[name="amount"]')).toHaveValue("10.00");
    await expect(page.locator('[name="note"]')).toHaveValue("Bike repair");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_receipt_upload_invalid_type");
  await recorder.save(testInfo);
});
