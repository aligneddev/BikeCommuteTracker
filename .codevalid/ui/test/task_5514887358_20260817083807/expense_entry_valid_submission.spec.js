import { test, expect } from "@playwright/test";
import { ExecutionRecorder } from "../../helpers/execution-recorder.js";
import {
  setupAppSession,
  mockCommonAppRoutes,
  mockRecordExpenseSuccess,
} from "../../helpers/mock-api.js";

test("Valid expense entry with receipt is saved successfully", async ({ page }, testInfo) => {
  const recorder = new ExecutionRecorder({
    testId: "expense_entry_valid_submission",
    testTitle: testInfo.title,
  });

  await recorder.step("seed authenticated session and expense api", async () => {
    await setupAppSession(page);
    await mockCommonAppRoutes(page);
    await mockRecordExpenseSuccess(page, { receiptAttached: true });
  });

  await recorder.step("open expense entry page", async () => {
    await page.goto("/expenses/entry");
    await expect(page.getByRole("heading", { name: "Record Expense" })).toBeVisible();
  });

  await recorder.step("fill valid expense details and upload valid receipt", async () => {
    await page.locator('[name="expenseDate"]').fill("2024-06-15");
    await page.locator('[name="amount"]').fill("45.50");
    await page.locator('[name="note"]').fill("New bike chain");
    await page.locator('[name="receipt"]').setInputFiles({
      name: "image.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.alloc(1024, 1),
    });
  });

  await recorder.step("submit form", async () => {
    await page.getByRole("button", { name: "Record Expense" }).click();
  });

  await recorder.step("assert success state", async () => {
    await expect(page.getByText("Expense recorded successfully")).toBeVisible();
    await expect(page.getByText("Receipt must be JPEG, PNG, WEBP, or PDF and cannot exceed 5 MB.")).toHaveCount(0);
    await expect(page.locator('[name="expenseDate"]')).toHaveValue("2024-06-15");
    await expect(page.locator('[name="amount"]')).toHaveValue("45.50");
    await expect(page.locator('[name="note"]')).toHaveValue("New bike chain");
  });

  console.log("CODEVALID_TEST_ASSERTION_OK:expense_entry_valid_submission");
  await recorder.save(testInfo);
});
